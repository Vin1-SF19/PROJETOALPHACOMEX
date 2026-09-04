import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmPipelineMock = vi.hoisted(() => vi.fn());
const exigirAcessoModuloBpmMock = vi.hoisted(() => vi.fn());
const usuarioElegivelResponsavelBpmMock = vi.hoisted(() => vi.fn());
const carregarCamposObrigatoriosEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const validarValoresCamposBpmMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: notificarPipelineBpmMock }));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: vi.fn(),
  exigirAcessoBpmPipeline: exigirAcessoBpmPipelineMock,
  exigirAcessoModuloBpm: exigirAcessoModuloBpmMock,
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: usuarioElegivelResponsavelBpmMock,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposAplicaveisCardEtapa: vi.fn(),
  carregarSnapshotsCopiaCamposCard: vi.fn().mockResolvedValue({}),
  carregarCamposAplicaveisEtapa: carregarCamposAplicaveisEtapaMock,
  carregarCamposObrigatoriosEtapa: carregarCamposObrigatoriosEtapaMock,
}));
vi.mock("@/lib/bpm/campos-dinamicos", () => ({ validarValoresCamposBpm: validarValoresCamposBpmMock }));

import { BuscarEmpresasBpm, CriarCardBpm } from "@/actions/bpm/Cards";

const PIPELINE_ID = "clw0000000000000pipe";
const ETAPA_ID = "clw0000000000000etap";

function mockTransacaoFeliz() {
  prismaMock.$transaction.mockImplementation(async (callback) => callback({
    cliente: prismaMock.cliente,
    bpmPipeline: prismaMock.bpmPipeline,
    bpmEtapa: prismaMock.bpmEtapa,
    bpmCard: prismaMock.bpmCard,
    bpmCardMembro: prismaMock.bpmCardMembro,
    bpmCardCampoValor: prismaMock.bpmCardCampoValor,
    bpmCardHistorico: prismaMock.bpmCardHistorico,
  }));
}

describe("CriarCardBpm — cadastro de empresa nova (Fase 3.2 Cliente Master)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    exigirAcessoBpmPipelineMock.mockResolvedValue(undefined);
    exigirAcessoModuloBpmMock.mockResolvedValue(undefined);
    usuarioElegivelResponsavelBpmMock.mockResolvedValue(true);
    carregarCamposObrigatoriosEtapaMock.mockResolvedValue([]);
    carregarCamposAplicaveisEtapaMock.mockResolvedValue([]);
    validarValoresCamposBpmMock.mockReturnValue({ success: true, valores: {} });
    prismaMock.bpmPipeline.findUnique.mockResolvedValue({ ativo: true });
    prismaMock.bpmEtapa.findMany.mockResolvedValue([
      { id: ETAPA_ID, nome: "Novos Leads" },
    ]);
    prismaMock.bpmCardMembro.create.mockResolvedValue({});
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    mockTransacaoFeliz();
  });

  it("cria o Cliente e o card atomicamente quando novaEmpresa é informado", async () => {
    // 1ª chamada (fora da tx): CNPJ ainda não existe.
    // 2ª chamada (dentro da tx, reconfirmação de corrida): ainda não existe.
    // 3ª chamada (dentro da tx, valida empresaAtual pelo id recém-criado): já existe.
    prismaMock.cliente.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 501 });
    prismaMock.cliente.create.mockResolvedValue({ id: 501 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-1", empresaId: 501 });

    const resultado = await CriarCardBpm({
      novaEmpresa: { cnpj: "CNPJ: 12.345.678/0001-90", razaoSocial: "Empresa Nova Ltda", nomeFantasia: "Nova", uf: "sp", municipio: "São Paulo" },
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.cliente.create).toHaveBeenCalledWith({
      data: {
        cnpj: "12345678000190",
        razaoSocial: "Empresa Nova Ltda",
        nomeFantasia: "Nova",
        uf: "SP",
        municipio: "São Paulo",
      },
    });
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith({
      data: { empresaId: 501, pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, responsavelId: 7, servico: null },
    });
  });

  it("bloqueia com mensagem clara quando o CNPJ já está cadastrado (checagem fora da transação)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 999 }); // já existe

    const resultado = await CriarCardBpm({
      novaEmpresa: { cnpj: "12.345.678/0001-90", razaoSocial: "Empresa Duplicada Ltda" },
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Já existe uma empresa cadastrada com este CNPJ — busque e selecione-a.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("bloqueia por corrida (CNPJ cadastrado entre a checagem e a transação)", async () => {
    // Passa na checagem inicial (fora da tx)...
    prismaMock.cliente.findUnique.mockResolvedValueOnce(null);
    // ...mas já existe quando a transação reconfirma.
    prismaMock.cliente.findUnique.mockResolvedValueOnce({ id: 999 });

    const resultado = await CriarCardBpm({
      novaEmpresa: { cnpj: "12.345.678/0001-90", razaoSocial: "Empresa Corrida Ltda" },
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Já existe uma empresa cadastrada com este CNPJ — busque e selecione-a.",
    });
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });

  it("continua vinculando empresa já existente via empresaId, sem criar Cliente novo", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-2", empresaId: 42 });

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith({
      data: { empresaId: 42, pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, responsavelId: 7, servico: null },
    });
  });

  it("rejeita payload sem empresaId nem novaEmpresa (schema Zod)", async () => {
    const resultado = await CriarCardBpm({
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ incompleto antes de consultar ou persistir empresa", async () => {
    const resultado = await CriarCardBpm({
      novaEmpresa: { cnpj: "12.345.678/0001", razaoSocial: "Empresa Incompleta Ltda" },
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ com dígitos excedentes antes de consultar ou persistir empresa", async () => {
    const resultado = await CriarCardBpm({
      novaEmpresa: { cnpj: "12.345.678/0001-900", razaoSocial: "Empresa Excedente Ltda" },
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado.success).toBe(false);
    expect(prismaMock.cliente.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.cliente.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita destino fora da etapa canônica antes de persistir", async () => {
    prismaMock.bpmEtapa.findMany.mockResolvedValue([
      { id: ETAPA_ID, nome: "Fechado" },
      { id: "clw0000000000000novo", nome: "Novos Leads" },
    ]);

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Novos cards só podem ser criados na etapa Novos Leads.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("rejeita chamada direta se Novos Leads não estiver na primeira etapa ativa", async () => {
    prismaMock.bpmEtapa.findMany.mockResolvedValue([
      { id: "clw0000000000000ante", nome: "Entrada anterior", ordem: 1 },
      { id: ETAPA_ID, nome: "Novos Leads", ordem: 2 },
    ]);

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "Novos cards só podem ser criados na etapa Novos Leads.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });

  it("rejeita drift transacional sem efeitos nem realtime", async () => {
    prismaMock.bpmEtapa.findMany
      .mockResolvedValueOnce([{ id: ETAPA_ID, nome: "Novos Leads" }])
      .mockResolvedValueOnce([{ id: ETAPA_ID, nome: "Fechado" }]);
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado).toEqual({
      success: false,
      error: "A etapa Novos Leads mudou durante a criação. Recarregue e tente novamente.",
    });
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardMembro.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("ignora payload legado sem validar nem persistir controles de etapa", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.bpmCard.create.mockResolvedValue({ id: "card-legado", empresaId: 42 });

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
      camposValores: { clw0000000000000camp: "não persistir" },
      proximoContatoEm: "2026-08-20T15:00:00.000Z",
      statusPosFechamento: "CONTRATO_ASSINADO",
    });

    expect(resultado.success).toBe(true);
    expect(validarValoresCamposBpmMock).not.toHaveBeenCalled();
    expect(carregarCamposObrigatoriosEtapaMock).not.toHaveBeenCalled();
    expect(carregarCamposAplicaveisEtapaMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.createMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith({
      data: {
        empresaId: 42,
        pipelineId: PIPELINE_ID,
        etapaId: ETAPA_ID,
        responsavelId: 7,
        servico: null,
      },
    });
  });

  it("nega sessão antes de consultar o contexto de criação", async () => {
    authMock.mockResolvedValueOnce(null);

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: ETAPA_ID,
      responsavelId: 7,
    });

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.bpmPipeline.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("BuscarEmpresasBpm — CNPJ canônico", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7" } });
    exigirAcessoModuloBpmMock.mockResolvedValue(undefined);
    prismaMock.cliente.findMany.mockResolvedValue([]);
  });

  it("gera a mesma busca por CNPJ para entrada formatada e crua", async () => {
    await BuscarEmpresasBpm("12.345.678/0001-90");
    await BuscarEmpresasBpm("12345678000190");

    expect(prismaMock.cliente.findMany).toHaveBeenCalledTimes(2);
    for (const chamada of prismaMock.cliente.findMany.mock.calls) {
      expect(chamada[0].where.OR[2]).toEqual({
        cnpj: { contains: "12345678000190" },
      });
    }
  });
});
