import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    bpmWebhookEntrada: { findUnique: vi.fn(), create: vi.fn() },
    usuarios: { findUnique: vi.fn() },
    bpmEtapa: { findMany: vi.fn() },
    cliente: { upsert: vi.fn() },
    bpmCampo: { findMany: vi.fn() },
    bpmCard: { create: vi.fn() },
    bpmCloserAtribuicao: { create: vi.fn() },
    bpmCardMembro: { create: vi.fn() },
    bpmCardCampoValor: { create: vi.fn(), upsert: vi.fn() },
    bpmCardHistorico: { create: vi.fn() },
  };
  return {
    tx,
    db: { ...tx, $transaction: vi.fn() },
    alocar: vi.fn(),
    registrar: vi.fn(),
    publicar: vi.fn(),
    snapshots: vi.fn(),
    enfileirar: vi.fn(),
    sla: vi.fn(),
    cadencias: vi.fn(),
    notificar: vi.fn(),
    cadenciasImediatas: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: mocks.db }));
vi.mock("@/lib/bpm/atribuicao-closers-server", () => ({
  alocarProximoCloserBpm: mocks.alocar,
  executarComRetryDeAtribuicao: (executar: () => Promise<unknown>) => executar(),
  registrarAtribuicaoDeCardCloserBpm: mocks.registrar,
}));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({
  publicarEventoBpm: mocks.publicar,
  sanitizarPayloadAutomacao: (payload: unknown) => payload,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarSnapshotsCopiaCamposCard: mocks.snapshots }));
vi.mock("@/lib/bpm/automacoes/fila", () => ({ enfileirarAutomacoesCriacaoCardBpm: mocks.enfileirar }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: mocks.sla }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: mocks.cadencias }));
vi.mock("@/lib/bpm/cadencias/executor", () => ({ processarCadenciasImediatasDoCardBpm: mocks.cadenciasImediatas }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));

import { criarCardWebhookSchema, criarCardNovoLeadViaWebhook } from "@/lib/bpm/criar-card-webhook-server";

const parametros = {
  endpointId: "endpoint",
  pipelineId: "pipeline",
  idempotencyKey: "crm-42",
  origemIp: "127.0.0.1",
  dados: criarCardWebhookSchema.parse({
    empresa: { cnpj: "11.222.333/0001-81", razaoSocial: "Empresa de Teste" },
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation((executar: (tx: typeof mocks.tx) => Promise<unknown>) => executar(mocks.tx));
  mocks.tx.bpmWebhookEntrada.findUnique.mockResolvedValue(null);
  mocks.tx.usuarios.findUnique.mockResolvedValue({ email: "closer@example.com" });
  mocks.tx.bpmEtapa.findMany.mockResolvedValue([{ id: "etapa-novos", nome: "Novos Leads", ordem: 1 }]);
  mocks.tx.cliente.upsert.mockResolvedValue({ id: 91 });
  mocks.tx.bpmCampo.findMany.mockResolvedValue([
    { id: "canal", nome: "Canal de origem", tipo: "texto", opcoesJson: null, opcoes: [] },
  ]);
  mocks.tx.bpmCard.create.mockResolvedValue({ id: "card-1", createdAt: new Date("2026-10-26T12:00:00.000Z"), servico: "Revisão de Radar" });
  mocks.publicar.mockResolvedValue({ id: "evento-1", cardId: "card-1" });
  mocks.snapshots.mockResolvedValue({});
  mocks.alocar.mockResolvedValue({ distribuicaoAtiva: true, responsavelId: 17, onlineNaEscolha: true });
});

describe("criação de card pelo webhook", () => {
  it("cria card em Novos Leads e usa a atribuição automática, sem receber responsável do payload", async () => {
    const resultado = await criarCardNovoLeadViaWebhook(parametros);

    expect(resultado).toEqual({
      cardId: "card-1",
      closerEmail: "closer@example.com",
      empresaId: 91,
      pipelineId: "pipeline",
      etapaId: "etapa-novos",
      responsavelId: 17,
      duplicate: false,
    });
    expect(mocks.tx.bpmCard.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pipelineId: "pipeline", etapaId: "etapa-novos", responsavelId: 17 }),
    }));
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({
      pipelineId: "pipeline", cardId: "card-1", responsavelId: 17, onlineNaEscolha: true,
    }));
    expect(mocks.tx.bpmCardMembro.create).toHaveBeenCalledWith({
      data: { cardId: "card-1", userId: 17, role: "RESPONSAVEL" },
    });
    expect(mocks.tx.bpmWebhookEntrada.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ endpointId: "endpoint", statusRecebimento: "PROCESSADO", eventoId: "evento-1" }),
    }));
  });

  it("repetição da chave devolve o mesmo card sem outro turno", async () => {
    const evento = {
      cardId: "card-existente",
      pipelineId: "pipeline",
      valorNovoJson: JSON.stringify({ etapaId: "etapa-novos", responsavelId: 17 }),
      card: { empresaId: 91 },
    };
    mocks.tx.bpmWebhookEntrada.findUnique.mockResolvedValue({ statusRecebimento: "PROCESSADO", evento });

    const resultado = await criarCardNovoLeadViaWebhook(parametros);

    expect(resultado).toEqual({
      cardId: "card-existente",
      closerEmail: "closer@example.com",
      empresaId: 91,
      pipelineId: "pipeline",
      etapaId: "etapa-novos",
      responsavelId: 17,
      duplicate: true,
    });
    expect(mocks.alocar).not.toHaveBeenCalled();
    expect(mocks.tx.bpmCard.create).not.toHaveBeenCalled();
  });

  it("não cria card quando não há closer elegível", async () => {
    mocks.alocar.mockResolvedValue({ distribuicaoAtiva: true, responsavelId: null, onlineNaEscolha: false });

    await expect(criarCardNovoLeadViaWebhook(parametros)).rejects.toMatchObject({
      status: 503,
      codigo: "SEM_CLOSER_ELEGIVEL",
    });
    expect(mocks.tx.bpmCard.create).not.toHaveBeenCalled();
  });

  it("rejeita responsavelId enviado pelo cliente", () => {
    const resultado = criarCardWebhookSchema.safeParse({
      ...parametros.dados,
      responsavelId: 999,
    });
    expect(resultado.success).toBe(false);
  });
});
