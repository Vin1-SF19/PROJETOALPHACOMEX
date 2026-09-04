import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOTIVOS_LOST } from "@/lib/bpm/lost";
import {
  MAX_CAMPOS_VALORES_BPM,
  atualizarCardSchema,
  criarCardSchema,
  salvarRequisitosEMoverCardSchema,
} from "@/lib/validations/bpm";

const authMock = vi.hoisted(() => vi.fn());
const acessoCardMock = vi.hoisted(() => vi.fn());
const acessoPipelineMock = vi.hoisted(() => vi.fn());
const elegivelMock = vi.hoisted(() => vi.fn());
const aplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const aplicaveisCardEtapaMock = vi.hoisted(() => vi.fn());
const obrigatoriosEtapaMock = vi.hoisted(() => vi.fn());
const notificarMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn(), create: vi.fn() },
  bpmPipeline: { findUnique: vi.fn() },
  bpmCampo: { findMany: vi.fn() },
  bpmCampoObrigatorioEtapa: { findMany: vi.fn() },
  bpmCardCampoValor: { findMany: vi.fn(), upsert: vi.fn(), createMany: vi.fn() },
  bpmEtapa: { findUnique: vi.fn(), findMany: vi.fn() },
  bpmCard: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  bpmEtapaTransicaoPermitida: { findMany: vi.fn() },
  bpmChecklistFollowUp: { findFirst: vi.fn() },
  bpmCardMembro: { create: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
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
  exigirAcessoBpmCard: acessoCardMock,
  exigirAcessoBpmPipeline: acessoPipelineMock,
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: elegivelMock,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposAplicaveisEtapa: aplicaveisEtapaMock,
  carregarSnapshotsCopiaCamposCard: vi.fn().mockResolvedValue({}),
  carregarCamposAplicaveisCardEtapa: aplicaveisCardEtapaMock,
  carregarCamposObrigatoriosEtapa: obrigatoriosEtapaMock,
  verificarTransicaoPermitidaBpm: vi.fn().mockResolvedValue({ permitida: true }),
}));

import {
  AtualizarCardBpm,
  CriarCardBpm,
  MoverCardBpm,
  ObterRequisitosTransicaoBpm,
  SalvarRequisitosEMoverCardBpm,
} from "@/actions/bpm/Cards";

const PIPELINE = "clw0000000000000pipe";
const ORIGEM = "clw0000000000000orig";
const LOST = "clw0000000000000lost";
const CARD = "clw0000000000000card";
const MOTIVO = "clw0000000000000moti";
const OUTRO = "clw0000000000000outr";
const UPDATED_AT = new Date("2026-08-13T12:00:00.000Z");

const camposPipeline = [
  { id: MOTIVO, pipelineId: PIPELINE, etapaId: null, nome: "Motivo de Lost", tipo: "selecao", opcoesJson: JSON.stringify(MOTIVOS_LOST), obrigatorio: false, ordem: 1 },
  { id: OUTRO, pipelineId: PIPELINE, etapaId: null, nome: "Motivo de Lost - Outro", tipo: "texto", opcoesJson: null, obrigatorio: false, ordem: 2 },
];
const motivoAplicavel = { ...camposPipeline[0], obrigatorio: true, valor: null };

function cardOrigem() {
  return {
    id: CARD,
    pipelineId: PIPELINE,
    etapaId: ORIGEM,
    status: "ATIVO",
    updatedAt: UPDATED_AT,
    dataReuniao: null,
    transcricaoReuniao: "recebida",
    proximoContatoEm: null,
    etapa: { nome: "Reunião Agendada" },
  };
}

function cardLost(motivo = "Sem resposta") {
  return {
    ...cardOrigem(),
    etapaId: LOST,
    etapa: { nome: "Lost" },
    motivo,
  };
}

describe("actions de Lost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoCardMock.mockResolvedValue({ autorizado: true });
    acessoPipelineMock.mockResolvedValue(undefined);
    elegivelMock.mockResolvedValue(true);
    obrigatoriosEtapaMock.mockResolvedValue([{ id: MOTIVO, nome: "Motivo de Lost" }]);
    aplicaveisEtapaMock.mockResolvedValue([motivoAplicavel]);
    aplicaveisCardEtapaMock.mockResolvedValue([motivoAplicavel]);
    prismaMock.bpmCampo.findMany.mockResolvedValue(camposPipeline);
    prismaMock.bpmCampoObrigatorioEtapa.findMany.mockResolvedValue([{ campoId: MOTIVO }]);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([]);
    prismaMock.bpmCardCampoValor.upsert.mockResolvedValue({});
    prismaMock.bpmEtapaTransicaoPermitida.findMany.mockResolvedValue([]);
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.bpmPipeline.findUnique.mockResolvedValue({ ativo: true });
    prismaMock.bpmEtapa.findMany.mockResolvedValue([
      { id: "clw0000000000000novo", nome: "Novos Leads" },
      { id: LOST, nome: "Lost" },
    ]);
  });

  it("bloqueia criação direta em Lost sem motivo antes da transação", async () => {
    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: LOST,
      responsavelId: 7,
      camposValores: {},
    });
    expect(resultado).toEqual({
      success: false,
      error: "Novos cards só podem ser criados na etapa Novos Leads.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("rejeita criação direta em Lost mesmo quando o motivo está preenchido", async () => {
    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: LOST,
      responsavelId: 7,
      camposValores: { [MOTIVO]: "Sem resposta" },
    });

    expect(resultado).toEqual({ success: false, error: "Novos cards só podem ser criados na etapa Novos Leads." });
    expect(prismaMock.bpmCardCampoValor.createMany).not.toHaveBeenCalled();
  });

  it("rejeita criação direta em Lost mesmo com Outro e companion válido", async () => {
    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: LOST,
      responsavelId: 7,
      camposValores: {
        [MOTIVO]: "Outro",
        [OUTRO]: "Empresa encerrou o projeto",
      },
    });

    expect(resultado).toEqual({ success: false, error: "Novos cards só podem ser criados na etapa Novos Leads." });
    expect(prismaMock.bpmCardCampoValor.createMany).not.toHaveBeenCalled();
  });

  it("não consulta configuração de Lost ao rejeitar criação direta", async () => {
    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: LOST,
      responsavelId: 7,
      camposValores: { [MOTIVO]: "Sem resposta" },
    });

    expect(resultado).toEqual({
      success: false,
      error: "Novos cards só podem ser criados na etapa Novos Leads.",
    });
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.createMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(prismaMock.bpmCampo.findMany).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("rejeita payload com mais de 100 campos antes de consultar ou persistir", async () => {
    const camposValores = Object.fromEntries(
      Array.from({ length: 101 }, (_, indice) => [
        `clw${indice.toString(36).padStart(18, "0")}`,
        "valor",
      ]),
    );
    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: LOST,
      responsavelId: 7,
      camposValores,
    });
    expect(resultado.success).toBe(false);
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("aplica o mesmo cap de campos em criar, atualizar e salvar requisitos", () => {
    const camposValores = Object.fromEntries(
      Array.from({ length: MAX_CAMPOS_VALORES_BPM + 1 }, (_, indice) => [
        `clw${indice.toString(36).padStart(18, "0")}`,
        "valor",
      ]),
    );
    expect(criarCardSchema.safeParse({
      empresaId: 42,
      pipelineId: PIPELINE,
      etapaId: LOST,
      responsavelId: 7,
      camposValores,
    }).success).toBe(true);
    expect(atualizarCardSchema.safeParse({ cardId: CARD, camposValores }).success).toBe(false);
    expect(salvarRequisitosEMoverCardSchema.safeParse({
      cardId: CARD,
      etapaDestinoId: LOST,
      camposValores,
    }).success).toBe(false);
  });

  it("bloqueia drag para Lost quando não há motivo persistido", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardOrigem());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });
    const resultado = await MoverCardBpm({ cardId: CARD, etapaDestinoId: LOST });
    expect(resultado.success).toBe(false);
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("permite drag quando o motivo válido já está persistido", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardOrigem());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([
      { campoId: MOTIVO, valor: "Sem resposta" },
    ]);

    const resultado = await MoverCardBpm({ cardId: CARD, etapaDestinoId: LOST });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ etapaId: LOST }) }),
    );
  });

  it("deixa o rascunho do modal resolver o motivo sem manter uma guarda persistida obsoleta", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardOrigem());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });

    const resultado = await ObterRequisitosTransicaoBpm(CARD, LOST);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.campos.map((campo) => campo.id)).toEqual(
      expect.arrayContaining([MOTIVO, OUTRO]),
    );
    expect(resultado.data?.guardas).not.toContain(
      "Informe o Motivo de Lost antes de concluir a movimentação.",
    );
  });

  it("exige companion no modal para Outro e persiste ambos atomicamente", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardOrigem());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });
    const semTexto = await SalvarRequisitosEMoverCardBpm({
      cardId: CARD,
      etapaDestinoId: LOST,
      camposValores: { [MOTIVO]: "Outro" },
    });
    expect(semTexto).toEqual({ success: false, error: "Descreva o Motivo de Lost - Outro." });

    const comTexto = await SalvarRequisitosEMoverCardBpm({
      cardId: CARD,
      etapaDestinoId: LOST,
      camposValores: { [MOTIVO]: "Outro", [OUTRO]: "Mudou a estratégia" },
    });
    expect(comTexto).toEqual({ success: true });
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ etapaId: LOST }),
    }));
    expect(notificarMock).toHaveBeenCalledAfter(prismaMock.bpmCardHistorico.create);
  });

  it("falha fechada se a configuração mudar dentro da transação", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardOrigem());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });
    prismaMock.bpmCampo.findMany
      .mockResolvedValueOnce(camposPipeline)
      .mockResolvedValueOnce([{ ...camposPipeline[0], opcoesJson: "[]" }, camposPipeline[1]]);
    const resultado = await SalvarRequisitosEMoverCardBpm({
      cardId: CARD,
      etapaDestinoId: LOST,
      camposValores: { [MOTIVO]: "Sem resposta" },
    });
    expect(resultado).toEqual({
      success: false,
      error: "A configuração da etapa Lost está inconsistente. Contate um administrador.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("edita Lost com Outro sob CAS e rejeita limpeza do companion", async () => {
    const atual = cardLost();
    prismaMock.bpmCard.findUnique.mockResolvedValue(atual);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([
      { campoId: MOTIVO, valor: "Sem resposta" },
      { campoId: OUTRO, valor: null },
    ]);

    const sucesso = await AtualizarCardBpm({
      cardId: CARD,
      versaoEsperadaEm: UPDATED_AT,
      camposValores: { [MOTIVO]: "Outro", [OUTRO]: "Decisão interna" },
    });
    expect(sucesso).toEqual({ success: true });
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    acessoCardMock.mockResolvedValue({ autorizado: true });
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardLost("Outro"));
    aplicaveisCardEtapaMock.mockResolvedValue([motivoAplicavel]);
    prismaMock.bpmCampo.findMany.mockResolvedValue(camposPipeline);
    prismaMock.bpmCampoObrigatorioEtapa.findMany.mockResolvedValue([{ campoId: MOTIVO }]);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([
      { campoId: MOTIVO, valor: "Outro" },
      { campoId: OUTRO, valor: "Decisão interna" },
    ]);
    const limpeza = await AtualizarCardBpm({
      cardId: CARD,
      versaoEsperadaEm: UPDATED_AT,
      camposValores: { [OUTRO]: "" },
    });
    expect(limpeza).toEqual({
      success: false,
      error: "Descreva o Motivo de Lost - Outro.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("rejeita edição Lost stale pelo CAS antes da transação", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue({
      ...cardLost(),
      updatedAt: new Date(UPDATED_AT.getTime() + 1_000),
    });
    const resultado = await AtualizarCardBpm({
      cardId: CARD,
      versaoEsperadaEm: UPDATED_AT,
      camposValores: { [MOTIVO]: "Sem resposta" },
    });
    expect(resultado).toEqual({
      success: false,
      error: "O card mudou enquanto era editado. Recarregue e tente novamente.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("falha fechada no drift de configuração dentro da transação de edição", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardLost());
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([
      { campoId: MOTIVO, valor: "Sem resposta" },
    ]);
    prismaMock.bpmCampo.findMany
      .mockResolvedValueOnce(camposPipeline)
      .mockResolvedValueOnce([
        { ...camposPipeline[0], tipo: "texto" },
        camposPipeline[1],
      ]);

    const resultado = await AtualizarCardBpm({
      cardId: CARD,
      versaoEsperadaEm: UPDATED_AT,
      camposValores: { [MOTIVO]: "Escolheu concorrente" },
    });

    expect(resultado).toEqual({
      success: false,
      error: "A configuração da etapa Lost está inconsistente. Contate um administrador.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("rejeita participante/chamada direta antes de ler ou mutar", async () => {
    acessoCardMock.mockRejectedValue(new Error("Não autorizado"));
    const resultado = await AtualizarCardBpm({
      cardId: CARD,
      versaoEsperadaEm: UPDATED_AT,
      camposValores: { [MOTIVO]: "Sem resposta" },
    });
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
  });

  it.each([
    {
      nome: "MoverCardBpm",
      executar: () => MoverCardBpm({ cardId: CARD, etapaDestinoId: LOST }),
    },
    {
      nome: "SalvarRequisitosEMoverCardBpm",
      executar: () => SalvarRequisitosEMoverCardBpm({
        cardId: CARD,
        etapaDestinoId: LOST,
        camposValores: { [MOTIVO]: "Sem resposta" },
      }),
    },
  ])("nega participante explicitamente em $nome sem efeitos", async ({ executar }) => {
    acessoCardMock.mockRejectedValueOnce(new Error("Não autorizado"));

    const resultado = await executar();

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(acessoCardMock).toHaveBeenCalledWith(
      CARD,
      7,
      "COMERCIAL",
      "moverEtapa",
    );
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });

  it("rejeita sessão ausente antes de qualquer acesso ao banco", async () => {
    authMock.mockResolvedValue(null);
    const resultado = await MoverCardBpm({ cardId: CARD, etapaDestinoId: LOST });
    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(acessoCardMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita campo fora da allowlist de requisitos", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardOrigem());
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });
    const resultado = await SalvarRequisitosEMoverCardBpm({
      cardId: CARD,
      etapaDestinoId: LOST,
      camposValores: {
        [MOTIVO]: "Sem resposta",
        clw0000000000000fake: "intruso",
      },
    });
    expect(resultado).toEqual({
      success: false,
      error: "Um ou mais campos não pertencem aos requisitos desta transição.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita conflito dentro da transação sem efeitos parciais", async () => {
    prismaMock.bpmCard.findUnique
      .mockResolvedValueOnce(cardOrigem())
      .mockResolvedValueOnce({
        ...cardOrigem(),
        updatedAt: new Date(UPDATED_AT.getTime() + 1_000),
      });
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({ id: LOST, pipelineId: PIPELINE, nome: "Lost" });
    const resultado = await SalvarRequisitosEMoverCardBpm({
      cardId: CARD,
      etapaDestinoId: LOST,
      camposValores: { [MOTIVO]: "Sem resposta" },
    });
    expect(resultado).toEqual({
      success: false,
      error: "O card mudou enquanto você preenchia os requisitos. Recarregue e tente novamente.",
    });
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarMock).not.toHaveBeenCalled();
  });
});
