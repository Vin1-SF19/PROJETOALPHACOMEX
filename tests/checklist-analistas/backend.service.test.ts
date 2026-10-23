import JSZip from "jszip";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { DatabaseSync } from "./node-sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AtorChecklist } from "@/lib/checklist/types";
import {
  normalizarCodigoModelo,
  patchItemSchema,
} from "@/lib/checklist/schemas";
import {
  resumirChecklist,
  resolverChecklistAtivo,
} from "@/lib/checklist/items";
const state = vi.hoisted(() => ({ db: undefined as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({
  get default() {
    return state.db;
  },
}));
vi.mock("../../auth", () => ({ auth: vi.fn() }));
const cardAcl = vi.hoisted(() => vi.fn(async () => ({ autorizado: true })));
vi.mock("@/lib/bpm/ownership", () => ({ checarAcessoBpmCard: cardAcl }));
const dir = mkdtempSync(join(tmpdir(), "checklist-backend-"));
const url = `file:${join(dir, "fixture.db")}`;
let service: typeof import("@/lib/checklist/service");
let access: typeof import("@/lib/checklist/acesso");
let catalog: typeof import("@/lib/checklist/catalogo");
let leitura: typeof import("@/lib/checklist/leitura");
let docs: typeof import("@/lib/checklist/documentos");
let storage: typeof import("@/lib/checklist/storage");
let zip: typeof import("@/lib/checklist/zip");
let events: typeof import("@/lib/checklist/eventos");
const owner: AtorChecklist = { kind: "INTERNO", id: 1, sessionVersion: 0 },
  other: AtorChecklist = { kind: "INTERNO", id: 2, sessionVersion: 0 },
  leader: AtorChecklist = { kind: "INTERNO", id: 3, sessionVersion: 0 };
beforeAll(async () => {
  const ddl = execFileSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      env: {
        ...process.env,
        TURSO_DATABASE_URL: url,
        TURSO_AUTH_TOKEN: "synthetic",
      },
    },
  );
  const sqlite = new DatabaseSync(join(dir, "fixture.db"));
  sqlite.exec(ddl);
  sqlite.close();
  state.db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  for (const [id, role] of [
    [1, "Operacional"],
    [2, "Analista Operacional"],
    [3, "Líder Operacional"],
    [4, "Admin"],
    [5, "CEO"],
    [6, "TI"],
    [7, "Líder Comercial"],
    [8, "Comercial"],
  ] as const)
    await state.db.usuarios.create({
      data: {
        id,
        nome: `Synthetic ${id}`,
        usuario: `synthetic${id}`,
        email: `synthetic${id}@example.invalid`,
        senha: "fixture",
        role,
        permissoes: id === 8 ? "" : "checkList",
      },
    });
  service = await import("@/lib/checklist/service");
  access = await import("@/lib/checklist/acesso");
  catalog = await import("@/lib/checklist/catalogo");
  leitura = await import("@/lib/checklist/leitura");
  docs = await import("@/lib/checklist/documentos");
  storage = await import("@/lib/checklist/storage");
  zip = await import("@/lib/checklist/zip");
  events = await import("@/lib/checklist/eventos");
}, 30000);
afterAll(async () => {
  await state.db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});
async function atendimento(analistaId: number | null = 1) {
  const cliente = await state.db.cliente.create({
    data: { razaoSocial: "Synthetic company" },
  });
  const conta = await state.db.clienteOperacional.create({
    data: {
      nome: "Synthetic external",
      email: `${randomUUID()}@example.invalid`,
      senha: "",
      senhaHash: "synthetic",
    },
  });
  const empresa = await state.db.operacionalClientes.create({
    data: {
      clienteId: cliente.id,
      clienteOperacionalId: conta.id,
      analistaId,
      embasamento: "",
      tipo: "RECEITA_BRUTA_DAS",
    },
  });
  const checklist = await state.db.checklist.create({
    data: { empresaId: empresa.id, tipo: "RECEITA_BRUTA_DAS" },
  });
  const item = await state.db.itemChecklist.create({
    data: {
      checklistId: checklist.id,
      codigo: "DOC",
      secao: "CONSTITUIÇÃO REGULAR",
      descricao: "Synthetic item",
      observacao: "Preservar",
      obrigatorio: true,
    },
  });
  return { cliente, conta, empresa, checklist, item };
}
function model(codigo: string, escopo = "GLOBAL") {
  return {
    mutationId: randomUUID(),
    expectedRevision: 0,
    escopo,
    codigo,
    nome: "Synthetic model",
    descricao: null,
    secao: "CONSTITUIÇÃO REGULAR",
    obrigatorio: true,
    ordem: 0,
  };
}
describe.sequential(
  "Checklist backend — SQLite sintético e transações reais",
  () => {
    it("usa PATCH estrito, normalizador canônico e seleção exata de ativo", () => {
      expect(
        patchItemSchema.parse({
          mutationId: randomUUID(),
          expectedRevision: 0,
          itemId: "x",
          patch: { status: "OK" },
        }).patch,
      ).not.toHaveProperty("observacao");
      expect(normalizarCodigoModelo(" Á bc-01 ")).toBe("A_BC_01");
      expect(resolverChecklistAtivo(null, [{ tipo: "A" }])).toBeNull();
      expect(
        resolverChecklistAtivo("B", [{ tipo: "A" }, { tipo: "B" }])?.tipo,
      ).toBe("B");
      expect(resumirChecklist([]).estado).toBe("SEM_ITENS");
    });
    it("lê global mas não admite outro owner/Admin/CEO/TI/Comercial como escritor", async () => {
      const f = await atendimento();
      for (const id of [2, 4, 5, 6, 7]) {
        const a: AtorChecklist = { kind: "INTERNO", id, sessionVersion: 0 };
        await expect(
          access.exigirEmpresaChecklist(state.db, a, f.empresa.id),
        ).resolves.toHaveProperty("id");
        await expect(
          access.exigirEscritaChecklist(state.db, a, f.empresa.id),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await expect(
        access.exigirEscritaChecklist(state.db, leader, f.empresa.id),
      ).resolves.toHaveProperty("id");
    });
    it("recusa usuário sem módulo, legado sem owner e revogação persistida", async () => {
      const f = await atendimento(null);
      await expect(
        access.exigirLeituraChecklist({
          kind: "INTERNO",
          id: 8,
          sessionVersion: 0,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        access.exigirEscritaChecklist(state.db, owner, f.empresa.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await state.db.usuarios.update({
        where: { id: 2 },
        data: { authSessionVersion: 1 },
      });
      await expect(access.exigirLeituraChecklist(other)).rejects.toMatchObject({
        code: "UNAUTHENTICATED",
      });
      await state.db.usuarios.update({
        where: { id: 2 },
        data: { authSessionVersion: 0 },
      });
    });
    it("status-only conserva observação; item+progresso+evento+auditoria+notificação são atômicos", async () => {
      const f = await atendimento();
      const c = {
        itemId: f.item.id,
        patch: { status: "OK" },
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      const r = await service.atualizarItem(owner, c);
      expect(r.revision).toBe(1);
      expect(r.resumo.percentual).toBe(100);
      expect(
        (
          await state.db.itemChecklist.findUniqueOrThrow({
            where: { id: f.item.id },
          })
        ).observacao,
      ).toBe("Preservar");
      const ev = await state.db.checklistEvento.findUniqueOrThrow({
        where: { mutationId: c.mutationId },
        include: { auditoria: true, notificacoes: true },
      });
      expect(ev.auditoria?.userId).toBe(1);
      expect(ev.notificacoes).toHaveLength(1);
      expect(ev.revision).toBe(1);
    });
    it("null limpa; no-op não emite e replay não duplica; payload divergente conflita", async () => {
      const f = await atendimento();
      const c = {
        itemId: f.item.id,
        patch: { observacao: null },
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      await service.atualizarItem(owner, c);
      await service.atualizarItem(owner, c);
      expect(
        await state.db.checklistEvento.count({
          where: { empresaId: f.empresa.id },
        }),
      ).toBe(1);
      await expect(
        service.atualizarItem(owner, { ...c, patch: { status: "OK" } }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await service.atualizarItem(owner, {
        ...c,
        mutationId: randomUUID(),
        expectedRevision: 1,
      });
      expect(
        await state.db.checklistEvento.count({
          where: { empresaId: f.empresa.id },
        }),
      ).toBe(1);
      expect(
        (
          await state.db.itemChecklist.findUniqueOrThrow({
            where: { id: f.item.id },
          })
        ).observacao,
      ).toBeNull();
    });
    it("CAS impede sobreposição e replay reautoriza novo dono", async () => {
      const f = await atendimento();
      const c = {
        itemId: f.item.id,
        patch: { status: "OK" },
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      await service.atualizarItem(owner, c);
      await expect(
        service.atualizarItem(owner, {
          ...c,
          mutationId: randomUUID(),
          patch: { status: "REVISAR" },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await service.atribuirAnalista(leader, {
        empresaId: f.empresa.id,
        analistaId: 2,
        expectedRevision: 1,
        mutationId: randomUUID(),
      });
      await expect(service.atualizarItem(owner, c)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
    it("falha ao gravar evento desfaz item e resumo", async () => {
      const f = await atendimento();
      const sqlite = new DatabaseSync(join(dir, "fixture.db"));
      sqlite.exec(
        "CREATE TRIGGER reject_event BEFORE INSERT ON ChecklistEvento WHEN NEW.tipo='CHECKLIST_ITEM_ALTERADO' BEGIN SELECT RAISE(ABORT,'synthetic'); END;",
      );
      await expect(
        service.atualizarItem(owner, {
          itemId: f.item.id,
          patch: { status: "OK" },
          expectedRevision: 0,
          mutationId: randomUUID(),
        }),
      ).rejects.toThrow();
      sqlite.exec("DROP TRIGGER reject_event");
      sqlite.close();
      expect(
        (
          await state.db.itemChecklist.findUniqueOrThrow({
            where: { id: f.item.id },
          })
        ).status,
      ).toBe("PENDENTE");
      expect(
        (
          await state.db.operacionalClientes.findUniqueOrThrow({
            where: { id: f.empresa.id },
          })
        ).revision,
      ).toBe(0);
      expect(
        await state.db.notificacaoCliente.count({
          where: { empresaId: f.empresa.id },
        }),
      ).toBe(0);
    });
    it("catálogo somente Admin/TI/líder, identidade única e específico substitui global", async () => {
      for (const id of [1, 2, 5, 7]) {
        const actor: AtorChecklist = { kind: "INTERNO", id, sessionVersion: 0 };
        await expect(catalog.publicarModelo(actor, model(`DENIED_${id}`)))
          .rejects.toMatchObject({ code: "FORBIDDEN" });
        for (const operation of ["DESATIVAR", "ORDENAR"] as const) {
          await expect(catalog.revisarModelo(actor, {
            identidadeId: "not-accessible", expectedRevision: 0,
            mutationId: randomUUID(), ordem: 2,
          }, operation)).rejects.toMatchObject({ code: "FORBIDDEN" });
        }
      }
      await catalog.publicarModelo(leader, model("OVERRIDE"));
      await catalog.publicarModelo(leader, {
        ...model("OVERRIDE", "RECEITA_BRUTA_DAS"),
        nome: "Specific",
      });
      const resolved = await catalog.modelosAplicaveis(
        state.db,
        "RECEITA_BRUTA_DAS",
      );
      expect(resolved.filter((r) => r.codigo === "OVERRIDE")).toHaveLength(1);
      expect(resolved.find((r) => r.codigo === "OVERRIDE")?.nome).toBe(
        "Specific",
      );
      await expect(
        catalog.publicarModelo(leader, model("OVERRIDE")),
      ).rejects.toMatchObject({ code: "MODEL_CODE_CONFLICT" });
    });
    it("TI ganha apenas gestão de modelos e não ganha escrita, atribuição ou criação de dossiês", async () => {
      const ti: AtorChecklist = { kind: "INTERNO", id: 6, sessionVersion: 0 };
      const f = await atendimento();
      const readOnly = {
        canRead: true, canEdit: false, canCreateOwn: false, canAssignOwner: false,
        canManageModels: true, canManagePortalAccess: false, canLinkCrm: false,
      };
      expect(await access.obterCapacidadesChecklist(ti, f.empresa)).toEqual(readOnly);
      for (const role of ["TI", "T.I", " ti "]) {
        expect(access.capacidadesParaAtor(ti, role, f.empresa)).toEqual(readOnly);
        expect(access.capacidadesParaAtor(ti, role, { analistaId: null })).toEqual(readOnly);
      }
      expect(access.capacidadesParaAtor({ ...ti, id: 4 }, "Admin", { analistaId: null })).toEqual(readOnly);
      for (const [id, role] of [[5, "CEO"], [1, "Operacional"], [2, "Analista Operacional"]] as const) {
        expect(access.capacidadesParaAtor({ ...ti, id }, role, { analistaId: null }).canManageModels).toBe(false);
      }
      const portal: AtorChecklist = { kind: "PORTAL", id: f.conta.id, sessionVersion: 0 };
      expect(access.capacidadesParaAtor(portal, "TI", f.empresa).canManageModels).toBe(false);
      await expect(catalog.publicarModelo(portal, model("PORTAL_DENIED")))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(service.criarAtendimento(ti, {
        mutationId: randomUUID(), clienteId: f.cliente.id, clienteOperacionalId: f.conta.id,
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
      // Even when existing ownership grants editing, assignment stays leader-only.
      const owned = await atendimento(ti.id);
      await expect(service.atribuirAnalista(ti, {
        empresaId: owned.empresa.id, expectedRevision: 0,
        mutationId: randomUUID(), analistaId: 2,
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await state.db.operacionalClientes.findUniqueOrThrow({ where: { id: owned.empresa.id } })).analistaId).toBe(ti.id);
    });
    it("instâncias preservam snapshots, A→B→A conserva identidade, histórico não escreve", async () => {
      const f = await atendimento();
      const original = f.item.descricao;
      await service.selecionarTipo(owner, {
        empresaId: f.empresa.id,
        tipo: "DISPONIBILIDADE_FINANCEIRA",
        expectedRevision: 0,
        mutationId: randomUUID(),
      });
      let r = await leitura.obterEmpresa(owner, f.empresa.id);
      expect(r.tipoAtivo).toBe("DISPONIBILIDADE_FINANCEIRA");
      expect(r.checklist?.id).not.toBe(f.checklist.id);
      const historical = await leitura.obterEmpresa(owner, f.empresa.id, {
        checklistId: f.checklist.id,
      });
      expect(historical.historical).toBe(true);
      expect(historical.capabilities.canEdit).toBe(false);
      await expect(
        service.atualizarItem(owner, {
          itemId: f.item.id,
          patch: { status: "OK" },
          expectedRevision: 1,
          mutationId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await service.selecionarTipo(owner, {
        empresaId: f.empresa.id,
        tipo: "RECEITA_BRUTA_DAS",
        expectedRevision: 1,
        mutationId: randomUUID(),
      });
      r = await leitura.obterEmpresa(owner, f.empresa.id);
      expect(r.checklist?.id).toBe(f.checklist.id);
      expect(r.checklist?.itens[0].descricao).toBe(original);
    });
    it("novo modelo não propaga para instância anterior; revisão publicada é imutável no snapshot", async () => {
      const f = await atendimento();
      const c = model("FUTURE_ONLY");
      const created = (await catalog.publicarModelo(leader, c)) as {
        identidadeId: string;
        revision: number;
      };
      await catalog.publicarModelo(leader, {
        ...c,
        mutationId: randomUUID(),
        identidadeId: created.identidadeId,
        expectedRevision: 1,
        nome: "New version",
      });
      expect(
        await state.db.itemChecklist.count({
          where: { checklistId: f.checklist.id },
        }),
      ).toBe(1);
      expect(
        await state.db.modeloItemChecklist.count({
          where: { identidadeId: created.identidadeId },
        }),
      ).toBe(2);
    });
    it("criar atendimento é idempotente, novo mutation permite outra ocorrência e senha não vai para evento", async () => {
      const f = await atendimento();
      const c = {
        mutationId: randomUUID(),
        clienteId: f.cliente.id,
        novaConta: {
          nome: "Synthetic new",
          email: `${randomUUID()}@example.invalid`,
        },
      };
      const a = await service.criarAtendimento(owner, c);
      const b = await service.criarAtendimento(owner, c);
      expect(a.atendimento.id).toBe(b.atendimento.id);
      expect(a.credencialInicial?.length).toBeGreaterThanOrEqual(12);
      expect(b).not.toHaveProperty("credencialInicial");
      const conta = await state.db.clienteOperacional.findUniqueOrThrow({
        where: { id: a.atendimento.contaPortal!.id },
      });
      expect(conta.senha).toBe("");
      expect(conta.senhaHash).toMatch(/^\$2[aby]\$12\$/);
      const ev = await state.db.checklistEvento.findUniqueOrThrow({
        where: { mutationId: c.mutationId },
      });
      expect(JSON.stringify(ev)).not.toContain(a.credencialInicial);
      expect(JSON.stringify(ev)).not.toContain(conta.senhaHash);
      const next = await service.criarAtendimento(owner, {
        mutationId: randomUUID(),
        clienteId: f.cliente.id,
        clienteOperacionalId: conta.id,
      });
      expect(next.atendimento.id).not.toBe(a.atendimento.id);
    });
    it("portal pertence à conta e nunca ganha poderes internos", async () => {
      const f = await atendimento();
      const a: AtorChecklist = {
        kind: "PORTAL",
        id: f.conta.id,
        sessionVersion: 0,
      };
      await expect(
        access.exigirEmpresaChecklist(state.db, a, f.empresa.id),
      ).resolves.toHaveProperty("id");
      const otherCase = await atendimento();
      await expect(
        access.exigirEmpresaChecklist(state.db, a, otherCase.empresa.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        access.exigirEscritaChecklist(state.db, a, f.empresa.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("upload magic/limite, recibo consumido uma vez e sem URL/autor forjados", async () => {
      const f = await atendimento();
      const objects = new Map<string, Uint8Array>();
      const driver = {
        async put(key: string, bytes: Uint8Array) {
          objects.set(key, bytes);
        },
        async get(key: string) {
          const bytes = objects.get(key)!;
          return {
            body: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(bytes);
                c.close();
              },
            }),
            size: bytes.length,
            mime: "application/pdf",
          };
        },
      };
      const receipt = await docs.prepararUpload(
        owner,
        {
          itemId: f.item.id,
          nome: "same.pdf",
          mime: "application/pdf",
          body: new ReadableStream({
            start(c) {
              c.enqueue(Buffer.from("%PDF-fixture"));
              c.close();
            },
          }),
        },
        driver,
      );
      const c = {
        itemId: f.item.id,
        recibo: receipt.recibo,
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      const d = await docs.registrarDocumento(owner, c);
      const again = await docs.registrarDocumento(owner, c);
      expect(d.id).toBe(again.id);
      expect(d.url).toContain("/api/checklist/documentos/");
      expect(JSON.stringify(d)).not.toContain("synthetic/checklist");
      expect(
        await state.db.documentoChecklist.count({
          where: { itemId: f.item.id },
        }),
      ).toBe(1);
      await expect(
        docs.registrarDocumento(other, { ...c, mutationId: randomUUID() }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(() => docs.detectarMime(Buffer.from("fake"))).toThrow();
      await expect(
        storage.lerStreamLimitado(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(9));
              c.close();
            },
          }),
          8,
        ),
      ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    });
    it("soft delete preserva primeiro ator/data, replay e restauração deixam trilha", async () => {
      const f = await atendimento();
      const doc = await state.db.documentoChecklist.create({
        data: {
          itemId: f.item.id,
          nome: "Synthetic",
          url: "https://fixture.invalid/a",
        },
      });
      const c = {
        documentoId: doc.id,
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      const first = await service.alterarDocumento(owner, c, "EXCLUIR");
      const repeated = await service.alterarDocumento(owner, c, "EXCLUIR");
      expect(repeated.deletadoEm).toEqual(first.deletadoEm);
      expect(first.deletadoPorUsuarioId).toBe(1);
      await expect(
        service.alterarDocumento(
          owner,
          {
            ...c,
            mutationId: randomUUID(),
            expectedRevision: 1,
            observacao: "x",
          },
          "OBSERVACAO",
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("sidebar inclui analista zero e null em Todos; página/count concordam", async () => {
      const before = await leitura.listarAnalistas(owner);
      expect(before.some((a) => a.id === 2)).toBe(true);
      const f = await atendimento(null);
      const page = await leitura.listarEmpresas(owner, {
        semAnalista: true,
        pageSize: 1,
      });
      expect(page.totalCount).toBeGreaterThan(0);
      expect(page.items).toHaveLength(1);
      expect(page.items[0].analista).toBeNull();
      expect(await leitura.obterEmpresa(owner, f.empresa.id)).toHaveProperty(
        "id",
      );
    });
    it("ZIP preserva nomes iguais e leitura durável idempotente de evento", async () => {
      const base = {
        nome: "same.pdf",
        item: {
          codigo: "DOC",
          secao: "SEC",
          checklist: { tipo: "RECEITA_BRUTA_DAS" },
        },
      };
      expect(zip.caminhoZip({ ...base, id: "doc-one" }, 0)).not.toBe(
        zip.caminhoZip({ ...base, id: "doc-two" }, 1),
      );
      const eventsResult = await events.listarEventos(owner, {
        somenteNaoLidos: true,
        limit: 100,
      });
      expect(eventsResult.items.length).toBeGreaterThan(0);
      const ev = eventsResult.items[0];
      await events.marcarEventoLido(owner, ev.eventId);
      await events.marcarEventoLido(owner, ev.eventId);
      expect(
        await state.db.checklistEventoLeitura.count({
          where: { eventoId: ev.eventId, usuarioId: 1 },
        }),
      ).toBe(1);
      expect(
        (
          await events.listarEventos(owner, {
            somenteNaoLidos: true,
            limit: 100,
          })
        ).items.some((e) => e.eventId === ev.eventId),
      ).toBe(false);
    });
  },
);

describe.sequential("Contratos complementares ZIP/modelos/CRM", () => {
  it("MODEL_EMPTY é rollback completo sem instância vazia", async () => {
    const f = await atendimento();
    const active = await state.db.modeloItemChecklist.findMany({
      where: { ativo: true },
      select: { id: true },
    });
    await state.db.modeloItemChecklist.updateMany({
      where: { id: { in: active.map((m) => m.id) } },
      data: { ativo: false },
    });
    try {
      await expect(
        service.selecionarTipo(owner, {
          empresaId: f.empresa.id,
          tipo: "INICIO_RETOMADA",
          expectedRevision: 0,
          mutationId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "MODEL_EMPTY" });
      expect(
        await state.db.checklist.count({ where: { empresaId: f.empresa.id } }),
      ).toBe(1);
      expect(
        (
          await state.db.operacionalClientes.findUniqueOrThrow({
            where: { id: f.empresa.id },
          })
        ).revision,
      ).toBe(0);
    } finally {
      await state.db.modeloItemChecklist.updateMany({
        where: { id: { in: active.map((m) => m.id) } },
        data: { ativo: true },
      });
    }
  });
  it("falha no modelo não deixa identidade parcial", async () => {
    const sqlite = new DatabaseSync(join(dir, "fixture.db"));
    sqlite.exec(
      "CREATE TRIGGER reject_model BEFORE INSERT ON ModeloItemChecklist WHEN NEW.codigo='FAIL_ATOMIC' BEGIN SELECT RAISE(ABORT,'synthetic'); END;",
    );
    try {
      await expect(
        catalog.publicarModelo(leader, model("FAIL_ATOMIC")),
      ).rejects.toThrow();
      expect(
        await state.db.modeloChecklistIdentidade.count({
          where: { codigoNormalizado: "FAIL_ATOMIC" },
        }),
      ).toBe(0);
    } finally {
      sqlite.exec("DROP TRIGGER reject_model");
      sqlite.close();
    }
  });
  it("ZIP real inclui dois nomes iguais e manifesto parcial sem URL arbitrária", async () => {
    const f = await atendimento();
    await state.db.documentoChecklist.createMany({
      data: [
        {
          itemId: f.item.id,
          nome: "same.pdf",
          url: "https://fixture.invalid/one",
        },
        {
          itemId: f.item.id,
          nome: "same.pdf",
          url: "https://fixture.invalid/two",
        },
        {
          itemId: f.item.id,
          nome: "failed.pdf",
          url: "https://unlisted.invalid/blocked",
        },
      ],
    });
    vi.stubEnv("CHECKLIST_LEGACY_ALLOWED_HOSTS", '["fixture.invalid"]');
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("%PDF-synthetic"));
    try {
      const stream = await zip.gerarZipChecklist(owner, f.empresa.id, {
        escopo: "ATIVO",
      });
      const archive = await JSZip.loadAsync(
        await new Response(stream).arrayBuffer(),
      );
      const files = Object.keys(archive.files).filter((n) =>
        n.endsWith("same.pdf"),
      );
      expect(files).toHaveLength(2);
      expect(await archive.file(files[0])!.async("string")).toBe(
        "%PDF-synthetic",
      );
      const manifest = JSON.parse(
        await archive.file("manifesto.json")!.async("string"),
      );
      expect(manifest).toMatchObject({
        incluidos: 2,
        parcial: true,
        totalSolicitados: 3,
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      fetch.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("CRM: explícito, mesmo master, vários cards/dossiê, interseção ACL e guard master", async () => {
    const f = await atendimento();
    const foreign = await atendimento();
    const pipeline = await state.db.bpmPipeline.create({
      data: { nome: "Synthetic pipeline" },
    });
    const etapa = await state.db.bpmEtapa.create({
      data: { pipelineId: pipeline.id, nome: "Synthetic step" },
    });
    const makeCard = () =>
      state.db.bpmCard.create({
        data: {
          empresaId: f.cliente.id,
          pipelineId: pipeline.id,
          etapaId: etapa.id,
          responsavelId: 1,
        },
      });
    const one = await makeCard(),
      two = await makeCard();
    const adapter = await import("@/lib/bpm/checklist-documental");
    expect((await adapter.obterDossieCard(owner, one.id)).vinculo).toBeNull();
    const c = {
      cardId: one.id,
      empresaOperacionalId: f.empresa.id,
      expectedRevision: 0,
      expectedCardUpdatedAt: one.updatedAt.toISOString(),
      mutationId: randomUUID(),
    };
    await expect(
      adapter.vincularDossieCard(owner, {
        ...c,
        empresaOperacionalId: foreign.empresa.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await adapter.vincularDossieCard(owner, c);
    await adapter.vincularDossieCard(owner, c);
    await adapter.vincularDossieCard(owner, {
      ...c,
      cardId: two.id,
      expectedCardUpdatedAt: two.updatedAt.toISOString(),
      mutationId: randomUUID(),
    });
    expect(
      await state.db.checklistCrmVinculo.count({
        where: { empresaOperacionalId: f.empresa.id },
      }),
    ).toBe(2);
    await expect(
      adapter.exigirCompatibilidadeMasterDossie(
        state.db,
        one.id,
        foreign.cliente.id,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      adapter.vincularDossieCard(other, { ...c, mutationId: randomUUID() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    cardAcl.mockResolvedValueOnce({ autorizado: false });
    await expect(adapter.obterDossieCard(owner, one.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const before = await state.db.bpmCard.findUniqueOrThrow({
      where: { id: one.id },
    });
    expect(before.status).toBe("ATIVO");
    expect(before.etapaId).toBe(etapa.id);
    expect(await state.db.bpmTarefa.count({ where: { cardId: one.id } })).toBe(
      0,
    );
  });
  it("outbox falha é recuperável e worker publica eventId estável", async () => {
    const f = await atendimento();
    await service.atualizarItem(owner, {
      itemId: f.item.id,
      patch: { status: "OK" },
      expectedRevision: 0,
      mutationId: randomUUID(),
    });
    const event = await state.db.checklistEvento.findFirstOrThrow({
      where: { empresaId: f.empresa.id },
    });
    await events.publicarPendentes(async () => {
      throw new Error("synthetic outage");
    });
    const failed = await state.db.checklistEvento.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(failed.publicadoEm).toBeNull();
    expect(failed.claimToken).toBeNull();
    expect(failed.proximaTentativaEm).not.toBeNull();
    await state.db.checklistEvento.update({
      where: { id: event.id },
      data: { proximaTentativaEm: new Date(0) },
    });
    const published: string[] = [];
    await events.publicarPendentes(async (e) => {
      published.push(e.eventId);
      expect(Object.keys(e).sort()).toEqual([
        "empresaId",
        "eventId",
        "revision",
      ]);
    });
    expect(published).toContain(event.id);
    expect(
      (
        await state.db.checklistEvento.findUniqueOrThrow({
          where: { id: event.id },
        })
      ).publicadoEm,
    ).not.toBeNull();
  });
});

describe("upload privado direto acima do limite HTTP de funções", () => {
  it("token restrito só vira documento após leitura privada/magic bytes e finalize idempotente", async () => {
    const f = await atendimento();
    vi.stubEnv("CHECKLIST_PRIVATE_BLOB_TOKEN", "synthetic-token-never-used");
    vi.stubEnv("CHECKLIST_STORAGE_PREFIX", "synthetic/checklist/");
    const bytes = Buffer.from("%PDF-synthetic");
    const emit = vi.fn(async () => "synthetic-client-token");
    try {
      const start = await docs.iniciarUploadDireto(
        owner,
        {
          itemId: f.item.id,
          nome: "synthetic.pdf",
          mime: "application/pdf",
          tamanhoBytes: bytes.length,
        },
        emit,
      );
      const command = {
        itemId: f.item.id,
        recibo: start.recibo,
        expectedRevision: 0,
        mutationId: randomUUID(),
      };
      await expect(
        docs.registrarDocumento(owner, command),
      ).rejects.toMatchObject({ code: "UPLOAD_INVALID" });
      const driver = {
        async put() {},
        async get() {
          return {
            body: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(bytes);
                c.close();
              },
            }),
            mime: "application/pdf",
            size: bytes.length,
          };
        },
      };
      expect(
        (
          await docs.finalizarUploadDireto(
            owner,
            { itemId: f.item.id, recibo: start.recibo },
            driver,
          )
        ).verificado,
      ).toBe(true);
      expect(
        (
          await docs.finalizarUploadDireto(
            owner,
            { itemId: f.item.id, recibo: start.recibo },
            driver,
          )
        ).verificado,
      ).toBe(true);
      const d = await docs.registrarDocumento(owner, command);
      expect(d.nome).toBe("synthetic.pdf");
      expect(emit).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
