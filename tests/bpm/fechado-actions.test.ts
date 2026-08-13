import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmPipelineMock = vi.hoisted(() => vi.fn());
const usuarioElegivelResponsavelBpmMock = vi.hoisted(() => vi.fn());
const carregarCamposObrigatoriosEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisEtapaMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisCardEtapaMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());
const executarAutomacaoMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  cliente: { findUnique: vi.fn(), create: vi.fn() },
  bpmEtapa: { findUnique: vi.fn() },
  bpmCard: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  bpmEtapaTransicaoPermitida: { findMany: vi.fn() },
  bpmChecklistFollowUp: { findFirst: vi.fn() },
  bpmCardMembro: { create: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  bpmCardCampoValor: { createMany: vi.fn(), upsert: vi.fn() },
  bpmCardHistorico: { create: vi.fn() },
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
  executarAutomacaoFechamentoComercial: executarAutomacaoMock,
}));
vi.mock("@/lib/bpm/ownership", () => ({
  exigirAcessoBpmCard: exigirAcessoBpmCardMock,
  exigirAcessoBpmPipeline: exigirAcessoBpmPipelineMock,
  exigirAcessoModuloBpm: vi.fn(),
  isAdminRole: vi.fn().mockReturnValue(false),
  usuarioElegivelResponsavelBpm: usuarioElegivelResponsavelBpmMock,
}));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({
  carregarCamposObrigatoriosEtapa: carregarCamposObrigatoriosEtapaMock,
  carregarCamposAplicaveisEtapa: carregarCamposAplicaveisEtapaMock,
  carregarCamposAplicaveisCardEtapa: carregarCamposAplicaveisCardEtapaMock,
}));

import {
  AtualizarCardBpm,
  CriarCardBpm,
  MoverCardBpm,
  SalvarRequisitosEMoverCardBpm,
} from "@/actions/bpm/Cards";

const PIPELINE_ID = "clw0000000000000pipe";
const ORIGEM_ID = "clw0000000000000orig";
const FECHADO_ID = "clw0000000000000fech";
const CARD_ID = "clw0000000000000card";
const UPDATED_AT = new Date("2026-08-13T12:00:00.000Z");

const CAMPOS_FECHADO = [
  {
    id: "clw0000000000000valr",
    pipelineId: PIPELINE_ID,
    etapaId: null,
    nome: "Valor acordado no contrato",
    tipo: "numero",
    opcoesJson: null,
    obrigatorio: true,
    ordem: 1,
    valor: "12000",
  },
  {
    id: "clw0000000000000form",
    pipelineId: PIPELINE_ID,
    etapaId: null,
    nome: "Forma de pagamento",
    tipo: "selecao",
    opcoesJson: JSON.stringify(["Pix", "Cartão"]),
    obrigatorio: true,
    ordem: 2,
    valor: "Pix",
  },
];
const CAMPOS_FECHADO_CONFIG = CAMPOS_FECHADO.map((campo) => ({
  id: campo.id,
  pipelineId: campo.pipelineId,
  etapaId: campo.etapaId,
  nome: campo.nome,
  tipo: campo.tipo,
  opcoesJson: campo.opcoesJson,
  obrigatorio: campo.obrigatorio,
  ordem: campo.ordem,
}));

function instalarTransaction() {
  prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
}

function cardMovimento(statusPosFechamento: string | null = null) {
  return {
    id: CARD_ID,
    pipelineId: PIPELINE_ID,
    etapaId: ORIGEM_ID,
    status: "ATIVO",
    statusPosFechamento,
    updatedAt: UPDATED_AT,
    dataReuniao: null,
    transcricaoReuniao: "Reunião transcrita",
    proximoContatoEm: null,
    etapa: { nome: "Reunião Agendada" },
  };
}

describe("actions de Fechado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
    exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true });
    exigirAcessoBpmPipelineMock.mockResolvedValue(undefined);
    usuarioElegivelResponsavelBpmMock.mockResolvedValue(true);
    carregarCamposObrigatoriosEtapaMock.mockResolvedValue([]);
    carregarCamposAplicaveisEtapaMock.mockResolvedValue(CAMPOS_FECHADO_CONFIG);
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue(CAMPOS_FECHADO);
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 42 });
    prismaMock.bpmEtapaTransicaoPermitida.findMany.mockResolvedValue([]);
    prismaMock.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    prismaMock.bpmCardCampoValor.upsert.mockResolvedValue({});
    notificarPipelineBpmMock.mockResolvedValue(undefined);
    executarAutomacaoMock.mockResolvedValue(undefined);
    instalarTransaction();
  });

  it("cria diretamente em Fechado com status inicial na mesma transação", async () => {
    prismaMock.bpmEtapa.findUnique
      .mockResolvedValueOnce({ pipelineId: PIPELINE_ID })
      .mockResolvedValueOnce({ pipelineId: PIPELINE_ID, nome: "Fechado", ativo: true });
    carregarCamposObrigatoriosEtapaMock.mockResolvedValue(
      CAMPOS_FECHADO.map(({ id, nome }) => ({ id, nome })),
    );
    carregarCamposAplicaveisEtapaMock.mockResolvedValue(CAMPOS_FECHADO_CONFIG);
    prismaMock.bpmCard.create.mockResolvedValue({ id: CARD_ID });

    const resultado = await CriarCardBpm({
      empresaId: 42,
      pipelineId: PIPELINE_ID,
      etapaId: FECHADO_ID,
      responsavelId: 7,
      camposValores: {
        [CAMPOS_FECHADO[0].id]: "12000",
        [CAMPOS_FECHADO[1].id]: "Pix",
      },
    });

    expect(resultado.success).toBe(true);
    expect(prismaMock.bpmCard.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        etapaId: FECHADO_ID,
        statusPosFechamento: "AGUARDANDO_CONTRATO",
      }),
    });
    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: "CARD_CRIADO",
        valorNovoJson: expect.stringContaining("AGUARDANDO_CONTRATO"),
      }),
    });
    expect(notificarPipelineBpmMock).toHaveBeenCalledAfter(
      prismaMock.bpmCardHistorico.create,
    );
  });

  it("bloqueia criação direta quando um ou ambos os requisitos faltam", async () => {
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });
    carregarCamposObrigatoriosEtapaMock.mockResolvedValue(
      CAMPOS_FECHADO.map(({ id, nome }) => ({ id, nome })),
    );

    for (const camposValores of [
      {},
      { [CAMPOS_FECHADO[0].id]: "12000" },
      { [CAMPOS_FECHADO[1].id]: "Pix" },
    ]) {
      const resultado = await CriarCardBpm({
        empresaId: 42,
        pipelineId: PIPELINE_ID,
        etapaId: FECHADO_ID,
        responsavelId: 7,
        camposValores,
      });
      expect(resultado.success).toBe(false);
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("falha fechado quando a configuração canônica está ausente ou inconsistente", async () => {
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });
    for (const configuracao of [
      [],
      [CAMPOS_FECHADO_CONFIG[0]],
      [
        CAMPOS_FECHADO_CONFIG[0],
        { ...CAMPOS_FECHADO_CONFIG[1], tipo: "texto" },
      ],
      [
        CAMPOS_FECHADO_CONFIG[0],
        { ...CAMPOS_FECHADO_CONFIG[1], opcoesJson: null },
      ],
    ]) {
      carregarCamposAplicaveisEtapaMock.mockResolvedValueOnce(configuracao);
      const resultado = await CriarCardBpm({
        empresaId: 42,
        pipelineId: PIPELINE_ID,
        etapaId: FECHADO_ID,
        responsavelId: 7,
        camposValores: {},
      });
      expect(resultado).toEqual({
        success: false,
        error: "A configuração da etapa Fechado está inconsistente. Contate um administrador.",
      });
    }
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.create).not.toHaveBeenCalled();
  });

  it("move para Fechado inicializando somente status nulo e registra o status", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardMovimento(null));
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      id: FECHADO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: FECHADO_ID });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ updatedAt: UPDATED_AT }),
      data: expect.objectContaining({
        etapaId: FECHADO_ID,
        statusPosFechamento: "AGUARDANDO_CONTRATO",
      }),
    });
    expect(prismaMock.bpmCardHistorico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: "CARD_MOVIDO",
        valorNovoJson: expect.stringContaining("AGUARDANDO_CONTRATO"),
      }),
    });
  });

  it("preserva o status existente ao reentrar em Fechado", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardMovimento("CONTRATO_ENVIADO"));
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      id: FECHADO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });

    await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: FECHADO_ID });

    const chamada = prismaMock.bpmCard.updateMany.mock.calls[0][0];
    expect(chamada.data.statusPosFechamento).toBeUndefined();
    expect(chamada.data.etapaId).toBe(FECHADO_ID);
  });

  it("faz o movimento do modal pelo mesmo executor, persistindo requisitos e status", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardMovimento(null));
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      id: FECHADO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue(
      CAMPOS_FECHADO.map((campo) => ({ ...campo, valor: null })),
    );

    const resultado = await SalvarRequisitosEMoverCardBpm({
      cardId: CARD_ID,
      etapaDestinoId: FECHADO_ID,
      camposValores: {
        [CAMPOS_FECHADO[0].id]: "11500",
        [CAMPOS_FECHADO[1].id]: "Cartão",
      },
    });

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          etapaId: FECHADO_ID,
          statusPosFechamento: "AGUARDANDO_CONTRATO",
        }),
      }),
    );
  });

  it("revalida no servidor valor persistido inválido antes de mover", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardMovimento(null));
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      id: FECHADO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([
      CAMPOS_FECHADO[0],
      { ...CAMPOS_FECHADO[1], valor: "Opção adulterada" },
    ]);

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: FECHADO_ID });

    expect(resultado.success).toBe(false);
    expect(String(resultado.error)).toContain("opção inválida");
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("revalida a configuração canônica dentro da transação", async () => {
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardMovimento(null));
    prismaMock.bpmEtapa.findUnique.mockResolvedValue({
      id: FECHADO_ID,
      pipelineId: PIPELINE_ID,
      nome: "Fechado",
    });
    carregarCamposAplicaveisCardEtapaMock
      .mockResolvedValueOnce(CAMPOS_FECHADO)
      .mockResolvedValueOnce([
        CAMPOS_FECHADO[0],
        { ...CAMPOS_FECHADO[1], opcoesJson: "[]" },
      ]);

    const resultado = await MoverCardBpm({ cardId: CARD_ID, etapaDestinoId: FECHADO_ID });

    expect(resultado).toEqual({
      success: false,
      error: "A configuração da etapa Fechado está inconsistente. Contate um administrador.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("edita status em Fechado com ownership, CAS, histórico mínimo e realtime pós-commit", async () => {
    const anterior = {
      ...cardMovimento("CONTRATO_A_ENVIAR"),
      etapaId: FECHADO_ID,
    };
    prismaMock.bpmCard.findUnique
      .mockResolvedValueOnce(anterior)
      .mockResolvedValueOnce({ ...anterior, etapa: { nome: "Fechado" } });

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_ENVIADO",
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual({ success: true });
    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith(
      CARD_ID,
      7,
      "COMERCIAL",
      "editarCard",
    );
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: CARD_ID,
        etapaId: FECHADO_ID,
        updatedAt: UPDATED_AT,
      }),
      data: expect.objectContaining({ statusPosFechamento: "CONTRATO_ENVIADO" }),
    });
    const historico = prismaMock.bpmCardHistorico.create.mock.calls[0][0].data;
    expect(JSON.parse(historico.valorAnteriorJson)).toEqual({
      statusPosFechamento: "CONTRATO_A_ENVIAR",
    });
    expect(JSON.parse(historico.valorNovoJson)).toEqual({
      statusPosFechamento: "CONTRATO_ENVIADO",
    });
    expect(notificarPipelineBpmMock).toHaveBeenCalledAfter(
      prismaMock.bpmCardHistorico.create,
    );
    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith(
      CARD_ID,
      7,
      "COMERCIAL",
      "editarCard",
      prismaMock,
    );
  });

  it("exige versão do cliente e rejeita request realmente stale", async () => {
    const semVersao = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_ENVIADO",
    });
    expect(semVersao).toEqual({
      success: false,
      error: "A versão atual do card é obrigatória para alterar o status pós-fechamento.",
    });

    prismaMock.bpmCard.findUnique.mockResolvedValueOnce({
      ...cardMovimento("CONTRATO_A_ENVIAR"),
      etapaId: FECHADO_ID,
      updatedAt: new Date(UPDATED_AT.getTime() + 1_000),
    });
    const stale = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_ENVIADO",
      versaoEsperadaEm: UPDATED_AT,
    });
    expect(stale).toEqual({
      success: false,
      error: "O card mudou enquanto era editado. Recarregue e tente novamente.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejeita revogação de acesso entre precheck e transação", async () => {
    const anterior = { ...cardMovimento("CONTRATO_A_ENVIAR"), etapaId: FECHADO_ID };
    prismaMock.bpmCard.findUnique.mockResolvedValueOnce(anterior);
    exigirAcessoBpmCardMock
      .mockResolvedValueOnce({ autorizado: true })
      .mockRejectedValueOnce(new Error("Não autorizado"));

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_ENVIADO",
      versaoEsperadaEm: UPDATED_AT,
    });

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("rejeita enum inválido e edição fora de Fechado sem efeitos parciais", async () => {
    const enumInvalido = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "",
    });
    expect(enumInvalido).toEqual({
      success: false,
      error: "Status pós-fechamento inválido.",
    });

    const anterior = cardMovimento(null);
    prismaMock.bpmCard.findUnique
      .mockResolvedValueOnce(anterior)
      .mockResolvedValueOnce({ ...anterior, etapa: { nome: "Em tratativa" } });
    const faseInvalida = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_ASSINADO",
      versaoEsperadaEm: UPDATED_AT,
    });
    expect(faseInvalida).toEqual({
      success: false,
      error: "O status pós-fechamento só pode ser alterado enquanto o card estiver em Fechado.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("rejeita CAS perdedor sem histórico nem realtime", async () => {
    const anterior = {
      ...cardMovimento("AGUARDANDO_CONTRATO"),
      etapaId: FECHADO_ID,
    };
    prismaMock.bpmCard.findUnique
      .mockResolvedValueOnce(anterior)
      .mockResolvedValueOnce({
        ...anterior,
        updatedAt: new Date(UPDATED_AT.getTime() + 1_000),
        etapa: { nome: "Fechado" },
      });

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_A_ENVIAR",
      versaoEsperadaEm: UPDATED_AT,
    });

    expect(resultado).toEqual({
      success: false,
      error: "O card mudou enquanto era editado. Recarregue e tente novamente.",
    });
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("rejeita participante por chamada direta antes de ler ou mutar o card", async () => {
    exigirAcessoBpmCardMock.mockRejectedValueOnce(new Error("Não autorizado"));

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      statusPosFechamento: "CONTRATO_ASSINADO",
      versaoEsperadaEm: UPDATED_AT,
    });

    expect(resultado).toEqual({ success: false, error: "Não autorizado" });
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });
});
