import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisCardEtapaMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  bpmCardCampoValor: { upsert: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
  bpmCardMembro: { updateMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({
  notificarPipelineBpm: notificarPipelineBpmMock,
}));
vi.mock("@/lib/bpm/automacoes", () => ({
  executarAutomacaoFechamentoComercial: vi.fn(),
}));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  exigirAcessoBpmPipeline: vi.fn(),
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: vi.fn(),
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposAplicaveisCardEtapa: carregarCamposAplicaveisCardEtapaMock,
  carregarCamposAplicaveisEtapa: vi.fn(),
  carregarCamposObrigatoriosEtapa: vi.fn(),
}));

import { AtualizarCardBpm } from "@/actions/bpm/Cards";

const CARD_ID = "clw0000000000000card";
const PIPELINE_ID = "clw0000000000000pipe";
const ETAPA_ID = "clw0000000000000etap";
const CAMPO_ID = "clw0000000000000camp";
const CAMPO_FORA_ID = "clw0000000000000fora";
const UPDATED_AT = new Date("2026-08-13T12:00:00.000Z");

const campoNulo = {
  id: CAMPO_ID,
  pipelineId: PIPELINE_ID,
  etapaId: ETAPA_ID,
  nome: "Necessidade atual",
  tipo: "texto",
  opcoesJson: null,
  obrigatorio: true,
  ordem: 1,
  valor: null,
};

function cardNaEtapaAtual(updatedAt = UPDATED_AT) {
  return {
    id: CARD_ID,
    pipelineId: PIPELINE_ID,
    etapaId: ETAPA_ID,
    status: "ATIVO",
    updatedAt,
    responsavelId: 7,
    servico: null,
    statusPosFechamento: null,
    proximoContatoEm: null,
    etapa: { nome: "Novos Leads" },
  };
}

describe("CRM - edição dos campos definidos da etapa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true });
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([campoNulo]);
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardNaEtapaAtual());
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardCampoValor.upsert.mockResolvedValue({});
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    notificarPipelineBpmMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it("faz upsert de um campo inicialmente nulo sob CAS e notifica somente depois do histórico", async () => {
    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      camposValores: { [CAMPO_ID]: "  Qualificado  " },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: CARD_ID,
        etapaId: ETAPA_ID,
        status: "ATIVO",
        updatedAt: UPDATED_AT,
      }),
      data: expect.objectContaining({ updatedAt: expect.any(Date) }),
    });
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith({
      where: { cardId_campoId: { cardId: CARD_ID, campoId: CAMPO_ID } },
      create: { cardId: CARD_ID, campoId: CAMPO_ID, valor: "Qualificado" },
      update: { valor: "Qualificado" },
    });
    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: CARD_ID,
        acao: "CARD_ATUALIZADO",
        valorNovoJson: expect.stringContaining(CAMPO_ID),
      }),
    });
    expect(notificarPipelineBpmMock).toHaveBeenCalledWith({
      pipelineId: PIPELINE_ID,
      cardId: CARD_ID,
      tipo: "CARD_ATUALIZADO",
    });
    expect(notificarPipelineBpmMock).toHaveBeenCalledAfter(prismaMock.bpmCardHistorico.create);
  });

  it("rejeita campo que não pertence à etapa atual sem escrita parcial nem realtime", async () => {
    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      camposValores: { [CAMPO_FORA_ID]: "intruso" },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual({
      success: false,
      error: "Um ou mais campos não pertencem a este contexto.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("recusa versão desatualizada antes da transação e sem notificar", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(
      cardNaEtapaAtual(new Date(UPDATED_AT.getTime() + 1_000)),
    );

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      camposValores: { [CAMPO_ID]: "novo valor" },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual({
      success: false,
      error: "O card mudou enquanto era editado. Recarregue e tente novamente.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });
});

describe("PainelCamposEtapaAtual", () => {
  const raiz = process.cwd();
  const painel = readFileSync(
    resolve(raiz, "src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx"),
    "utf8",
  );
  const input = readFileSync(
    resolve(raiz, "src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx"),
    "utf8",
  );

  it("renderiza a definição inclusive valor nulo, sinaliza obrigatório e envia o payload atual", () => {
    expect(painel).toContain('map((campo) => [campo.id, campo.valor ?? ""])');
    expect(painel).toContain('campo.obrigatorio ? " *" : ""');
    expect(painel).toContain("montarPayloadCamposDestino(camposAlterados, valoresCamposAtuais)");
    expect(painel).toContain("<CampoBpmInput");
    expect(input).toContain("required={campo.obrigatorio}");
    expect(input).toContain("aria-required={campo.obrigatorio}");
  });
});
