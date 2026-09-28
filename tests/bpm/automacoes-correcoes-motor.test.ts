import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bpmAutomacaoExecucao: { updateMany: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  bpmAutomacaoLease: { create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
  bpmAutomacaoPassoExecucao: { upsert: vi.fn(), update: vi.fn() },
  bpmCardHistorico: { create: vi.fn(), findMany: vi.fn() },
  bpmAutomacaoAgenda: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  bpmAutomacaoVersao: { findMany: vi.fn(), findUnique: vi.fn() },
  bpmTarefa: { findMany: vi.fn(), create: vi.fn() },
  bpmCard: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  bpmEventoDominio: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: db }));
vi.mock("node:crypto", async (original) => ({ ...(await original<typeof import("node:crypto")>()), randomUUID: () => "token-1" }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/regras/contexto", () => ({ montarContextoAvaliacaoDoCard: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposObrigatoriosEtapa: vi.fn(), verificarTransicaoPermitidaBpm: vi.fn() }));
vi.mock("@/lib/bpm/transcricao-reuniao-server", () => ({ sincronizarTranscricaoCardBpm: vi.fn() }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/executor", () => ({ executarAcaoLegadaNoMotorCentral: vi.fn() }));

import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";
import { materializarAgendasAutomacoesBpm, materializarGatilhosTemporaisBpm, sincronizarAgendasVersaoAutomacao } from "@/lib/bpm/automacoes/agenda";
import { materializarExecucoesEventosBpm } from "@/lib/bpm/automacoes/eventos";

const CARD = "cm1card0000000000000000001";
const PIPELINE = "cm1pipe0000000000000000001";
const ETAPA = "cm1etapa000000000000000001";
const CAMPO = "cm1campo000000000000000001";

const grafoComCondicao = JSON.stringify({
  inicioId: "if",
  nos: [
    { id: "if", tipo: "CONDICAO", condicao: { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "status" }, operador: "igual", valor: "ATIVO" }] }, entaoId: "nota", senaoId: "fim" },
    { id: "nota", tipo: "ACAO", acaoTipo: "ADICIONAR_ANOTACAO", parametros: { texto: "Contato com {{empresa.razaoSocial}}" }, proximoId: "fim" },
    { id: "fim", tipo: "FIM" },
  ],
});

function execucao(parcial: Record<string, unknown> = {}) {
  return {
    id: "exec-1", cardId: CARD, automacaoId: "auto-1", automacaoVersaoId: "versao-1", claimToken: "token-1",
    status: "EM_EXECUCAO", resultadoJson: null, correlationId: "corr-1", eventoId: null, evento: null,
    gatilhoTipo: "CARD_CRIADO", tentativas: 2,
    automacao: { ativa: true, nome: "Teste", criadoPorId: 1, etapaId: ETAPA },
    automacaoVersao: { status: "ATIVA", grafoJson: grafoComCondicao, condicaoJson: null, timezone: "America/Sao_Paulo" },
    passos: [],
    card: {
      id: CARD, pipelineId: PIPELINE, etapaId: ETAPA, status: "ATIVO", servico: "Radar",
      empresa: { razaoSocial: "ACME Ltda", nomeFantasia: null, cnpj: null },
      responsavel: { nome: "Ana" }, pipeline: { nome: "Comercial" }, etapa: { nome: "Novo Lead" },
    },
    ...parcial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.bpmAutomacaoExecucao.updateMany.mockResolvedValue({ count: 1 });
  db.bpmAutomacaoExecucao.findMany.mockResolvedValue([{ id: "exec-1" }]);
  db.bpmAutomacaoLease.create.mockResolvedValue({});
  db.bpmAutomacaoPassoExecucao.upsert.mockResolvedValue({ id: "passo-novo" });
  db.bpmCardHistorico.create.mockResolvedValue({ id: "historico-1" });
  db.bpmCardHistorico.findMany.mockResolvedValue([]);
  db.bpmTarefa.findMany.mockResolvedValue([]);
  db.bpmEventoDominio.findMany.mockResolvedValue([]);
  db.bpmEventoDominio.create.mockImplementation(async ({ data }) => ({ id: "evento-novo", ...data }));
  db.$transaction.mockImplementation(async (callback) => callback(db));
});

describe("correções do Motor Central", () => {
  it("sincronização NoLoss exclui cards com opt-out e desativa agendas antigas", async () => {
    db.bpmAutomacaoVersao.findUnique.mockResolvedValue({
      id: "versao-standby", status: "ATIVA", gatilhoTipo: "RECORRENCIA_ATINGIDA", timezone: "America/Sao_Paulo",
      gatilhoConfigJson: JSON.stringify({ escopo: "ETAPAS", etapaId: ETAPA, etapasIds: [ETAPA], recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 7, ancora: "ENTRADA_ETAPA" } }),
      grafoJson: "{}", automacao: { ativa: true, chave: "standby_follow_up_semanal", pipelineId: PIPELINE, etapaId: ETAPA },
    });
    db.bpmCard.findMany.mockResolvedValue([]);
    db.bpmAutomacaoAgenda.updateMany.mockResolvedValue({ count: 1 });

    expect(await sincronizarAgendasVersaoAutomacao("versao-standby")).toEqual({ criadas: 0 });
    expect(db.bpmCard.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ standbyFollowUpInterrompidoEm: null }) }));
    expect(db.bpmAutomacaoAgenda.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { ativo: false } }));
    expect(db.bpmAutomacaoAgenda.upsert).not.toHaveBeenCalled();
  });

  it("nova versão configurada com outro intervalo ancora o ciclo na reentrada atual", async () => {
    const reentrada = new Date("2026-09-10T12:00:00.000Z");
    db.bpmAutomacaoVersao.findUnique.mockResolvedValue({
      id: "versao-standby-2", status: "ATIVA", gatilhoTipo: "RECORRENCIA_ATINGIDA", timezone: "America/Sao_Paulo",
      gatilhoConfigJson: JSON.stringify({ escopo: "ETAPAS", etapaId: ETAPA, etapasIds: [ETAPA], recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 3, ancora: "ENTRADA_ETAPA" } }),
      grafoJson: "{}", automacao: { ativa: true, chave: "standby_follow_up_semanal", pipelineId: PIPELINE, etapaId: ETAPA },
    });
    db.bpmCard.findMany.mockResolvedValue([{ id: CARD, etapaId: ETAPA, createdAt: new Date("2026-08-01T12:00:00.000Z") }]);
    db.bpmCardHistorico.findMany.mockResolvedValue([{ cardId: CARD, createdAt: reentrada, valorNovoJson: JSON.stringify({ etapaId: ETAPA }) }]);
    db.bpmAutomacaoAgenda.upsert.mockResolvedValue({});
    db.bpmAutomacaoAgenda.updateMany.mockResolvedValue({ count: 0 });

    expect(await sincronizarAgendasVersaoAutomacao("versao-standby-2")).toEqual({ criadas: 1 });
    expect(db.bpmAutomacaoAgenda.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ proximaExecucaoEm: new Date("2026-09-13T12:00:00.000Z"), chaveAgendamento: expect.stringContaining(String(reentrada.getTime())) }),
    }));
  });

  it("materialização NoLoss desativa agenda de card interrompido sem publicar evento", async () => {
    db.bpmAutomacaoAgenda.findMany.mockResolvedValue([{
      id: "agenda-standby", cardId: CARD, tipo: "RECORRENTE", proximaExecucaoEm: new Date("2026-09-01T00:00:00Z"),
      automacaoVersao: { id: "versao-standby", status: "ATIVA", gatilhoConfigJson: JSON.stringify({ escopo: "ETAPAS", etapaId: ETAPA, etapasIds: [ETAPA], recorrencia: { tipo: "INTERVALO_DIAS", intervaloDias: 7, ancora: "ENTRADA_ETAPA" } }), grafoJson: "{}", automacao: { ativa: true, chave: "standby_follow_up_semanal", pipelineId: PIPELINE } },
    }]);
    db.bpmCard.findUnique.mockResolvedValue({ status: "ATIVO", etapaId: ETAPA, standbyFollowUpInterrompidoEm: new Date() });
    db.bpmAutomacaoAgenda.update.mockResolvedValue({});

    expect(await materializarAgendasAutomacoesBpm()).toEqual({ encontradas: 1, materializadas: 0 });
    expect(db.bpmAutomacaoAgenda.update).toHaveBeenCalledWith({ where: { id: "agenda-standby" }, data: { ativo: false } });
    expect(db.bpmEventoDominio.create).not.toHaveBeenCalled();
  });

  it("motor NoLoss cria tarefa e histórico somente após revalidar elegibilidade na transação", async () => {
    const grafo = JSON.stringify({ inicioId: "tarefa", nos: [
      { id: "tarefa", tipo: "ACAO", acaoTipo: "CRIAR_TAREFA", parametros: { titulo: "Realizar follow-up", tipo: "LIGACAO", prioridade: "NORMAL", interromperSeCampoPreenchido: "standbyFollowUpInterrompidoEm", registrarExecucaoEmCampo: "standbyFollowUpUltimoEm" }, proximoId: "fim" },
      { id: "fim", tipo: "FIM" },
    ] });
    db.bpmAutomacaoExecucao.findUnique.mockResolvedValue(execucao({
      id: "cm1exec000000000000000001",
      automacao: { ativa: true, chave: "standby_follow_up_semanal", nome: "NoLoss", criadoPorId: 1, etapaId: ETAPA },
      automacaoVersao: { status: "ATIVA", grafoJson: grafo, condicaoJson: null, timezone: "America/Sao_Paulo" },
      card: { ...execucao().card, responsavelId: 7, standbyFollowUpInterrompidoEm: null },
    }));
    db.bpmCard.updateMany.mockResolvedValue({ count: 1 });
    db.bpmTarefa.create.mockResolvedValue({ id: "tarefa-noloss", tipo: "LIGACAO", titulo: "Realizar follow-up" });

    const resultado = await processarFilaAutomacoesCentraisBpm();
    expect(db.bpmCard.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ standbyFollowUpInterrompidoEm: null, etapaId: ETAPA }) }));
    expect(db.bpmTarefa.create).toHaveBeenCalledTimes(1);
    expect(db.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({ acao: "STANDBY_FOLLOW_UP_TAREFA_CRIADA", valorNovoJson: expect.stringContaining("tarefa-noloss") }) });
    expect(resultado).toMatchObject({ executados: 1, falhos: 0 });
  });

  it("motor NoLoss não cria tarefa se o opt-out vencer a corrida transacional", async () => {
    const grafo = JSON.stringify({ inicioId: "tarefa", nos: [
      { id: "tarefa", tipo: "ACAO", acaoTipo: "CRIAR_TAREFA", parametros: { titulo: "Realizar follow-up", tipo: "LIGACAO", prioridade: "NORMAL", interromperSeCampoPreenchido: "standbyFollowUpInterrompidoEm", registrarExecucaoEmCampo: "standbyFollowUpUltimoEm" }, proximoId: "fim" },
      { id: "fim", tipo: "FIM" },
    ] });
    db.bpmAutomacaoExecucao.findUnique.mockResolvedValue(execucao({
      id: "cm1exec000000000000000001",
      automacao: { ativa: true, chave: "standby_follow_up_semanal", nome: "NoLoss", criadoPorId: 1, etapaId: ETAPA },
      automacaoVersao: { status: "ATIVA", grafoJson: grafo, condicaoJson: null, timezone: "America/Sao_Paulo" },
      card: { ...execucao().card, responsavelId: 7, standbyFollowUpInterrompidoEm: null },
    }));
    db.bpmCard.updateMany.mockResolvedValue({ count: 0 });

    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ falhos: 0 });
    expect(db.bpmTarefa.create).not.toHaveBeenCalled();
  });

  it("retentativa após condição já avaliada executa o ramo escolhido, não encerra como sucesso vazio", async () => {
    db.bpmAutomacaoExecucao.findUnique.mockResolvedValue(execucao({
      passos: [
        { id: "p-if", nodeId: "if", status: "CONCLUIDO", resultadoJson: JSON.stringify({ resultado: true, proximoNodeId: "nota" }) },
        { id: "p-nota", nodeId: "nota", status: "FALHA", resultadoJson: null },
      ],
    }));

    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ executados: 1 });

    // A anotação do ramo "então" foi executada, com a variável renderizada.
    expect(db.bpmCardHistorico.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      acao: "ANOTACAO_AUTOMACAO",
      valorNovoJson: expect.stringContaining("Contato com ACME Ltda"),
    }) });
    expect(db.bpmAutomacaoPassoExecucao.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { execucaoId_nodeId: { execucaoId: "exec-1", nodeId: "nota" } } }));
  });

  it("automação pausada encerra a execução como IGNORADA, sem retentativa nem falha", async () => {
    db.bpmAutomacaoExecucao.findUnique.mockResolvedValue(execucao({ automacao: { ativa: false, nome: "Teste", criadoPorId: 1, etapaId: ETAPA } }));

    expect(await processarFilaAutomacoesCentraisBpm()).toMatchObject({ ignorados: 1, falhos: 0, adiados: 0 });
    expect(db.bpmAutomacaoExecucao.update).toHaveBeenCalledWith({ where: { id: "exec-1" }, data: expect.objectContaining({
      status: "IGNORADA", resultadoJson: expect.stringContaining("AUTOMACAO_INATIVA"),
    }) });
    expect(db.bpmAutomacaoPassoExecucao.upsert).not.toHaveBeenCalled();
  });

  it("retomar uma espera zera as tentativas para esperas não esgotarem o limite de retentativas", async () => {
    db.bpmAutomacaoAgenda.findMany.mockResolvedValue([{
      id: "agenda-1", tipo: "ESPERA", recorrenciaJson: JSON.stringify({ execucaoId: "exec-1", proximoNodeId: "n2" }),
      proximaExecucaoEm: new Date(), automacaoVersao: { status: "ATIVA", automacao: { ativa: true } },
    }]);

    await materializarAgendasAutomacoesBpm();

    expect(db.bpmAutomacaoExecucao.updateMany).toHaveBeenCalledWith({
      where: { id: "exec-1", status: "AGUARDANDO" },
      data: expect.objectContaining({ status: "PENDENTE", tentativas: 0 }),
    });
  });

  it("versão só materializa eventos ocorridos depois da ativação", async () => {
    const ativadaEm = new Date("2026-09-20T12:00:00.000Z");
    const client = {
      bpmAutomacaoVersao: { findMany: vi.fn().mockResolvedValue([
        { id: "versao-1", automacaoId: "auto-1", gatilhoTipo: "CARD_CRIADO", gatilhoConfigJson: "{}", ativadaEm, createdAt: new Date("2026-09-01T00:00:00.000Z"), automacao: { etapaId: ETAPA, pipelineId: PIPELINE } },
        { id: "versao-2", automacaoId: "auto-2", gatilhoTipo: "CARD_CRIADO", gatilhoConfigJson: "{}", ativadaEm: null, createdAt: new Date("2026-09-10T00:00:00.000Z"), automacao: { etapaId: ETAPA, pipelineId: PIPELINE } },
      ]) },
      bpmEventoDominio: { findMany: vi.fn().mockResolvedValue([]) },
      bpmAutomacaoExecucao: { findFirst: vi.fn(), create: vi.fn() },
    };

    await materializarExecucoesEventosBpm(10, client as never);

    expect(client.bpmEventoDominio.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ ocorridoEm: { gte: ativadaEm } }) }));
    expect(client.bpmEventoDominio.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ ocorridoEm: { gte: new Date("2026-09-10T00:00:00.000Z") } }) }));
  });

  it("gatilho de valor assumido compara número configurado com texto salvo no campo", async () => {
    const create = vi.fn().mockResolvedValue({ id: "exec-novo" });
    const client = {
      bpmAutomacaoVersao: { findMany: vi.fn().mockResolvedValue([{
        id: "versao-1", automacaoId: "auto-1", gatilhoTipo: "CAMPO_VALOR_ASSUMIDO",
        gatilhoConfigJson: JSON.stringify({ campoId: CAMPO, valor: 10 }), ativadaEm: new Date(0), createdAt: new Date(0),
        automacao: { etapaId: ETAPA, pipelineId: PIPELINE },
      }]) },
      bpmEventoDominio: { findMany: vi.fn().mockResolvedValue([{
        id: "evento-1", tipo: "CAMPO_ALTERADO", cardId: CARD, correlationId: "corr-1", causationId: null, profundidade: 0,
        valorAnteriorJson: null, valorNovoJson: JSON.stringify({ campoId: CAMPO, valor: "10" }), card: { etapaId: ETAPA },
      }]) },
      bpmAutomacaoExecucao: { findFirst: vi.fn().mockResolvedValue(null), create },
    };

    expect(await materializarExecucoesEventosBpm(10, client as never)).toMatchObject({ criadas: 1 });
    expect(create.mock.calls[0][0].data.status).toBeUndefined();
  });

  it("tempo na etapa dispara só para cards que cruzaram o limite depois da ativação", async () => {
    const agora = Date.now();
    const minutos = 60_000;
    db.bpmAutomacaoVersao.findMany.mockResolvedValue([{
      id: "versao-1", status: "ATIVA", gatilhoTipo: "TEMPO_NA_ETAPA_ATINGIDO",
      gatilhoConfigJson: JSON.stringify({ tempo: { quantidade: 60, unidade: "MINUTOS", ancora: "CRIACAO_CARD" } }),
      ativadaEm: new Date(agora - 120 * minutos), createdAt: new Date(agora - 500 * minutos),
      automacao: { pipelineId: PIPELINE, etapaId: ETAPA },
    }]);
    const cardJaVencido = "cm1card0000000000000000002";
    const cardNovo = "cm1card0000000000000000003";
    const cardNoPrazo = "cm1card0000000000000000004";
    db.bpmCard.findMany.mockResolvedValueOnce([
      { id: cardJaVencido, pipelineId: PIPELINE, etapaId: ETAPA, createdAt: new Date(agora - 300 * minutos) },
      { id: cardNovo, pipelineId: PIPELINE, etapaId: ETAPA, createdAt: new Date(agora - 90 * minutos) },
      { id: cardNoPrazo, pipelineId: PIPELINE, etapaId: ETAPA, createdAt: new Date(agora - 30 * minutos) },
    ]);

    expect(await materializarGatilhosTemporaisBpm()).toEqual({ criados: 1 });
    expect(db.bpmEventoDominio.create).toHaveBeenCalledTimes(1);
    expect(db.bpmEventoDominio.create).toHaveBeenCalledWith({ data: expect.objectContaining({ cardId: cardNovo, tipo: "TEMPO_NA_ETAPA_ATINGIDO" }) });
  });

  it("não tenta republicar eventos temporais que já existem", async () => {
    db.bpmAutomacaoVersao.findMany.mockResolvedValue([]);
    const prazo = new Date(Date.now() - 60_000);
    db.bpmTarefa.findMany.mockResolvedValueOnce([{ id: "tarefa-1", cardId: CARD, tipo: "LIGACAO", prazo, card: { pipelineId: PIPELINE } }]).mockResolvedValueOnce([]);
    db.bpmEventoDominio.findMany.mockResolvedValue([{ idempotencyKey: `prazo-tarefa:tarefa-1:${prazo.toISOString()}` }]);

    expect(await materializarGatilhosTemporaisBpm()).toEqual({ criados: 0 });
    expect(db.bpmEventoDominio.create).not.toHaveBeenCalled();
    expect(db.bpmTarefa.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { prazo: "desc" } }));
  });
});
