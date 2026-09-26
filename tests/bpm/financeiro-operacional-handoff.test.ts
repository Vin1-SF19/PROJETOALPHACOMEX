import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const db = {
    bpmAutomacaoExecucao: { updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    bpmAutomacaoLease: { create: vi.fn(), deleteMany: vi.fn() },
    bpmAutomacaoPassoExecucao: { upsert: vi.fn(), update: vi.fn() },
    bpmCardHistorico: { create: vi.fn(), findFirst: vi.fn() },
    bpmPipeline: { findFirst: vi.fn() },
    bpmEtapa: { findFirst: vi.fn() },
    bpmCardVinculo: { findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn() },
    bpmCard: { findFirst: vi.fn(), create: vi.fn() },
    bpmCampo: { findMany: vi.fn() },
    bpmCardCampoValor: { findMany: vi.fn(), deleteMany: vi.fn() },
    bpmCardAnexo: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, copiar: vi.fn(), faltantes: vi.fn(), publicar: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async (original) => ({ ...(await original<typeof import("node:crypto")>()), randomUUID: () => "token" }));
vi.mock("@/lib/prisma", () => ({ default: mocks.db }));
vi.mock("@/lib/bpm/copiar-campos-card-vinculado", () => ({ copiarCamposCardVinculado: mocks.copiar }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposFaltantesCardEtapa: mocks.faltantes }));
vi.mock("@/lib/bpm/transicao-command", () => ({ executarTransicaoBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/executor", () => ({ executarAcaoLegadaNoMotorCentral: vi.fn() }));
vi.mock("@/lib/bpm/transcricao-reuniao-server", () => ({ sincronizarTranscricaoCardBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", () => ({ publicarEventoBpm: mocks.publicar }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));

import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";

const origem = "cm1cardfinanceiro000000000001";
const comercial = "cm1cardcomercial000000000001";
const operacional = "cm1cardoperacional0000000001";
const pipelineId = "cm1pipeoperacional00000000001";
const etapaId = "cm1etapaoperacional0000000001";

function execucao() {
  return {
    id: "exec-handoff", cardId: origem, automacaoId: "automacao-handoff", automacaoVersaoId: "versao-handoff",
    claimToken: "token", status: "EM_EXECUCAO", resultadoJson: null, correlationId: null, eventoId: null, evento: null,
    gatilhoTipo: "CARD_MOVIDO", tentativas: 1, passos: [],
    automacao: { ativa: true, nome: "Handoff", criadoPorId: 1, etapaId },
    automacaoVersao: { status: "ATIVA", grafoJson: JSON.stringify({ inicioId: "criar", nos: [
      { id: "criar", tipo: "ACAO", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: { pipelineId, etapaId, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true }, proximoId: "fim" },
      { id: "fim", tipo: "FIM" },
    ] }), condicaoJson: null, timezone: "America/Sao_Paulo" },
    card: {
      id: origem, empresaId: 7, pipelineId: "financeiro", etapaId: "concluidos", responsavelId: 11,
      status: "CONCLUIDO", servico: "Radar", createdAt: new Date(),
      empresa: { razaoSocial: "Cliente", nomeFantasia: null, cnpj: "123" },
      responsavel: { nome: "Financeiro" }, pipeline: { nome: "Financeiro", chave: "financeiro" }, etapa: { nome: "Concluídos" },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (callback: (tx: typeof mocks.db) => Promise<unknown>) => callback(mocks.db));
  mocks.db.bpmAutomacaoExecucao.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.bpmAutomacaoExecucao.findMany.mockResolvedValue([{ id: "exec-handoff" }]);
  mocks.db.bpmAutomacaoExecucao.findUnique.mockResolvedValue(execucao());
  mocks.db.bpmAutomacaoLease.create.mockResolvedValue({});
  mocks.db.bpmAutomacaoPassoExecucao.upsert.mockResolvedValue({ id: "passo" });
  mocks.db.bpmPipeline.findFirst.mockResolvedValue({ chave: "operacional" });
  mocks.db.bpmEtapa.findFirst.mockResolvedValue({ id: etapaId });
  mocks.db.bpmCardVinculo.findFirst.mockImplementation(async ({ where }) => where.cardDestinoId
    ? { cardOrigemId: comercial, cardOrigem: { responsavelId: 29, indicacaoOrigem: { parceiroId: 31 } } }
    : null);
  mocks.db.bpmCard.findFirst.mockResolvedValue(null);
  mocks.db.bpmCard.create.mockResolvedValue({ id: operacional, createdAt: new Date() });
  mocks.db.bpmCampo.findMany.mockResolvedValue([]);
  mocks.db.bpmCardCampoValor.findMany.mockResolvedValue([]);
  mocks.db.bpmCardAnexo.findMany.mockResolvedValue([]);
  mocks.db.bpmCardHistorico.findFirst.mockResolvedValue(null);
  mocks.copiar.mockResolvedValue(2);
  mocks.faltantes.mockResolvedValue([]);
  mocks.publicar.mockResolvedValue({});
});

describe("handoff Financeiro → Operacional", () => {
  it("copia dados de Financeiro e Comercial, vincula a negociação e registra vendedor/origem", async () => {
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });
    expect(mocks.copiar).toHaveBeenNthCalledWith(1, mocks.db, origem, operacional, pipelineId, etapaId);
    expect(mocks.copiar).toHaveBeenNthCalledWith(2, mocks.db, comercial, operacional, pipelineId, etapaId);
    expect(mocks.db.bpmCardVinculo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { cardOrigemId_cardDestinoId: { cardOrigemId: comercial, cardDestinoId: operacional } },
    }));
    expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      cardId: operacional, valorNovoJson: expect.stringContaining('"vendedorResponsavelId":29'),
    }) });
  });

  it("falha com pendências nominais e não publica o card quando faltar requisito de entrada", async () => {
    mocks.faltantes.mockResolvedValue([{ id: "contato", nome: "Contato principal" }]);
    mocks.db.bpmAutomacaoExecucao.findUnique.mockResolvedValueOnce(execucao()).mockResolvedValueOnce({ tentativas: 3 });
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ falhos: 1 });
    expect(mocks.db.bpmAutomacaoExecucao.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FALHA", mensagemErro: expect.stringContaining("Contato principal") }),
    }));
    expect(mocks.publicar).not.toHaveBeenCalled();
  });

  it("libera pendências somente após autorização registrada e audita os campos dispensados", async () => {
    mocks.faltantes.mockResolvedValue([{ id: "contato", nome: "Contato principal" }]);
    mocks.db.bpmCardHistorico.findFirst.mockImplementation(async ({ where }) => where.acao === "EXCECAO_LIBERACAO_OPERACIONAL"
      ? { id: "autorizacao", usuarioId: 9, valorNovoJson: '{"motivo":"Ajuste pendente autorizado","falhaExecucaoId":"exec-handoff"}' }
      : null);
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });
    expect(mocks.db.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      cardId: operacional, acao: "LIBERACAO_OPERACIONAL_COM_EXCECAO", usuarioId: 9,
      valorNovoJson: expect.stringContaining("Contato principal"),
    }) });
  });

  it("reprocessa vínculo existente sem criar outro card e preserva os valores já editados", async () => {
    mocks.db.bpmCardVinculo.findFirst.mockImplementation(async ({ where }) => where.cardDestinoId
      ? { cardOrigemId: comercial, cardOrigem: { responsavelId: 29, indicacaoOrigem: null } }
      : { cardDestinoId: operacional });
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });
    expect(mocks.db.bpmCard.create).not.toHaveBeenCalled();
    expect(mocks.copiar).toHaveBeenCalledTimes(2);
  });

  it("remove IDs de anexos externos copiados sem remover links HTTPS ou anexos próprios", async () => {
    mocks.db.bpmCampo.findMany.mockResolvedValue([{ id: "contrato", tipo: "arquivo" }, { id: "nf", tipo: "url_ou_arquivo" }, { id: "link", tipo: "url_ou_arquivo" }]);
    mocks.db.bpmCardCampoValor.findMany.mockResolvedValue([
      { campoId: "contrato", valor: "anexo-financeiro" },
      { campoId: "nf", valor: "anexo-operacional" },
      { campoId: "link", valor: "https://docs.exemplo.com/nf" },
    ]);
    mocks.db.bpmCardAnexo.findMany.mockResolvedValue([{ id: "anexo-operacional" }]);
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });
    expect(mocks.db.bpmCardCampoValor.deleteMany).toHaveBeenCalledWith({ where: {
      cardId: operacional, campoId: { in: ["contrato"] },
    } });
  });

  it("não reutiliza processo ativo de outra contratação da mesma empresa", async () => {
    mocks.db.bpmCard.findFirst.mockResolvedValue({ id: "outro-processo" });
    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });
    expect(mocks.db.bpmCard.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.bpmCard.create).toHaveBeenCalledTimes(1);
  });
});
