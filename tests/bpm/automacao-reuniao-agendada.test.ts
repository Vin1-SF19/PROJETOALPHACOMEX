import { beforeEach, describe, expect, it, vi } from "vitest";

const pipelineFindFirstMock = vi.hoisted(() => vi.fn());
const cardFindManyMock = vi.hoisted(() => vi.fn());
const historicoFindManyMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const historicoCreateMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmPipeline: { findFirst: pipelineFindFirstMock },
    bpmCard: { findMany: cardFindManyMock },
    bpmCardHistorico: { findMany: historicoFindManyMock },
    bpmCardCampoValor: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: transactionMock,
  },
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposObrigatoriosEtapa: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarMock }));

import { executarAutomacaoFollowUpBpm } from "@/lib/bpm/automacao-novos-leads";

describe("automação de oito dias de Reunião Agendada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineFindFirstMock.mockResolvedValue({
      id: "pipeline-1",
      etapas: [
        { id: "novos", nome: "Novos leads" },
        { id: "agendar", nome: "Agendar reunião" },
        { id: "reuniao", nome: "Reunião Agendada" },
        { id: "standby", nome: "Standby - Follow Up" },
      ],
    });
    cardFindManyMock.mockResolvedValue([{
      id: "card-1",
      etapaId: "reuniao",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
    }]);
    historicoFindManyMock.mockResolvedValue([{
      cardId: "card-1",
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      valorNovoJson: JSON.stringify({ etapaId: "reuniao" }),
    }]);
    updateManyMock.mockResolvedValue({ count: 1 });
    historicoCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({
      bpmCard: { updateMany: updateManyMock },
      bpmCardHistorico: { create: historicoCreateMock },
    }));
    notificarMock.mockResolvedValue(undefined);
  });

  it("move uma única vez para Standby no oitavo dia útil e registra a origem da etapa", async () => {
    const resumo = await executarAutomacaoFollowUpBpm(new Date("2026-08-20T12:00:00.000Z"));

    expect(resumo).toMatchObject({ examinados: 1, elegiveis: 1, movidos: 1, falhos: 0 });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "card-1",
        pipelineId: "pipeline-1",
        etapaId: "reuniao",
        status: "ATIVO",
        proximoContatoEm: null,
      },
      data: { etapaId: "standby" },
    });
    expect(historicoCreateMock).toHaveBeenCalledWith({
      data: {
        cardId: "card-1",
        acao: "CARD_MOVIDO_POR_AUTOMACAO",
        automacaoOrigem: "reuniao_agendada_8_dias_uteis",
        valorAnteriorJson: JSON.stringify({ etapaId: "reuniao" }),
        valorNovoJson: JSON.stringify({ etapaId: "standby" }),
      },
    });
    expect(notificarMock).toHaveBeenCalledWith({
      pipelineId: "pipeline-1",
      cardId: "card-1",
      tipo: "CARD_MOVIDO",
    });
  });
});
