import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  bpmCard: { findMany: vi.fn() },
  bpmTarefa: { findMany: vi.fn() },
  bpmCardChecklist: { findMany: vi.fn() },
  bpmCampo: { findMany: vi.fn() },
  bpmCardCampoValor: { findMany: vi.fn() },
  bpmSlaInstancia: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { listarPendenciasBpm } from "@/lib/bpm/pendencias/motor";

const CARD_BASE = {
  id: "clxcard0000000000000000001",
  servico: "Contabilidade",
  proximoContatoEm: null as Date | null,
  pipelineId: "clxpipeline0000000000000001",
  etapaId: "clxetapa00000000000000000001",
  responsavelId: 1,
  responsavel: { nome: "Ana" },
  pipeline: { nome: "Comercial" },
  etapa: { nome: "Em tratativa" },
};

describe("listarPendenciasBpm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.bpmTarefa.findMany.mockResolvedValue([]);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValue([]);
    prismaMock.bpmCampo.findMany.mockResolvedValue([]);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([]);
    prismaMock.bpmSlaInstancia.findMany.mockResolvedValue([]);
  });

  it("retorna vazio quando o usuário não tem cards ativos", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens).toEqual([]);
  });

  it("escopa cards por responsável/membro para usuário comum, e sem filtro para admin/diretoria", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([]);

    await listarPendenciasBpm(1, false);
    expect(prismaMock.bpmCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: [{ responsavelId: 1 }, { membros: { some: { userId: 1 } } }] }) }),
    );

    await listarPendenciasBpm(1, true);
    expect(prismaMock.bpmCard.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: "ATIVO" } }),
    );
  });

  it("marca próximo contato vencido quando a data já passou", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([{ ...CARD_BASE, proximoContatoEm: new Date("2020-01-01T00:00:00Z") }]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: "PROXIMO_CONTATO_VENCIDO", cardId: CARD_BASE.id })]),
    );
  });

  it("não marca próximo contato quando a data ainda não chegou", async () => {
    const futuro = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    prismaMock.bpmCard.findMany.mockResolvedValue([{ ...CARD_BASE, proximoContatoEm: futuro }]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens.some((item) => item.tipo === "PROXIMO_CONTATO_VENCIDO")).toBe(false);
  });

  it("lista tarefas pendentes do card", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmTarefa.findMany.mockResolvedValue([
      { id: "t1", cardId: CARD_BASE.id, titulo: "Ligar para o cliente", prazo: null, responsavelId: 1, responsavel: { nome: "Ana" } },
    ]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: "TAREFA_PENDENTE", titulo: "Ligar para o cliente" })]),
    );
  });

  it("lista checklists não concluídos", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValue([
      { id: "c1", cardId: CARD_BASE.id, templateNome: "Abertura de processo" },
    ]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: "CHECKLIST_PENDENTE", titulo: "Checklist pendente — Abertura de processo" })]),
    );
  });

  it("detecta campo obrigatório da etapa atual sem valor preenchido", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmCampo.findMany.mockResolvedValue([
      { id: "campo1", pipelineId: CARD_BASE.pipelineId, etapaId: null, nome: "Origem do lead" },
    ]);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ tipo: "CAMPO_OBRIGATORIO_FALTANTE", titulo: "Campo obrigatório faltando — Origem do lead" })]),
    );
  });

  it("não sinaliza campo obrigatório já preenchido", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmCampo.findMany.mockResolvedValue([
      { id: "campo1", pipelineId: CARD_BASE.pipelineId, etapaId: null, nome: "Origem do lead" },
    ]);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([{ cardId: CARD_BASE.id, campoId: "campo1", valor: "Indicação" }]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens.some((item) => item.tipo === "CAMPO_OBRIGATORIO_FALTANTE")).toBe(false);
  });

  it("ignora campo obrigatório de outra etapa (etapaId não nulo e diferente da etapa atual do card)", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmCampo.findMany.mockResolvedValue([
      { id: "campo1", pipelineId: CARD_BASE.pipelineId, etapaId: "outra-etapa", nome: "Campo de outra etapa" },
    ]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens.some((item) => item.tipo === "CAMPO_OBRIGATORIO_FALTANTE")).toBe(false);
  });

  it("falha aberta (não derruba a consulta) quando SLA lança exceção — módulo ainda não disponível em produção", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmSlaInstancia.findMany.mockRejectedValue(new Error("no such table: BpmSlaInstancia"));

    await expect(listarPendenciasBpm(1, false)).resolves.toEqual([]);
  });

  it("lista alertas de SLA vencido e próximo quando o módulo está disponível", async () => {
    prismaMock.bpmCard.findMany.mockResolvedValue([CARD_BASE]);
    prismaMock.bpmSlaInstancia.findMany.mockResolvedValue([
      { id: "s1", cardId: CARD_BASE.id, deadline: new Date("2026-01-01T00:00:00Z"), alertaPrazoDisparadoEm: null, vencidoEm: new Date("2026-01-02T00:00:00Z"), slaConfig: { nome: "SLA padrão" } },
      { id: "s2", cardId: CARD_BASE.id, deadline: new Date("2026-02-01T00:00:00Z"), alertaPrazoDisparadoEm: new Date("2026-01-25T00:00:00Z"), vencidoEm: null, slaConfig: { nome: "SLA análise" } },
    ]);

    const itens = await listarPendenciasBpm(1, false);

    expect(itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "SLA_VENCIDO", titulo: "SLA vencido — SLA padrão" }),
        expect.objectContaining({ tipo: "SLA_PROXIMO", titulo: "SLA próximo do vencimento — SLA análise" }),
      ]),
    );
  });
});
