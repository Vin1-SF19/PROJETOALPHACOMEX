import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { templateChecklistCompativel } from "@/lib/bpm/checklists/leitura";
import { criarTemplateChecklistSchema } from "@/lib/bpm/checklists/schemas";

const card = { id: "card-1", pipelineId: "pipe-1", etapaId: "etapa-1" };
const cuid1 = "cm12345678901234567890123";
const cuid2 = "cm12345678901234567890124";

const authMock = vi.hoisted(() => vi.fn());
const acessoConfigMock = vi.hoisted(() => vi.fn());
const revalidateMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmChecklistTemplate: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  bpmChecklistTemplateItem: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  bpmChecklistTemplateEtapa: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
  bpmPipelineConfigAuditoria: { create: vi.fn() },
  bpmPipeline: { findUnique: vi.fn(), findMany: vi.fn() },
  bpmEtapa: { findUnique: vi.fn(), findMany: vi.fn() },
  bpmCard: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: acessoConfigMock, exigirAcessoBpmCard: vi.fn() }));
vi.mock("@/lib/bpm/checklists/service", () => ({ materializarChecklistsAplicaveisCard: vi.fn(), carregarResumoChecklistCard: vi.fn() }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));

const { CriarTemplateChecklistBpm, SalvarTemplateChecklistBpm } = await import("@/actions/bpm/Checklists");

describe("RM-2026-457A31 — escopo multietapa", () => {
  it("resolve global, singular legado, selecionado e não selecionado", () => {
    expect(templateChecklistCompativel({ pipelineId: "pipe-1", etapaId: null, etapaIds: [], cardId: null }, card)).toBe(true);
    expect(templateChecklistCompativel({ pipelineId: "pipe-1", etapaId: "etapa-1", cardId: null }, card)).toBe(true);
    expect(templateChecklistCompativel({ pipelineId: "pipe-1", etapaId: "etapa-2", etapaIds: ["etapa-1", "etapa-2"], cardId: null }, card)).toBe(true);
    expect(templateChecklistCompativel({ pipelineId: "pipe-1", etapaId: "etapa-2", etapaIds: ["etapa-2", "etapa-3"], cardId: null }, card)).toBe(false);
  });

  it("aceita lista deduplicada e recusa IDs repetidos ou excesso", () => {
    expect(criarTemplateChecklistSchema.safeParse({ nome: "Checklist", pipelineId: cuid2, etapaIds: [cuid1], itens: [] }).success).toBe(true);
    expect(criarTemplateChecklistSchema.safeParse({ nome: "Checklist", pipelineId: cuid2, etapaIds: [cuid1, cuid1], itens: [] }).success).toBe(false);
    expect(criarTemplateChecklistSchema.safeParse({ nome: "Checklist", pipelineId: cuid2, etapaIds: Array.from({ length: 101 }, (_, index) => `${cuid1}${index}`), itens: [] }).success).toBe(false);
  });
});

describe("RM-2026-457A31 — Server Actions", () => {
  const templateId = cuid1;
  const pipelineId = cuid2;
  const etapaA = "cm12345678901234567890125";
  const etapaB = "cm12345678901234567890126";
  const etapaOutroPipeline = "cm12345678901234567890127";

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    acessoConfigMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (operacao) => operacao(prismaMock));
    prismaMock.bpmPipeline.findUnique.mockResolvedValue({ id: pipelineId });
    prismaMock.bpmChecklistTemplateEtapa.findMany.mockResolvedValue([]);
  });

  it("rejeita etapa que não pertence ao pipeline informado", async () => {
    prismaMock.bpmEtapa.findMany.mockResolvedValue([]);
    const resposta = await CriarTemplateChecklistBpm({
      nome: "Checklist", pipelineId, etapaIds: [etapaOutroPipeline], itens: [],
    });
    expect(resposta).toEqual({ success: false, error: "Etapa inválida para o pipeline" });
    expect(prismaMock.bpmChecklistTemplate.create).not.toHaveBeenCalled();
  });

  it("cria template com várias etapas do mesmo pipeline", async () => {
    prismaMock.bpmEtapa.findMany.mockResolvedValue([
      { id: etapaA, pipelineId, ordem: 0 },
      { id: etapaB, pipelineId, ordem: 1 },
    ]);
    prismaMock.bpmChecklistTemplate.create.mockResolvedValue({ id: templateId });
    const resposta = await CriarTemplateChecklistBpm({
      nome: "Checklist", pipelineId, etapaIds: [etapaA, etapaB], itens: [],
    });
    expect(resposta).toEqual({ success: true, data: { id: templateId } });
    expect(prismaMock.bpmChecklistTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        etapaId: etapaA,
        etapas: { create: [{ etapaId: etapaA }, { etapaId: etapaB }] },
      }),
    }));
  });

  it("edição reconcilia associações: mantém, adiciona e remove etapas", async () => {
    prismaMock.bpmEtapa.findMany.mockResolvedValue([{ id: etapaB, pipelineId, ordem: 1 }]);
    prismaMock.bpmChecklistTemplate.findUnique.mockResolvedValue({
      id: templateId, pipelineId, etapaId: etapaA, updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      itens: [], etapas: [{ etapaId: etapaA }],
    });
    prismaMock.bpmChecklistTemplateEtapa.findMany.mockResolvedValue([{ etapaId: etapaA }]);
    prismaMock.bpmChecklistTemplate.update.mockResolvedValue({ id: templateId });

    const resposta = await SalvarTemplateChecklistBpm({
      id: templateId, nome: "Checklist", pipelineId, etapaIds: [etapaB], itens: [],
    });

    expect(resposta).toEqual({ success: true });
    expect(prismaMock.bpmChecklistTemplateEtapa.deleteMany).toHaveBeenCalledWith({
      where: { templateId, etapaId: { in: [etapaA] } },
    });
    expect(prismaMock.bpmChecklistTemplateEtapa.createMany).toHaveBeenCalledWith({
      data: [{ templateId, etapaId: etapaB }],
    });
  });

  it("template legado (etapaId singular, sem associações) resolve como uma etapa selecionada", async () => {
    prismaMock.bpmEtapa.findMany.mockResolvedValue([{ id: etapaA, pipelineId, ordem: 0 }]);
    prismaMock.bpmChecklistTemplate.findUnique.mockResolvedValue({
      id: templateId, pipelineId, etapaId: etapaA, updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      itens: [], etapas: [],
    });
    prismaMock.bpmChecklistTemplateEtapa.findMany.mockResolvedValue([]);
    prismaMock.bpmChecklistTemplate.update.mockResolvedValue({ id: templateId });

    const resposta = await SalvarTemplateChecklistBpm({
      id: templateId, nome: "Checklist", pipelineId, etapaIds: [etapaA], itens: [],
    });

    expect(resposta).toEqual({ success: true });
    expect(prismaMock.bpmChecklistTemplateEtapa.createMany).toHaveBeenCalledWith({
      data: [{ templateId, etapaId: etapaA }],
    });
  });

  it("bloqueia edição concorrente quando updatedAt não corresponde", async () => {
    prismaMock.bpmChecklistTemplate.findUnique.mockResolvedValue({
      id: templateId, pipelineId: null, etapaId: null, updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      itens: [], etapas: [],
    });
    const resposta = await SalvarTemplateChecklistBpm({
      id: templateId, nome: "Checklist", updatedAt: new Date("2026-02-02T00:00:00.000Z"), itens: [],
    });
    expect(resposta).toEqual({ success: false, error: "CONFLITO_CHECKLIST_TEMPLATE" });
    expect(prismaMock.bpmChecklistTemplate.update).not.toHaveBeenCalled();
  });
});

describe("RM-2026-457A31 — migration", () => {
  const migration = readFileSync("prisma/migrations/20260908214000_bpm_checklist_template_multiplas_etapas/migration.sql", "utf8");

  it("é aditiva e contém FKs, unicidade, índices e backfill idempotente", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "BpmChecklistTemplateEtapa"');
    expect(migration).toContain("ON DELETE CASCADE ON UPDATE CASCADE");
    expect(migration).toContain("ON DELETE RESTRICT ON UPDATE CASCADE");
    expect(migration).toContain('"BpmChecklistTemplateEtapa_templateId_etapaId_key"');
    expect(migration).toContain("INSERT OR IGNORE");
    expect(migration).toContain('WHERE "etapaId" IS NOT NULL');
    expect(migration).not.toMatch(/\b(?:DROP|RENAME|TRUNCATE)\b/i);
  });
});
