import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { criarFixtureChecklist } from "./sqlite-fixture";
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient, auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get default() { return state.db; } }));
vi.mock("../../auth", () => ({ auth: state.auth }));
import { atualizarItem, selecionarTipo } from "@/lib/checklist/service";
import { resultado } from "@/lib/checklist/result";
import { publicarPendentes } from "@/lib/checklist/eventos";
import { exigirLeituraChecklist } from "@/lib/checklist/acesso";
import { listarCatalogo, publicarModelo, revisarModelo } from "@/lib/checklist/catalogo";
import { emitirResetAcessoPortal } from "@/actions/ClientesOperacional";
import { obterEmpresa } from "@/lib/checklist/leitura";
const owner = { kind: "INTERNO", id: 1, sessionVersion: 0 } as const;
const leader = { ...owner, id: 3 };
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
beforeAll(async () => { fixture = await criarFixtureChecklist(); state.db = fixture.db; }, 30000);
afterAll(async () => { await fixture?.close(); });

describe.sequential("concorrência e escala — transações reais SQLite", () => {
  it("duas intenções concorrentes na mesma revisão consomem exatamente um CAS", async () => {
    const f = await fixture.atendimento();
    const writes = ["OK", "IRREGULAR"].map((status) => ({ itemId: f.item.id, expectedRevision: 0, mutationId: randomUUID(), patch: { status } }));
    const results = await Promise.all(writes.map((c) => resultado(() => atualizarItem(owner, c))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const loser = results.findIndex((r) => !r.ok);
    expect(results[loser]).toMatchObject({ ok: false, error: { code: expect.stringMatching(/^(CONFLICT|RETRYABLE)$/) } });
    const retry = await resultado(() => atualizarItem(owner, writes[loser]));
    expect(retry).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const e = await state.db.operacionalClientes.findUniqueOrThrow({ where: { id: f.empresa.id } });
    expect(e.revision).toBe(1);
    expect(await state.db.checklistEvento.count({ where: { empresaId: f.empresa.id } })).toBe(1);
    const winner = writes[results.findIndex((r) => r.ok)];
    expect((await state.db.itemChecklist.findUniqueOrThrow({ where: { id: f.item.id } })).status).toBe(winner.patch.status);
  });
  it("mesma intenção simultânea é recuperável por replay sem duplicar journal/aviso", async () => {
    const f = await fixture.atendimento();
    const c = { itemId: f.item.id, expectedRevision: 0, mutationId: randomUUID(), patch: { status: "OK" } };
    const concurrent = await Promise.all([resultado(() => atualizarItem(owner, c)), resultado(() => atualizarItem(owner, c))]);
    expect(concurrent.some((r) => r.ok)).toBe(true);
    for (const result of concurrent) if (!result.ok) expect(result.error.code).toMatch(/^(CONFLICT|RETRYABLE)$/);
    expect(await resultado(() => atualizarItem(owner, c))).toMatchObject({ ok: true, data: { revision: 1 } });
    expect(await state.db.checklistEvento.count({ where: { mutationId: c.mutationId } })).toBe(1);
    expect(await state.db.notificacaoCliente.count({ where: { empresaId: f.empresa.id } })).toBe(1);
  });
  it("dois workers simultâneos disputam um claim e só um publica", async () => {
    await state.db.checklistEvento.updateMany({ data: { publicadoEm: new Date() } });
    const f = await fixture.atendimento();
    await atualizarItem(owner, { itemId: f.item.id, expectedRevision: 0, mutationId: randomUUID(), patch: { status: "OK" } });
    const trigger = vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
    const results = await Promise.all([publicarPendentes(trigger), publicarPendentes(trigger)]);
    expect(results.reduce((sum, r) => sum + r.processed, 0)).toBe(1);
    expect(trigger).toHaveBeenCalledOnce();
    expect(await state.db.checklistEvento.findFirstOrThrow({ where: { empresaId: f.empresa.id } })).toMatchObject({ tentativas: 1, claimToken: null, claimAte: null, publicadoEm: expect.any(Date) });
  });
  it("override REMOVE vence setor; revogação/inatividade persistida vence sessão antiga", async () => {
    await state.db.setorPermissao.create({ data: { setor: "Operacional", modulo: "checkList" } });
    await exigirLeituraChecklist(owner);
    const denied = await state.db.usuarioPermissaoOverride.create({ data: { usuarioId: owner.id, modulo: "checkList", acao: "REMOVE", criadoPor: 3 } });
    await expect(exigirLeituraChecklist(owner)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await state.db.usuarioPermissaoOverride.delete({ where: { id: denied.id } });
    await state.db.usuarios.update({ where: { id: 1 }, data: { status: "INATIVO" } });
    await expect(exigirLeituraChecklist(owner)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await state.db.usuarios.update({ where: { id: 1 }, data: { status: "ATIVO", authSessionVersion: 1 } });
    await expect(exigirLeituraChecklist(owner)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await state.db.usuarios.update({ where: { id: 1 }, data: { authSessionVersion: 0 } });
    await exigirLeituraChecklist(owner);
  });
  it("catálogo com501 identidades atravessa a antiga barreira500 e mantém page/count", async () => {
    await state.db.modeloChecklistIdentidade.createMany({ data: Array.from({ length: 501 }, (_, i) => ({ id: `scale-${i}`, escopo: "INICIO_RETOMADA", codigoNormalizado: `SCALE_${String(i).padStart(4, "0")}`, revision: 1 })) });
    await state.db.modeloItemChecklist.createMany({ data: Array.from({ length: 501 }, (_, i) => ({ identidadeId: `scale-${i}`, tipo: "INICIO_RETOMADA", codigo: `SCALE_${String(i).padStart(4, "0")}`, nome: `Modelo${i}`, secao: "CONSTITUIÇÃO REGULAR", versao: 1, ativo: true, ordem: i })) });
    const ids: string[] = [];
    for (let page = 1; page <= 6; page++) {
      const response = await listarCatalogo(owner, { escopo: "INICIO_RETOMADA", page, pageSize: 100 });
      expect(response.totalCount).toBe(501);
      expect(response.items).toHaveLength(page < 6 ? 100 : 1);
      expect(response.items.every((item) => item.modelo?.ativo === true)).toBe(true);
      ids.push(...response.items.map((item) => item.id));
    }
    expect(new Set(ids).size).toBe(501);
    const f = await fixture.atendimento();
    const next = await selecionarTipo(owner, { empresaId: f.empresa.id, tipo: "INICIO_RETOMADA", expectedRevision: 0, mutationId: randomUUID() });
    expect(next.checklist?.itens).toHaveLength(501);
    expect(next.resumo.total).toBe(501);
    expect(next.checklist?.itens.at(-1)?.codigo).toBe("SCALE_0500");
  });
  it("desativação e ordenação afetam futuro, preservando snapshot100% anterior", async () => {
    const input = (codigo: string, ordem: number) => ({ mutationId: randomUUID(), expectedRevision: 0, escopo: "RECEITA_BRUTA_CPRB", codigo, nome: codigo, descricao: null, secao: "CONSTITUIÇÃO REGULAR", obrigatorio: true, ordem });
    const a = await publicarModelo(leader, input("FIRST", 0));
    const b = await publicarModelo(leader, input("SECOND", 1));
    const old = await fixture.atendimento();
    const selected = await selecionarTipo(owner, { empresaId: old.empresa.id, tipo: "RECEITA_BRUTA_CPRB", expectedRevision: 0, mutationId: randomUUID() });
    let revision = selected.revision;
    for (const item of selected.checklist!.itens) {
      const result = await atualizarItem(owner, { itemId: item.id, expectedRevision: revision, mutationId: randomUUID(), patch: { status: "OK" } });
      revision = result.revision;
    }
    const before = await obterEmpresa(owner, old.empresa.id);
    expect(before.resumo.percentual).toBe(100);
    const snapshot = await state.db.checklist.findUniqueOrThrow({ where: { id: before.checklist!.id } });
    await revisarModelo(leader, { identidadeId: a.identidadeId, expectedRevision: 1, mutationId: randomUUID() }, "DESATIVAR");
    await revisarModelo(leader, { identidadeId: b.identidadeId, expectedRevision: 1, mutationId: randomUUID(), ordem: 99 }, "ORDENAR");
    const after = await obterEmpresa(owner, old.empresa.id);
    expect(after.checklist).toEqual(before.checklist);
    expect(after.resumo.percentual).toBe(100);
    expect((await state.db.checklist.findUniqueOrThrow({ where: { id: before.checklist!.id } })).modelosSnapshot).toEqual(snapshot.modelosSnapshot);
    const future = await fixture.atendimento();
    const created = await selecionarTipo(owner, { empresaId: future.empresa.id, tipo: "RECEITA_BRUTA_CPRB", expectedRevision: 0, mutationId: randomUUID() });
    expect(created.checklist?.itens.map((item) => ({ codigo: item.codigo, ordem: item.ordem }))).toEqual([{ codigo: "SECOND", ordem: 99 }]);
    expect(created.resumo.percentual).toBe(0);
  });
  it("reset de acesso exige liderança quando conta é compartilhada; replay não reexibe token", async () => {
    const f = await fixture.atendimento();
    const foreign = await fixture.atendimento(2);
    await state.db.operacionalClientes.update({ where: { id: foreign.empresa.id }, data: { clienteOperacionalId: f.conta.id } });
    state.auth.mockResolvedValue({ user: { id: "1", authSessionVersion: 0 } });
    const failedMutation = randomUUID();
    expect(await emitirResetAcessoPortal({ empresaId: f.empresa.id, expectedRevision: 0, mutationId: failedMutation })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect((await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: f.conta.id } })).resetSenhaTokenHash).toBeNull();
    expect(await state.db.checklistEvento.count({ where: { mutationId: failedMutation } })).toBe(0);
    state.auth.mockResolvedValue({ user: { id: "3", authSessionVersion: 0 } });
    const input = { empresaId: f.empresa.id, expectedRevision: 0, mutationId: randomUUID() };
    const emitted = await emitirResetAcessoPortal(input);
    expect(emitted).toMatchObject({ ok: true, data: { token: expect.any(String), expiresInSeconds: 900, revision: 1, replayed: false } });
    const stored = await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: f.conta.id } });
    expect(stored.resetSenhaTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.authSessionVersion).toBe(0);
    expect(stored.senhaHash).toBe(f.conta.senhaHash);
    const replayed = await emitirResetAcessoPortal(input);
    expect(replayed).toMatchObject({ ok: true, data: { revision: 1, replayed: true } });
    expect(replayed).not.toHaveProperty("data.token");
    expect((await state.db.clienteOperacional.findUniqueOrThrow({ where: { id: f.conta.id } })).resetSenhaTokenHash).toBe(stored.resetSenhaTokenHash);
  });

});
