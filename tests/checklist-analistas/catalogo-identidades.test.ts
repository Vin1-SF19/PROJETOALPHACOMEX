import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { criarFixtureChecklist } from "./sqlite-fixture";

const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
import { listarCatalogo, modelosAplicaveis, publicarModelo, revisarModelo } from "@/lib/checklist/catalogo";
import { capacidadesParaAtor, exigirEscritaChecklist } from "@/lib/checklist/acesso";
import { selecionarTipo } from "@/lib/checklist/service";
import { normalizarCodigoModelo, publicarModeloSchema } from "@/lib/checklist/schemas";
import { hashPayload } from "@/lib/checklist/result";

const leader = { kind: "INTERNO", id: 3, sessionVersion: 0 } as const;
const admin = { ...leader, id: 4 };
const owner = { ...leader, id: 1 };
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
beforeAll(async () => { fixture = await criarFixtureChecklist(); state.db = fixture.db; }, 30000);
afterAll(async () => { await fixture?.close(); });
function model(codigo: string, escopo = "DISPONIBILIDADE_FINANCEIRA") {
  return { mutationId: randomUUID(), expectedRevision: 0, escopo, codigo,
    chaveInterna: `REQ_${randomUUID().replaceAll("-", "").toUpperCase()}`,
    nome: "Exigência sintética", descricao: "Condição sintética", secao: "CAPACIDADE OPERACIONAL",
    obrigatorio: false, ordem: 10, ativo: true };
}
async function snapshot() {
  return {
    identities: await state.db.modeloChecklistIdentidade.findMany({ orderBy: { id: "asc" } }),
    versions: await state.db.modeloItemChecklist.findMany({ orderBy: { id: "asc" } }),
    events: await state.db.checklistEvento.findMany({ orderBy: { id: "asc" } }),
    audits: await state.db.auditoria.findMany({ orderBy: { id: "asc" } }),
  };
}
describe.sequential("catálogo — código significativo e identidade estável", () => {
  it("valida chave técnica sem transformar o código e sem truncar", () => {
    expect(publicarModeloSchema.parse(model("  4100 e\n4110 i  ")).codigo).toBe("4100 e\n4110 i");
    for (const chaveInterna of ["", "a", "A-B", " A ", "A".repeat(81)])
      expect(publicarModeloSchema.safeParse({ ...model("1100"), chaveInterna }).success).toBe(false);
    expect(publicarModeloSchema.safeParse(model("1".repeat(81))).success).toBe(false);
    expect(publicarModeloSchema.safeParse({ ...model("1100"), descricao: "x".repeat(1001) }).success).toBe(false);
  });
  it("composto sobrevive publicar/listar/editar/ordenar/desativar/republicar; replay guarda intenção", async () => {
    const input = model("4100 e\n4110 i");
    const first = await publicarModelo(admin, input);
    expect(await publicarModelo(admin, input)).toEqual(first);
    await expect(publicarModelo(admin, { ...input, mutationId: randomUUID() }))
      .rejects.toMatchObject({ code: "MODEL_CODE_CONFLICT" });
    const page = await listarCatalogo(admin, { escopo: input.escopo, pageSize: 100 });
    expect(page.items.find((i) => i.id === first.identidadeId)).toMatchObject({
      codigo: input.codigo, chaveInterna: input.chaveInterna, modelo: { codigo: input.codigo },
    });
    const edit = { ...input, identidadeId: first.identidadeId, expectedRevision: 1,
      mutationId: randomUUID(), nome: "Contas sintéticas ou internet" };
    expect((await publicarModelo(admin, edit)).revision).toBe(2);
    const order = { identidadeId: first.identidadeId, expectedRevision: 2, mutationId: randomUUID(), ordem: 20 };
    const ordered = await revisarModelo(admin, order, "ORDENAR");
    const deactivate = { ...order, expectedRevision: 3, mutationId: randomUUID() };
    const inactive = await revisarModelo(admin, deactivate, "DESATIVAR");
    await publicarModelo(admin, { ...edit, expectedRevision: 4, mutationId: randomUUID(), ordem: 20 });
    expect(await revisarModelo(admin, order, "ORDENAR")).toEqual(ordered);
    expect(await revisarModelo(admin, deactivate, "DESATIVAR")).toEqual(inactive);
    const versions = await state.db.modeloItemChecklist.findMany({ where: { identidadeId: first.identidadeId } });
    expect(versions).toHaveLength(5);
    expect(versions.every((v) => v.codigo === input.codigo)).toBe(true);
    const event = await state.db.checklistEvento.findUniqueOrThrow({ where: { mutationId: input.mutationId } });
    expect(event.dados).toMatchObject({ contratoCodigo: 2 });
    expect(event.payloadHash).toBe(hashPayload({ operation: "PUBLICAR", ...publicarModeloSchema.parse(input), contratoCodigo: 2 }));
  });
  it("legado sem chave conserva colisão; representação pode ser restaurada sem trocar identidade/código lógico", async () => {
    const base = model("4100 e\n4110 i", "INICIO_RETOMADA");
    const legacy = { ...base, chaveInterna: undefined };
    const normalized = normalizarCodigoModelo(legacy.codigo);
    const first = await publicarModelo(leader, { ...legacy, codigo: normalized });
    await expect(publicarModelo(leader, { ...legacy, mutationId: randomUUID() })).rejects.toMatchObject({ code: "MODEL_CODE_CONFLICT" });
    const restore = { ...legacy, identidadeId: first.identidadeId, expectedRevision: 1, mutationId: randomUUID() };
    const restored = await publicarModelo(leader, restore);
    expect(restored).toMatchObject({ identidadeId: first.identidadeId, revision: 2 });
    expect((await state.db.modeloChecklistIdentidade.findUniqueOrThrow({ where: { id: first.identidadeId } })).codigoNormalizado).toBe(normalized);
    const before = await snapshot();
    expect(await publicarModelo(leader, { ...restore, expectedRevision: 2, mutationId: randomUUID() })).toEqual(restored);
    for (const changed of [{ chaveInterna: "OTHER" }, { escopo: "GLOBAL" }, { codigo: "9999" }])
      await expect(publicarModelo(leader, { ...restore, expectedRevision: 2, mutationId: randomUUID(), ...changed })).rejects.toMatchObject({ code: "MODEL_CODE_CONFLICT" });
    expect(await snapshot()).toEqual(before);
  });
  it("replay PUBLICAR antigo aceita somente formato legado e novo v2 rejeita grafia divergente", async () => {
    const input = { ...model("árvore /\n01", "RECEITA_BRUTA_DAS"), chaveInterna: undefined };
    const legacyInput = { ...input, codigo: normalizarCodigoModelo(input.codigo) };
    const first = await publicarModelo(leader, legacyInput);
    await state.db.checklistEvento.update({ where: { mutationId: input.mutationId }, data: {
      payloadHash: hashPayload({ operation: "PUBLICAR", ...publicarModeloSchema.parse(legacyInput) }),
      dados: { modeloId: first.modeloId, versao: 1, ativo: true },
    } });
    const before = await snapshot();
    expect(await publicarModelo(leader, input)).toEqual(first);
    await expect(publicarModelo(admin, input)).rejects.toMatchObject({ code: "CONFLICT" });
    const account = await fixture.atendimento();
    await state.db.checklistEvento.update({ where: { mutationId: input.mutationId }, data: { atorContaId: account.conta.id } });
    try { await expect(publicarModelo(leader, input)).rejects.toMatchObject({ code: "CONFLICT" }); }
    finally { await state.db.checklistEvento.update({ where: { mutationId: input.mutationId }, data: { atorContaId: null } }); }
    await expect(publicarModelo(leader, { ...input, nome: "Divergente" })).rejects.toMatchObject({ code: "CONFLICT" });
    await state.db.usuarios.update({ where: { id: leader.id }, data: { permissoes: "" } });
    try { await expect(publicarModelo(leader, input)).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await state.db.usuarios.update({ where: { id: leader.id }, data: { permissoes: "checkList" } }); }
    expect(await snapshot()).toEqual(before);
    const v2 = { ...input, mutationId: randomUUID(), codigo: "novo /\n02" };
    const published = await publicarModelo(leader, v2);
    expect(await publicarModelo(leader, v2)).toEqual(published);
    await expect(publicarModelo(leader, { ...v2, codigo: normalizarCodigoModelo(v2.codigo) })).rejects.toMatchObject({ code: "CONFLICT" });
    // A new marker can never opt into legacy fallback, even with a legacy-shaped hash.
    await state.db.checklistEvento.update({ where: { mutationId: v2.mutationId }, data: {
      payloadHash: hashPayload({ operation: "PUBLICAR", ...publicarModeloSchema.parse({ ...v2, codigo: normalizarCodigoModelo(v2.codigo) }) }),
    } });
    await expect(publicarModelo(leader, v2)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("override GLOBAL segue chave persistida, fallback ativo e chaves distintas não colapsam", async () => {
    const key = `ANY_${randomUUID().replaceAll("-", "").toUpperCase()}`;
    const global = { ...model("override", "GLOBAL"), chaveInterna: key };
    const g = await publicarModelo(leader, global);
    const specific = await publicarModelo(leader, { ...global, mutationId: randomUUID(), escopo: "RECEITA_BRUTA_DAS", nome: "Específico" });
    const separate = await publicarModelo(leader, model("override", "RECEITA_BRUTA_DAS"));
    let rows = await modelosAplicaveis(state.db, "RECEITA_BRUTA_DAS");
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([specific.modeloId, separate.modeloId]));
    expect(rows.map((r) => r.id)).not.toContain(g.modeloId);
    await revisarModelo(leader, { identidadeId: specific.identidadeId, expectedRevision: 1, mutationId: randomUUID() }, "DESATIVAR");
    rows = await modelosAplicaveis(state.db, "RECEITA_BRUTA_DAS");
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([g.modeloId, separate.modeloId]));
    const oldGlobal = { ...model("OLD_SAME", "GLOBAL"), chaveInterna: undefined };
    const old = await publicarModelo(leader, oldGlobal);
    const oldSpecific = await publicarModelo(leader, { ...oldGlobal, escopo: "INICIO_RETOMADA", mutationId: randomUUID() });
    rows = await modelosAplicaveis(state.db, "INICIO_RETOMADA");
    expect(rows.map((r) => r.id)).toContain(oldSpecific.modeloId);
    expect(rows.map((r) => r.id)).not.toContain(old.modeloId);
  });
  it("códigos repetidos têm status próprio na materialização; instância existente nunca reaplica catálogo", async () => {
    const requirements = [model("3140"), { ...model("3140"), nome: "Recibos sintéticos" },
      { ...model("5160"), secao: "CAPACIDADE FINANCEIRA" }, { ...model("5160"), secao: "ORIGEM DO CAPITAL SOCIAL" }];
    const published: Awaited<ReturnType<typeof publicarModelo>>[] = [];
    for (const requirement of requirements) published.push(await publicarModelo(leader, requirement));
    const f = await fixture.atendimento();
    const historical = await state.db.checklist.findUniqueOrThrow({ where: { id: f.checklist.id }, include: { itens: true } });
    await selecionarTipo(owner, { empresaId: f.empresa.id, tipo: "DISPONIBILIDADE_FINANCEIRA", expectedRevision: 0, mutationId: randomUUID() });
    const actual = await state.db.checklist.findUniqueOrThrow({ where: { empresaId_tipo: { empresaId: f.empresa.id, tipo: "DISPONIBILIDADE_FINANCEIRA" } }, include: { itens: { orderBy: { id: "asc" } } } });
    const selected = actual.itens.filter((i) => published.some((p) => p.modeloId === i.modeloRevisaoId));
    expect(selected.map((i) => i.codigo).sort()).toEqual(["3140", "3140", "5160", "5160"]);
    expect(selected.every((i) => i.status === "PENDENTE")).toBe(true);
    expect(new Set(selected.map((i) => i.id)).size).toBe(4);
    expect(actual.itens.some((i) => i.codigo === "4100 e\n4110 i")).toBe(true);
    expect(actual.modelosSnapshot).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: "4100 e\n4110 i" }),
      ...published.map((p, i) => expect.objectContaining({ id: p.modeloId, codigo: requirements[i].codigo })),
    ]));
    await publicarModelo(leader, { ...requirements[0], identidadeId: published[0].identidadeId,
      expectedRevision: 1, mutationId: randomUUID(), nome: "Futura revisão" });
    await publicarModelo(leader, model("NOVO_FUTURO"));
    await selecionarTipo(owner, { empresaId: f.empresa.id, tipo: "DISPONIBILIDADE_FINANCEIRA", expectedRevision: 1, mutationId: randomUUID() });
    expect(await state.db.checklist.findUniqueOrThrow({ where: { id: actual.id }, include: { itens: { orderBy: { id: "asc" } } } })).toEqual(actual);
    expect(await state.db.checklist.findUniqueOrThrow({ where: { id: f.checklist.id }, include: { itens: true } })).toEqual(historical);
    expect(await state.db.checklist.count({ where: { empresaId: f.empresa.id, tipo: "RECEITA_BRUTA_CPRB" } })).toBe(0);
    const future = await fixture.atendimento();
    await selecionarTipo(owner, { empresaId: future.empresa.id, tipo: "DISPONIBILIDADE_FINANCEIRA", expectedRevision: 0, mutationId: randomUUID() });
    expect(await state.db.itemChecklist.count({ where: { checklist: { empresaId: future.empresa.id }, codigo: "NOVO_FUTURO" } })).toBe(1);
  });
  it("concorrência com mesma revisão aceita uma escrita e não deixa versões/eventos parciais", async () => {
    const input = model("CONCURRENT");
    const first = await publicarModelo(leader, input);
    const intents = ["A", "B"].map((nome) => ({ ...input, identidadeId: first.identidadeId,
      expectedRevision: 1, mutationId: randomUUID(), nome }));
    const outcomes = await Promise.allSettled(intents.map((intent) => publicarModelo(leader, intent)));
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === "rejected")).toHaveLength(1);
    expect(await state.db.modeloItemChecklist.count({ where: { identidadeId: first.identidadeId } })).toBe(2);
    expect(await state.db.modeloItemChecklist.count({ where: { identidadeId: first.identidadeId, ativo: true } })).toBe(1);
    expect(await state.db.checklistEvento.count({ where: { agregadoId: first.identidadeId } })).toBe(2);
    const committed = await state.db.checklistEvento.findMany({ where: { mutationId: { in: intents.map((i) => i.mutationId) } }, include: { auditoria: true } });
    expect(committed).toHaveLength(1);
    expect(committed[0].auditoria).toMatchObject({ checklistEventoId: committed[0].id });
  });
  it("Admin só ganha gestão do catálogo; CAS e falha de auditoria revertem revisão/evento/identidade", async () => {
    const f = await fixture.atendimento();
    expect(capacidadesParaAtor(admin, "Admin", f.empresa)).toMatchObject({ canManageModels: true, canEdit: false, canCreateOwn: false, canAssignOwner: false, canManagePortalAccess: false, canLinkCrm: false });
    await expect(exigirEscritaChecklist(state.db, admin, f.empresa.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const input = model("ATOMIC");
    const first = await publicarModelo(admin, input);
    const before = await snapshot();
    await expect(publicarModelo(admin, { ...input, identidadeId: first.identidadeId, mutationId: randomUUID(), expectedRevision: 0, nome: "stale" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot()).toEqual(before);
    await state.db.$executeRawUnsafe("CREATE TRIGGER reject_catalog_audit BEFORE INSERT ON Auditoria WHEN NEW.acao='CHECKLIST_MODELO_PUBLICADO' BEGIN SELECT RAISE(ABORT,'synthetic audit fault'); END");
    try {
      await expect(publicarModelo(admin, { ...input, identidadeId: first.identidadeId, mutationId: randomUUID(), expectedRevision: 1, nome: "rollback" })).rejects.toThrow();
      await expect(publicarModelo(admin, model("ROLLBACK_CREATE"))).rejects.toThrow();
      expect(await snapshot()).toEqual(before);
    } finally { await state.db.$executeRawUnsafe("DROP TRIGGER reject_catalog_audit"); }
  });
});
