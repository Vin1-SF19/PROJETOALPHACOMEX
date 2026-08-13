import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmPipelineMock = vi.hoisted(() => vi.fn());
const usuarioElegivelResponsavelBpmMock = vi.hoisted(() => vi.fn());
const carregarCamposObrigatoriosEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const validarValoresCamposBpmMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn(), create: vi.fn() },
  bpmEtapa: { findUnique: vi.fn() },
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
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: usuarioElegivelResponsavelBpmMock,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposAplicaveisCardEtapa: vi.fn(),
  carregarCamposAplicaveisEtapa: carregarCamposAplicaveisEtapaMock,
  carregarCamposObrigatoriosEtapa: carregarCamposObrigatoriosEtapaMock,
}));
vi.mock("@/lib/bpm/campos-dinamicos", () => ({ validarValoresCamposBpm: validarValoresCamposBpmMock }));

import { CriarCardBpm } from "@/actions/bpm/Cards";

const PIPELINE_ID = "clw0000000000000pipe";
const ETAPA_ID = "clw0000000000000etap";

function mockTransacaoFeliz() {
  prismaMock.$transaction.mockImplementation(async (callback) => callback({
    cliente: prismaMock.cliente,
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
    usuarioElegivelResponsavelBpmMock.mockResolvedValue(true);
    carregarCamposObrigatoriosEtapaMock.mockResolvedValue([]);
    carregarCamposAplicaveisEtapaMock.mockResolvedValue([]);
    validarValoresCamposBpmMock.mockReturnValue({ success: true, valores: {} });
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ pipelineId: PIPELINE_ID, ativo: true });
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
      novaEmpresa: { cnpj: "12.345.678/0001-90", razaoSocial: "Empresa Nova Ltda", nomeFantasia: "Nova", uf: "sp", municipio: "São Paulo" },
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
      data: { empresaId: 501, pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, responsavelId: 7, servico: undefined },
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
      data: { empresaId: 42, pipelineId: PIPELINE_ID, etapaId: ETAPA_ID, responsavelId: 7, servico: undefined },
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
});
