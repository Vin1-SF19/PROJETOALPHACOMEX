import { beforeEach, describe, expect, it, vi } from "vitest";

const pipelineFindFirstMock = vi.hoisted(() => vi.fn());
const cardFindManyMock = vi.hoisted(() => vi.fn());
const historicoFindManyMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const historicoCreateMock = vi.hoisted(() => vi.fn());
const tarefaCreateMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmPipeline: { findFirst: pipelineFindFirstMock },
    bpmCard: { findMany: cardFindManyMock },
    bpmTarefa: { create: tarefaCreateMock },
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

describe("automação mensal de Monitoramento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineFindFirstMock.mockResolvedValue({
      id: "pipeline-1",
      etapas: [
        { id: "standby", nome: "Standby - Follow Up" },
        { id: "monitoramento", nome: "Monitoramento" },
      ],
    });
    cardFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "card-monitoramento",
        responsavelId: 42,
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
        updatedAt: new Date("2026-08-01T12:00:00.000Z"),
      }]);
    historicoFindManyMock.mockResolvedValue([{
      cardId: "card-monitoramento",
      acao: "CARD_MOVIDO",
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      valorNovoJson: JSON.stringify({ etapaId: "monitoramento" }),
    }]);
    updateManyMock.mockResolvedValue({ count: 1 });
    tarefaCreateMock.mockResolvedValue({ id: "tarefa-monitoramento" });
    historicoCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({
      bpmCard: { updateMany: updateManyMock },
      bpmTarefa: { create: tarefaCreateMock },
      bpmCardHistorico: { create: historicoCreateMock },
    }));
    notificarMock.mockResolvedValue(undefined);
  });

  it("cria uma tarefa mensal com alerta, CAS, histórico e realtime pós-commit", async () => {
    const agora = new Date("2026-08-31T12:00:00.000Z");
    const resumo = await executarAutomacaoFollowUpBpm(agora);

    expect(resumo.monitoramento).toMatchObject({ examinados: 1, elegiveis: 1, tarefasCriadas: 1, falhos: 0 });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "card-monitoramento",
        pipelineId: "pipeline-1",
        etapaId: "monitoramento",
        status: "ATIVO",
        updatedAt: new Date("2026-08-01T12:00:00.000Z"),
      },
      data: { updatedAt: agora },
    });
    expect(tarefaCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-monitoramento",
        responsavelId: 42,
        titulo: "Revisar monitoramento",
        tipo: "TAREFA",
        prazo: agora,
        alertaEm: agora,
      }),
      select: { id: true },
    });
    expect(historicoCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-monitoramento",
        acao: "MONITORAMENTO_AUTOMATICO_EXECUTADO",
        automacaoOrigem: "monitoramento_mensal",
        valorNovoJson: expect.stringContaining("tarefa-monitoramento"),
      }),
    });
    expect(notificarMock).toHaveBeenCalledWith({
      pipelineId: "pipeline-1",
      cardId: "card-monitoramento",
      tipo: "TAREFA_ALTERADA",
    });
  });

  it("não cria antes de 30 dias nem quando o CAS perde", async () => {
    cardFindManyMock.mockReset();
    cardFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "card-recente",
        responsavelId: 42,
        createdAt: new Date("2026-08-02T12:00:00.000Z"),
        updatedAt: new Date("2026-08-02T12:00:00.000Z"),
      }]);
    historicoFindManyMock.mockResolvedValue([]);
    const cedo = await executarAutomacaoFollowUpBpm(new Date("2026-08-31T11:59:59.999Z"));
    expect(cedo.monitoramento).toMatchObject({ examinados: 1, elegiveis: 0, tarefasCriadas: 0 });

    cardFindManyMock.mockReset();
    cardFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "card-conflito",
        responsavelId: 42,
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
        updatedAt: new Date("2026-08-01T12:00:00.000Z"),
      }]);
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    const conflito = await executarAutomacaoFollowUpBpm(new Date("2026-08-31T12:00:00.000Z"));
    expect(conflito.monitoramento).toMatchObject({ elegiveis: 1, tarefasCriadas: 0, ignorados: 1 });
  });

  it("continua monitorando mesmo se a etapa Standby não estiver configurada", async () => {
    pipelineFindFirstMock.mockResolvedValueOnce({
      id: "pipeline-1",
      etapas: [{ id: "monitoramento", nome: "Monitoramento" }],
    });
    cardFindManyMock.mockReset();
    cardFindManyMock.mockResolvedValueOnce([{
      id: "card-sem-standby",
      responsavelId: 42,
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      updatedAt: new Date("2026-08-01T12:00:00.000Z"),
    }]);
    historicoFindManyMock.mockResolvedValueOnce([{
      cardId: "card-sem-standby",
      acao: "CARD_MOVIDO",
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      valorNovoJson: JSON.stringify({ etapaId: "monitoramento" }),
    }]);

    const resumo = await executarAutomacaoFollowUpBpm(new Date("2026-08-31T12:00:00.000Z"));

    expect(resumo.avisos).toContain("Etapa Standby - Follow Up não encontrada.");
    expect(resumo.monitoramento).toMatchObject({ examinados: 1, tarefasCriadas: 1 });
  });
});
