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
  verificarTransicaoPermitidaBpm: vi.fn().mockResolvedValue({ permitida: true }),
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
    cardFindManyMock
      .mockResolvedValueOnce([{
      id: "card-1",
      etapaId: "reuniao",
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
      }])
      .mockResolvedValueOnce([]);
    historicoFindManyMock.mockResolvedValue([{
      cardId: "card-1",
      createdAt: new Date("2026-08-10T12:00:00.000Z"),
      valorNovoJson: JSON.stringify({ etapaId: "reuniao" }),
    }]);
    updateManyMock.mockResolvedValue({ count: 1 });
    historicoCreateMock.mockResolvedValue({});
    tarefaCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({
      bpmCard: { updateMany: updateManyMock },
      bpmTarefa: { create: tarefaCreateMock },
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

  it("gera uma tarefa semanal em Standby somente após sete dias, com CAS e histórico", async () => {
    cardFindManyMock.mockReset();
    cardFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: "card-standby",
        etapaId: "standby",
        responsavelId: 42,
        createdAt: new Date("2026-08-01T12:00:00.000Z"),
        standbyFollowUpUltimoEm: null,
        standbyFollowUpInterrompidoEm: null,
      }]);
    historicoFindManyMock.mockResolvedValue([{
      cardId: "card-standby",
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      valorNovoJson: JSON.stringify({ etapaId: "standby" }),
    }]);

    const resumo = await executarAutomacaoFollowUpBpm(new Date("2026-08-08T12:00:00.000Z"));

    expect(resumo.standby).toMatchObject({ examinados: 1, elegiveis: 1, tarefasCriadas: 1, falhos: 0 });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "card-standby",
        pipelineId: "pipeline-1",
        etapaId: "standby",
        status: "ATIVO",
        standbyFollowUpInterrompidoEm: null,
        standbyFollowUpUltimoEm: null,
      },
      data: { standbyFollowUpUltimoEm: new Date("2026-08-08T12:00:00.000Z") },
    });
    expect(tarefaCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-standby",
        responsavelId: 42,
        status: "PENDENTE",
        titulo: "Realizar follow-up semanal",
      }),
    });
    expect(historicoCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-standby",
        acao: "STANDBY_FOLLOW_UP_EXECUTADO",
        automacaoOrigem: "standby_follow_up_semanal",
      }),
    });
    expect(notificarMock).toHaveBeenCalledWith({
      pipelineId: "pipeline-1",
      cardId: "card-standby",
      tipo: "TAREFA_ALTERADA",
    });
  });

  it("não cria tarefa antes de sete dias, após opt-out, nem quando o CAS perde", async () => {
    cardFindManyMock.mockReset();
    cardFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "card-recente",
          etapaId: "standby",
          responsavelId: 42,
          createdAt: new Date("2026-08-03T12:00:00.000Z"),
          standbyFollowUpUltimoEm: null,
          standbyFollowUpInterrompidoEm: null,
        },
        {
          id: "card-optout",
          etapaId: "standby",
          responsavelId: 42,
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          standbyFollowUpUltimoEm: null,
          standbyFollowUpInterrompidoEm: new Date("2026-08-01T12:00:00.000Z"),
        },
        {
          id: "card-cas",
          etapaId: "standby",
          responsavelId: 42,
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          standbyFollowUpUltimoEm: null,
          standbyFollowUpInterrompidoEm: null,
        },
      ]);
    historicoFindManyMock.mockResolvedValue([]);
    updateManyMock.mockResolvedValue({ count: 0 });

    const resumo = await executarAutomacaoFollowUpBpm(new Date("2026-08-08T12:00:00.000Z"));

    expect(resumo.standby).toMatchObject({ examinados: 3, elegiveis: 1, interrompidos: 1, tarefasCriadas: 0 });
    expect(tarefaCreateMock).not.toHaveBeenCalled();
    expect(historicoCreateMock).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });
});
