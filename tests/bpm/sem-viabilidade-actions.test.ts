import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoPipelineMock = vi.hoisted(() => vi.fn());
const elegivelMock = vi.hoisted(() => vi.fn());
const aplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const obrigatoriosEtapaMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn(), create: vi.fn() },
  bpmPipeline: { findUnique: vi.fn() },
  bpmEtapa: { findUnique: vi.fn(), findMany: vi.fn() },
  bpmCard: { create: vi.fn() },
  bpmCardMembro: { create: vi.fn() },
  bpmCardCampoValor: { createMany: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarMock }));
vi.mock("@/lib/bpm/automacoes", () => ({ executarAutomacaoFechamentoComercial: vi.fn() }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: vi.fn(),
  exigirAcessoBpmPipeline: acessoPipelineMock,
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: elegivelMock,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposAplicaveisCardEtapa: vi.fn(),
  carregarSnapshotsCopiaCamposCard: vi.fn().mockResolvedValue({}),
  carregarCamposAplicaveisEtapa: aplicaveisEtapaMock,
  carregarCamposObrigatoriosEtapa: obrigatoriosEtapaMock,
}));
vi.mock("@/lib/bpm/sla", () => ({
  criarSlaInstancia: vi.fn().mockResolvedValue(null),
  obterStatusSlaCards: vi.fn().mockResolvedValue(new Map()),
  prioridadeStatusSla: vi.fn().mockReturnValue(0),
  sincronizarSlaMovimentoBpm: vi.fn().mockResolvedValue(undefined),
}));

import { CriarCardBpm } from "@/actions/bpm/Cards";

const PIPELINE = "clw0000000000000pipe";
const ETAPA = "clw0000000000000etap";
const CARD = "clw0000000000000card";
const PROXIMO_CONTATO = new Date("2026-08-20T15:00:00.000Z");

describe("CriarCardBpm em etapa que exige Proximo Contato", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoPipelineMock.mockResolvedValue(undefined);
    elegivelMock.mockResolvedValue(true);
    obrigatoriosEtapaMock.mockResolvedValue([]);
    aplicaveisEtapaMock.mockResolvedValue([]);
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.bpmCardMembro.create.mockResolvedValue({});
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    prismaMock.bpmCard.create.mockResolvedValue({ id: CARD });
    notificarMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.bpmPipeline.findUnique.mockResolvedValue({ ativo: true });
    prismaMock.bpmEtapa.findMany.mockResolvedValue([
      { id: ETAPA, nome: "Sem Viabilidade" },
      { id: "clw0000000000000novo", nome: "Novos Leads" },
    ]);
  });

  it("bloqueia Sem Viabilidade sem data antes da transacao e sem efeitos", async () => {
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      pipelineId: PIPELINE,
      nome: "Sem Viabilidade",
    });

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: ETAPA,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Novos cards só podem ser criados na etapa Novos Leads.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardMembro.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("persiste a data e audita somente que o requisito foi configurado", async () => {
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      pipelineId: PIPELINE,
      nome: "Sem Viabilidade",
      ativo: true,
    });

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: ETAPA,
      responsavelId: 7,
      proximoContatoEm: PROXIMO_CONTATO.toISOString(),
    });

    expect(resultado).toEqual({ success: false, error: "Novos cards só podem ser criados na etapa Novos Leads." });
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });

  it("falha no drift transacional para etapa exigente sem efeitos parciais", async () => {
    prismaMock.bpmEtapa.findMany
      .mockResolvedValueOnce([{ id: ETAPA, nome: "Novos Leads" }])
      .mockResolvedValueOnce([{ id: ETAPA, nome: "Sem Viabilidade" }]);

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: ETAPA,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "A etapa Novos Leads mudou durante a criação. Recarregue e tente novamente.",
    });
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardMembro.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.createMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("nega sessao e acesso antes de qualquer persistencia", async () => {
    authMock.mockResolvedValueOnce(null);
    const semSessao = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: ETAPA,
      responsavelId: 7,
    });
    expect(semSessao).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();

    authMock.mockResolvedValueOnce({ user: { id: "7", role: "COMERCIAL" } });
    acessoPipelineMock.mockRejectedValueOnce(new Error("Não autorizado"));
    const semAcesso = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: ETAPA,
      responsavelId: 7,
    });
    expect(semAcesso).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("mantem criacao em etapa alheia sem exigir ou persistir a data", async () => {
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      pipelineId: PIPELINE,
      nome: "Novos Leads",
      ativo: true,
    });
    prismaMock.bpmEtapa.findMany.mockResolvedValue([{ id: ETAPA, nome: "Novos Leads" }]);

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: ETAPA,
      responsavelId: 7,
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith({
      data: {
        empresaId: 42,
        pipelineId: PIPELINE,
        etapaId: ETAPA,
        responsavelId: 7,
        servico: null,
      },
    });
  });
});
