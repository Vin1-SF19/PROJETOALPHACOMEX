import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmPipelineMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const usuarioElegivelResponsavelBpmMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  bpmPipeline: { findFirst: vi.fn() },
  bpmEtapa: { findFirst: vi.fn() },
  usuarios: { findUnique: vi.fn() },
  nolossLead: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  cliente: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  bpmCard: { create: vi.fn(), findUnique: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  bpmCampo: { findMany: vi.fn() },
  bpmCardCampoValor: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn().mockResolvedValue({ alteradas: 0 }) }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarPipelineBpmMock }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ verificarTransicaoPermitidaBpm: vi.fn().mockResolvedValue({ permitida: true }) }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  exigirAcessoBpmPipeline: exigirAcessoBpmPipelineMock,
  usuarioElegivelResponsavelBpm: usuarioElegivelResponsavelBpmMock,
}));

import { PreencherCnpjCardNoloss, PromoverNolossLead } from "@/actions/bpm/NolossLeads";

const NOLOSS_LEAD_ID = "clw0000000000000lead";
const ETAPA_ID = "clw0000000000000etap";
const ETAPA_UI_ID = "draft-stage-3dc45c6e-2b99-4fd7-bb41-0adfd47ba162";
const PIPELINE_ID = "clw0000000000000pipe";

function mockTransacaoFeliz() {
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
}

describe("PromoverNolossLead — cria Cliente+BpmCard a partir do lead do NoLoss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    exigirAcessoBpmPipelineMock.mockResolvedValue(undefined);
    exigirAcessoBpmCardMock.mockResolvedValue(undefined);
    usuarioElegivelResponsavelBpmMock.mockResolvedValue(true);
    prismaMock.bpmPipeline.findFirst.mockResolvedValue({ id: PIPELINE_ID });
    prismaMock.bpmEtapa.findFirst.mockResolvedValue({ id: ETAPA_ID, nome: "Novo Lead", visibilidades: [] });
    prismaMock.bpmCampo.findMany.mockResolvedValue([
      { id: "radar", nome: "Radar pretendido", tipo: "selecao", opcoesJson: null, opcoes: [{ rotulo: "Revisão de Radar Ilimitado" }] },
      { id: "canal", nome: "Canal de origem", tipo: "texto", opcoesJson: null, opcoes: [] },
      { id: "qualificacao", nome: "Qualificação", tipo: "selecao", opcoesJson: null, opcoes: [] },
    ]);
    prismaMock.usuarios.findUnique.mockResolvedValue({ role: "COMERCIAL" });
    mockTransacaoFeliz();
  });

  it("promove o lead pendente, cria Cliente+BpmCard e marca como promoted", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue({
      id: NOLOSS_LEAD_ID,
      status: "pending",
      nome: "Lead Teste",
      email: "lead@teste.com",
    });
    prismaMock.nolossLead.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cliente.create.mockResolvedValue({ id: 501 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-1" });

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: true, data: { cardId: "card-1" } });
    expect(prismaMock.cliente.create).toHaveBeenCalledWith({
      data: { razaoSocial: "Lead Teste", cnpj: null, status: "ATIVO" },
      select: { id: true },
    });
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith({
      data: {
        empresaId: 501,
        pipelineId: PIPELINE_ID,
        etapaId: ETAPA_ID,
        responsavelId: 7,
        status: "ATIVO",
      },
      select: { id: true },
    });
    expect(prismaMock.nolossLead.update).toHaveBeenCalledWith({
      where: { id: NOLOSS_LEAD_ID },
      data: expect.objectContaining({
        promotedClienteId: 501,
        promotedCardId: "card-1",
        promotedByUserId: 7,
      }),
    });
    expect(notificarPipelineBpmMock).toHaveBeenCalledWith({
      pipelineId: PIPELINE_ID,
      cardId: "card-1",
      tipo: "CARD_CRIADO",
    });
  });

  it("promove o lead para uma etapa criada pela UI", async () => {
    prismaMock.bpmEtapa.findFirst.mockResolvedValue({ id: ETAPA_UI_ID, nome: "Agendar Reunião", visibilidades: [] });
    prismaMock.nolossLead.findUnique.mockResolvedValue({
      id: NOLOSS_LEAD_ID, status: "pending", nome: "Lead Teste", email: null,
    });
    prismaMock.nolossLead.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cliente.create.mockResolvedValue({ id: 501 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-1" });

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_UI_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.bpmEtapa.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: ETAPA_UI_ID, pipelineId: PIPELINE_ID, ativo: true },
    }));
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ etapaId: ETAPA_UI_ID }),
    }));
  });

  it("rejeita quando o lead já foi processado (status !== pending)", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue({
      id: NOLOSS_LEAD_ID,
      status: "promoted",
      nome: "Lead Teste",
      email: "lead@teste.com",
    });

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Lead não encontrado ou já processado" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
  });

  it("rejeita quando o lead não existe", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue(null);

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Lead não encontrado ou já processado" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita por corrida quando o CAS não reserva exatamente 1 linha (double-click / promoção concorrente)", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue({
      id: NOLOSS_LEAD_ID,
      status: "pending",
      nome: "Lead Teste",
      email: "lead@teste.com",
    });
    // Outra promoção concorrente já consumiu o lead entre a leitura e o CAS.
    prismaMock.nolossLead.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Lead não encontrado ou já processado" });
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });

  it("rejeita quando o pipeline Revisão de Radar não existe", async () => {
    prismaMock.bpmPipeline.findFirst.mockResolvedValue(null);

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Pipeline Revisão de Radar não encontrado" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita etapaDestinoId que não pertence ao pipeline Revisão de Radar (tenant isolation)", async () => {
    prismaMock.bpmEtapa.findFirst.mockResolvedValue(null);

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Etapa de destino inválida" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita promoção quando o perfil não pode agir na etapa de destino", async () => {
    prismaMock.bpmEtapa.findFirst.mockResolvedValue({
      id: ETAPA_ID,
      nome: "Novo Lead",
      visibilidades: [{ perfil: "COMERCIAL", podeVer: true, podeAgir: false }],
    });

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({
      success: false,
      error: "Seu perfil não pode agir na etapa de destino.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita responsável inelegível para o pipeline", async () => {
    usuarioElegivelResponsavelBpmMock.mockResolvedValue(false);

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 999,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Responsável inválido para este pipeline." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("nega sessão antes de consultar o pipeline", async () => {
    authMock.mockResolvedValueOnce(null);

    const resultado = await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.bpmPipeline.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita payload inválido (Zod) antes de qualquer acesso ao banco", async () => {
    const resultado = await PromoverNolossLead({
      nolossLeadId: "invalido",
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.bpmPipeline.findFirst).not.toHaveBeenCalled();
  });

  it("razaoSocial cai para email, e depois para 'Lead sem nome', quando faltam dados", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue({
      id: NOLOSS_LEAD_ID,
      status: "pending",
      nome: null,
      email: null,
    });
    prismaMock.nolossLead.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cliente.create.mockResolvedValue({ id: 502 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-2" });

    await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(prismaMock.cliente.create).toHaveBeenCalledWith({
      data: { razaoSocial: "Lead sem nome", cnpj: null, status: "ATIVO" },
      select: { id: true },
    });
  });

  it("usa o email como razaoSocial quando não há nome", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue({
      id: NOLOSS_LEAD_ID,
      status: "pending",
      nome: null,
      email: "so-email@teste.com",
    });
    prismaMock.nolossLead.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.cliente.create.mockResolvedValue({ id: 503 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-3" });

    await PromoverNolossLead({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
      radarPretendido: "Revisão de Radar Ilimitado",
    });

    expect(prismaMock.cliente.create).toHaveBeenCalledWith({
      data: { razaoSocial: "so-email@teste.com", cnpj: null, status: "ATIVO" },
      select: { id: true },
    });
  });
});

describe("PreencherCnpjCardNoloss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    exigirAcessoBpmCardMock.mockResolvedValue(undefined);
    mockTransacaoFeliz();
    prismaMock.bpmCard.findUnique.mockResolvedValue({
      empresaId: 501,
      pipelineId: PIPELINE_ID,
      empresa: { cnpj: null },
      pipeline: { nome: "Revisão de Radar" },
      nolossLeadOrigem: [{ id: NOLOSS_LEAD_ID }],
    });
    prismaMock.cliente.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
  });

  it("recusa CNPJ inválido antes de consultar o card", async () => {
    expect(await PreencherCnpjCardNoloss("card-1", "11.111.111/1111-11"))
      .toEqual({ success: false, error: "Informe um CNPJ válido." });
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
  });

  it("recusa card que não tem origem NoLoss", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValueOnce({
      empresaId: 501, pipelineId: PIPELINE_ID, empresa: { cnpj: null },
      pipeline: { nome: "Revisão de Radar" }, nolossLeadOrigem: [],
    });
    expect(await PreencherCnpjCardNoloss("card-1", "11.222.333/0001-81"))
      .toEqual({ success: false, error: "Card de origem NoLoss não encontrado." });
    expect(prismaMock.cliente.updateMany).not.toHaveBeenCalled();
  });

  it("salva CNPJ opcional de card NoLoss e registra histórico sem expor o número", async () => {
    expect(await PreencherCnpjCardNoloss("card-1", "11.222.333/0001-81"))
      .toEqual({ success: true });
    expect(prismaMock.cliente.updateMany).toHaveBeenCalledWith({
      where: { id: 501, cnpj: null }, data: { cnpj: "11222333000181" },
    });
    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledWith({ data: {
      cardId: "card-1", acao: "CNPJ_PREENCHIDO_NOLOSS", usuarioId: 7,
      valorNovoJson: "{\"preenchido\":true}",
    } });
  });
});
