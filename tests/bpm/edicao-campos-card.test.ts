import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const authMock = vi.hoisted(() => vi.fn());
const exigirAcessoBpmCardMock = vi.hoisted(() => vi.fn());
const carregarCamposAplicaveisCardEtapaMock = vi.hoisted(() => vi.fn());
const notificarPipelineBpmMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn(), updateMany: vi.fn() },
  bpmCardFollowUpEstado: { upsert: vi.fn() },
  bpmCardCampoValor: { upsert: vi.fn() },
  bpmCardAnexo: { findMany: vi.fn() },
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
  carregarSnapshotsCopiaCamposCard: vi.fn().mockResolvedValue({}),
  carregarCamposAplicaveisEtapa: vi.fn(),
  carregarCamposObrigatoriosEtapa: vi.fn(),
}));

import { AtualizarCardBpm } from "@/actions/bpm/Cards";
import { revalidatePath } from "next/cache";

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
    prismaMock.bpmCardAnexo.findMany.mockResolvedValue([{ id: "clw0000000000000anex", campoId: CAMPO_ID }]);
    prismaMock.bpmCardHistorico.create.mockResolvedValue({});
    notificarPipelineBpmMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
  });

  it("recusa autosave sem sessão antes de consultar o card", async () => {
    authMock.mockResolvedValueOnce(null);
    expect(await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: "Novo" } }))
      .toEqual({ success: false, error: "Não autorizado" });
    expect(exigirAcessoBpmCardMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("recusa autosave sem acesso de edição sem escrita ou notificação", async () => {
    exigirAcessoBpmCardMock.mockRejectedValueOnce(new Error("Acesso negado"));
    expect((await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: "Novo" } })).success).toBe(false);
    expect(exigirAcessoBpmCardMock).toHaveBeenCalledWith(CARD_ID, 7, "COMERCIAL", "editarCard");
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
  });

  it("confirma a versão e os valores gravados mesmo se a invalidação de cache falhar depois do commit", async () => {
    vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("cache indisponível"); });
    const resultado = await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: "Novo" } });
    expect(resultado).toEqual({
      success: true,
      data: { updatedAt: expect.any(Date), camposValores: { [CAMPO_ID]: "Novo" } },
    });
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledOnce();
    expect(notificarPipelineBpmMock).toHaveBeenCalledOnce();
  });

  it("avança a versão do card mesmo quando dois saves acontecem no mesmo milissegundo", async () => {
    const versaoAtual = new Date(Date.now() + 1000);
    prismaMock.bpmCard.findUnique.mockResolvedValue(cardNaEtapaAtual(versaoAtual));
    const resultado = await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: "Novo" } });
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data?.updatedAt.getTime()).toBeGreaterThan(versaoAtual.getTime());
  });

  it.each([
    ["texto", "Texto", "Texto"], ["texto_longo", "Linha\nOutra", "Linha\nOutra"],
    ["numero", 0, "0"], ["moeda", 12.5, "12.5"], ["percentual", 100, "100"],
    ["booleano", true, "Sim"], ["booleano", false, "Não"],
    ["data", "2026-09-22", "2026-09-22"],
    ["data_hora", "2026-09-22T12:30:00Z", "2026-09-22T12:30:00Z"],
    ["selecao", "A", "A"], ["multiselecao", ["A", "B", "A"], '["A","B"]'],
    ["texto", null, ""], ["booleano", null, ""], ["multiselecao", null, ""],
    ["arquivo", "clw0000000000000anex", "clw0000000000000anex"], ["arquivo", null, ""],
    ["cpf", "529.982.247-25", "52998224725"],
    ["email", "Pessoa@example.com", "pessoa@example.com"],
    ["telefone", "(11) 99999-9999", "11999999999"],
    ["url", "https://example.com", "https://example.com"],
  ])("autosave parcial %s normaliza %j e repete upsert sem exigir outros campos", async (tipo, entrada, esperado) => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([
      { ...campoNulo, tipo, opcoesJson: '["A","B"]' },
      { ...campoNulo, id: CAMPO_FORA_ID, obrigatorio: true },
    ]);
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const resultado = await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: entrada } });
      expect(resultado).toEqual(expect.objectContaining({ success: true }));
    }
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenLastCalledWith({
      where: { cardId_campoId: { cardId: CARD_ID, campoId: CAMPO_ID } },
      create: { cardId: CARD_ID, campoId: CAMPO_ID, valor: esperado },
      update: { valor: esperado },
    });
  });

  it.each([{ anexos: [] }, { anexos: [{ id: "clw0000000000000anex", campoId: CAMPO_FORA_ID }] }])(
    "recusa referência sem vínculo ao card/campo: %j", async ({ anexos }) => {
      carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([{ ...campoNulo, tipo: "arquivo" }]);
      prismaMock.bpmCardAnexo.findMany.mockResolvedValue(anexos);
      const resultado = await AtualizarCardBpm({
        cardId: CARD_ID, camposValores: { [CAMPO_ID]: "clw0000000000000anex" },
      });
      expect(resultado).toEqual({ success: false, error: "Arquivo não vinculado a este campo do card." });
      expect(prismaMock.bpmCardAnexo.findMany).toHaveBeenCalledWith({
        where: { cardId: CARD_ID, OR: [{ id: "clw0000000000000anex", campoId: CAMPO_ID }] },
        select: { id: true, campoId: true },
      });
      expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    },
  );

  it("limpa referência de arquivo sem apagar ou consultar anexos", async () => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([{ ...campoNulo, tipo: "arquivo" }]);
    expect(await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: null } })).toEqual(expect.objectContaining({ success: true }));
    expect(prismaMock.bpmCardAnexo.findMany).not.toHaveBeenCalled();
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { valor: "" } }));
  });

  it.each([{}, Number.NaN, Infinity, [true], ["x".repeat(4000), "y"]])(
    "rejeita payload inválido ou serializado acima do limite: %j", async (valor) => {
      expect((await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: valor } })).success).toBe(false);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(["04.252.011/0001-10", ""])("salva override GLOBAL CNPJ local: %s", async (valor) => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([{
      ...campoNulo, nome: "CNPJ", tipo: "cnpj", escopo: "GLOBAL",
      fonteEntidade: "CLIENTE", editavel: true, somenteLeitura: false,
    }]);
    const resultado = await AtualizarCardBpm({ cardId: CARD_ID, camposValores: { [CAMPO_ID]: valor }, versaoEsperadaEm: UPDATED_AT.toISOString() });
    expect(resultado).toEqual(expect.objectContaining({ success: true }));
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { valor: valor.replace(/\D/g, "") } }));
  });

  it.each([false, true])("preserva relacionamento existente (somenteLeitura=%s)", async (somenteLeitura) => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([{
      ...campoNulo, tipo: "relacionamento", somenteLeitura,
    }]);
    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID, camposValores: { [CAMPO_ID]: "  Empresa parceira  " },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });
    expect(resultado.success).toBe(!somenteLeitura);
    if (somenteLeitura) {
      expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
    } else {
      expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { valor: "Empresa parceira" } }),
      );
    }
  });

  it("rejeita próximo contato fora do contrato antes de ownership e persistência", async () => {
    for (const proximoContatoEm of [
      "09/04/2026 10:30",
      "September 4, 2026 10:30",
      "0",
      "2026-09-04",
      "2026-02-30T10:30:00Z",
      false,
    ]) {
      const resultado = await AtualizarCardBpm({ cardId: CARD_ID, proximoContatoEm });
      expect(resultado.success).toBe(false);
    }

    expect(exigirAcessoBpmCardMock).not.toHaveBeenCalled();
    expect(prismaMock.bpmCard.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("mantém o próximo contato do card e do estado de follow-up na mesma transação", async () => {
    const data = "2026-09-24T15:00:00.000Z";
    expect(await AtualizarCardBpm({ cardId: CARD_ID, proximoContatoEm: data })).toEqual(expect.objectContaining({ success: true }));
    const proximoContatoEm = new Date(data);
    expect(prismaMock.bpmCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ proximoContatoEm }),
    }));
    expect(prismaMock.bpmCardFollowUpEstado.upsert).toHaveBeenCalledWith({
      where: { cardId: CARD_ID },
      create: { cardId: CARD_ID, proximoContatoEm },
      update: { proximoContatoEm },
    });
  });

  it("faz upsert de um campo inicialmente nulo sob CAS e notifica somente depois do histórico", async () => {
    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      camposValores: { [CAMPO_ID]: "  Qualificado  " },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual(expect.objectContaining({ success: true }));
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

  it("persiste somente os 14 dígitos ao atualizar um campo CNPJ formatado", async () => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([
      { ...campoNulo, nome: "CNPJ", tipo: "cnpj" },
    ]);

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      camposValores: { [CAMPO_ID]: "11.222.333/0001-81" },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual(expect.objectContaining({ success: true }));
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith({
      where: { cardId_campoId: { cardId: CARD_ID, campoId: CAMPO_ID } },
      create: { cardId: CARD_ID, campoId: CAMPO_ID, valor: "11222333000181" },
      update: { valor: "11222333000181" },
    });
  });

  it("normaliza também o campo legado chamado exatamente CNPJ", async () => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([
      { ...campoNulo, nome: " cnpj ", tipo: "texto" },
    ]);

    const resultado = await AtualizarCardBpm({
      cardId: CARD_ID,
      camposValores: { [CAMPO_ID]: "CNPJ: 11.222.333/0001-81" },
      versaoEsperadaEm: UPDATED_AT.toISOString(),
    });

    expect(resultado).toEqual(expect.objectContaining({ success: true }));
    expect(prismaMock.bpmCardCampoValor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ valor: "11222333000181" }),
        update: { valor: "11222333000181" },
      }),
    );
  });

  it("rejeita CNPJ incompleto ou excedente sem persistência parcial", async () => {
    carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([
      { ...campoNulo, nome: "CNPJ", tipo: "cnpj" },
    ]);

    for (const valor of ["11.222.333/0001", "112223330001819"]) {
      vi.clearAllMocks();
      authMock.mockResolvedValue({ user: { id: "7", role: "COMERCIAL" } });
      exigirAcessoBpmCardMock.mockResolvedValue({ autorizado: true });
      carregarCamposAplicaveisCardEtapaMock.mockResolvedValue([
        { ...campoNulo, nome: "CNPJ", tipo: "cnpj" },
      ]);
      prismaMock.bpmCard.findUnique.mockResolvedValue(cardNaEtapaAtual());

      const resultado = await AtualizarCardBpm({
        cardId: CARD_ID,
        camposValores: { [CAMPO_ID]: valor },
        versaoEsperadaEm: UPDATED_AT.toISOString(),
      });

      expect(resultado.success).toBe(false);
      expect(prismaMock.bpmCard.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.bpmCardCampoValor.upsert).not.toHaveBeenCalled();
      expect(prismaMock.bpmCardHistorico.create).not.toHaveBeenCalled();
      expect(notificarPipelineBpmMock).not.toHaveBeenCalled();
    }
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
    expect(painel).toContain("montarPayloadCamposDestino([campo], valoresAtuais)");
    expect(painel).toContain("<CampoBpmInput");
    expect(input).toContain("required={campo.obrigatorio}");
    expect(input).toContain("aria-required={campo.obrigatorio}");
  });
});
