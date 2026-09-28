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
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn().mockResolvedValue({ alteradas: 0 }) }));
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
  verificarTransicaoPermitidaBpm: vi.fn().mockResolvedValue({ permitida: true }),
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

describe("automação operacional de uma ligação em cada dia útil", () => {
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
    interacaoFindManyMock.mockResolvedValue([]);
    historicoFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    updateManyMock.mockResolvedValue({ count: 1 });
    tarefaCreateMock.mockResolvedValue({ id: "ligacao-1" });
    historicoCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) => callback({
      bpmCard: { updateMany: updateManyMock },
      bpmTarefa: { create: tarefaCreateMock },
      bpmCardHistorico: { create: historicoCreateMock },
    }));
    notificarMock.mockResolvedValue(undefined);
  });

  it("cria uma tarefa, registra a execução e emite realtime", async () => {
    const resumo = await executarAutomacaoFollowUpBpm(agora);

    expect(resumo.ligacoesNovosLeads).toEqual({
      examinados: 1,
      tentativasRegistradas: 0,
      tarefasCriadas: 1,
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
    expect(tarefaCreateMock).toHaveBeenCalledTimes(1);
    expect(tarefaCreateMock).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        cardId: "card-novo",
        titulo: "Ligação do dia 1 de 8 — Novo Lead",
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
        automacaoOrigem: "novos_leads_1_ligacao_diaria",
        valorNovoJson: expect.stringContaining("ligacao-1"),
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

  it("não cria tarefa se a ligação do dia já foi registrada", async () => {
    interacaoFindManyMock.mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cardId: "card-novo" }]);
    const resumo = await executarAutomacaoFollowUpBpm(agora);
    expect(resumo.ligacoesNovosLeads).toMatchObject({
      tentativasRegistradas: 1, tarefasCriadas: 0, ignorados: 1,
    });
    expect(tarefaCreateMock).not.toHaveBeenCalled();
  });

  it("não move ao fim do ciclo se faltar registro em um dia útil", async () => {
    cardFindManyMock.mockReset()
      .mockResolvedValueOnce([{ ...cardNovoLead, createdAt: new Date("2026-08-03T12:00:00.000Z") }])
      .mockResolvedValueOnce([]);
    const datas = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11"];
    interacaoFindManyMock.mockReset()
      .mockResolvedValueOnce(datas.map((data) => ({
        cardId: "card-novo", createdAt: new Date(`${data}T15:00:00.000Z`),
      })))
      .mockResolvedValueOnce([]);
    const resumo = await executarAutomacaoFollowUpBpm(new Date("2026-08-13T12:00:00.000Z"));
    expect(resumo.movidos).toBe(0);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(tarefaCreateMock).not.toHaveBeenCalled();
  });

  it("envia para Stand By só após oito datas úteis com ligações registradas", async () => {
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
    const datas = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11", "2026-08-12"];
    interacaoFindManyMock.mockResolvedValueOnce(datas.map((data) => ({
      cardId: "card-novo", createdAt: new Date(`${data}T15:00:00.000Z`),
    }))).mockResolvedValueOnce([]);
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
