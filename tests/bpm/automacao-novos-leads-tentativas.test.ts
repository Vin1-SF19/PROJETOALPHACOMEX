import { beforeEach, describe, expect, it, vi } from "vitest";

const pipelineFindFirstMock = vi.hoisted(() => vi.fn());
const cardFindManyMock = vi.hoisted(() => vi.fn());
const interacaoFindManyMock = vi.hoisted(() => vi.fn());
const historicoFindManyMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const tarefaCreateMock = vi.hoisted(() => vi.fn());
const historicoCreateMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmPipeline: { findFirst: pipelineFindFirstMock },
    bpmCard: { findMany: cardFindManyMock },
    bpmInteracaoCard: { findMany: interacaoFindManyMock },
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

const agora = new Date("2026-08-10T12:00:00.000Z");
const cardNovoLead = {
  id: "card-novo",
  etapaId: "novos",
  responsavelId: 42,
  createdAt: new Date("2026-08-10T10:00:00.000Z"),
  updatedAt: new Date("2026-08-10T10:00:00.000Z"),
};

describe("automação operacional de cinco ligações diárias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipelineFindFirstMock.mockResolvedValue({
      id: "pipeline-1",
      etapas: [
        { id: "novos", nome: "Novos leads" },
        { id: "standby", nome: "Standby - Follow Up" },
      ],
    });
    cardFindManyMock
      .mockResolvedValueOnce([cardNovoLead])
      .mockResolvedValueOnce([]);
    interacaoFindManyMock.mockResolvedValue([
      { cardId: "card-novo" },
      { cardId: "card-novo" },
    ]);
    historicoFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    updateManyMock.mockResolvedValue({ count: 1 });
    tarefaCreateMock
      .mockResolvedValueOnce({ id: "ligacao-3" })
      .mockResolvedValueOnce({ id: "ligacao-4" })
      .mockResolvedValueOnce({ id: "ligacao-5" });
    historicoCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({
      bpmCard: { updateMany: updateManyMock },
      bpmTarefa: { create: tarefaCreateMock },
      bpmCardHistorico: { create: historicoCreateMock },
    }));
    notificarMock.mockResolvedValue(undefined);
  });

  it("completa somente as tentativas faltantes, registra a execução e emite realtime", async () => {
    const resumo = await executarAutomacaoFollowUpBpm(agora);

    expect(resumo.ligacoesNovosLeads).toEqual({
      examinados: 1,
      tentativasRegistradas: 2,
      tarefasCriadas: 3,
      ignorados: 0,
      falhos: 0,
    });
    expect(cardFindManyMock.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        pipelineId: "pipeline-1",
        status: "ATIVO",
        proximoContatoEm: null,
      }),
    }));
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "card-novo",
        pipelineId: "pipeline-1",
        etapaId: "novos",
        status: "ATIVO",
        proximoContatoEm: null,
        updatedAt: cardNovoLead.updatedAt,
      },
      data: { updatedAt: agora },
    });
    expect(tarefaCreateMock).toHaveBeenCalledTimes(3);
    expect(tarefaCreateMock).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        cardId: "card-novo",
        titulo: "Ligação 3 de 5 — Novos Leads",
        tipo: "LIGACAO",
        prazo: agora,
        alertaEm: agora,
      }),
      select: { id: true },
    });
    expect(historicoCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-novo",
        acao: "NOVOS_LEADS_LIGACOES_PLANEJADAS",
        automacaoOrigem: "novos_leads_5_ligacoes_diarias",
        valorNovoJson: expect.stringContaining("ligacao-5"),
      }),
    });
    expect(notificarMock).toHaveBeenCalledWith({
      pipelineId: "pipeline-1",
      cardId: "card-novo",
      tipo: "TAREFA_ALTERADA",
    });
  });

  it("não duplica o planejamento diário já registrado e respeita a perda do CAS", async () => {
    historicoFindManyMock
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cardId: "card-novo" }]);

    const repetido = await executarAutomacaoFollowUpBpm(agora);
    expect(repetido.ligacoesNovosLeads).toMatchObject({ tarefasCriadas: 0, ignorados: 1 });
    expect(transactionMock).not.toHaveBeenCalled();

    cardFindManyMock.mockReset();
    cardFindManyMock
      .mockResolvedValueOnce([cardNovoLead])
      .mockResolvedValueOnce([]);
    historicoFindManyMock
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    const conflito = await executarAutomacaoFollowUpBpm(agora);
    expect(conflito.ligacoesNovosLeads).toMatchObject({ tarefasCriadas: 0, ignorados: 1 });
    expect(tarefaCreateMock).not.toHaveBeenCalled();
    expect(historicoCreateMock).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("encerra o ciclo no oitavo dia útil enviando o card para Standby sem planejar novas ligações", async () => {
    const cardVencido = {
      ...cardNovoLead,
      createdAt: new Date("2026-08-03T12:00:00.000Z"),
    };
    cardFindManyMock.mockReset();
    cardFindManyMock
      .mockResolvedValueOnce([cardVencido])
      .mockResolvedValueOnce([]);
    historicoFindManyMock
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    interacaoFindManyMock.mockResolvedValue([]);
    updateManyMock.mockResolvedValue({ count: 1 });

    const resumo = await executarAutomacaoFollowUpBpm(new Date("2026-08-13T12:00:00.000Z"));

    expect(resumo).toMatchObject({ movidos: 1, falhos: 0 });
    expect(resumo.ligacoesNovosLeads).toMatchObject({ examinados: 1, tarefasCriadas: 0, ignorados: 1 });
    expect(tarefaCreateMock).not.toHaveBeenCalled();
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        id: "card-novo",
        pipelineId: "pipeline-1",
        etapaId: "novos",
        status: "ATIVO",
        proximoContatoEm: null,
      },
      data: { etapaId: "standby" },
    });
  });
});
