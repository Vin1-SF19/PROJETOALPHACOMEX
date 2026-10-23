import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ client: null as PrismaClient | null, falharOutbox: false, auth: vi.fn() }));
vi.mock("../../auth", () => ({ auth: estado.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, chave) => {
  if (!estado.client) throw new Error("Fixture privada não inicializada");
  const valor = Reflect.get(estado.client, chave);
  return typeof valor === "function" ? valor.bind(estado.client) : valor;
} }) }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: vi.fn() }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/notificacoes-leads-server", () => ({ notificarPendenciasLeadsBpm: vi.fn() }));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: vi.fn() }));
vi.mock("@/lib/bibble/gerar-ficha-server", () => ({ gerarFichaServer: vi.fn() }));

vi.mock("@/lib/bpm/automacoes/eventos", async original => {
  const real = await original<typeof import("@/lib/bpm/automacoes/eventos")>();
  return { ...real, publicarEventoBpm: async (...args: Parameters<typeof real.publicarEventoBpm>) => {
    if (estado.falharOutbox && (args[0] as { tipo: string }).tipo === "CARD_CRIADO") throw new Error("Falha de outbox fictícia");
    return real.publicarEventoBpm(...args);
  } };
});

import { RecuperarEncaminhamentoFinanceiroCardBpm, RepetirEncaminhamentoCardBpm } from "@/actions/bpm/Encaminhamentos";
import { materializarExecucoesEventosBpm, publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { executarFinanceiroMovimentoLivreAgora } from "@/lib/bpm/automacoes/orquestrador";
import { executarEncaminhamentoBpm } from "@/lib/bpm/automacoes/encaminhamento";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => { exec(sql: string): void; close(): void };
};
const origem = "c111111111111111111111111", fechado = "c222222222222222222222222", card = "c333333333333333333333333";
const financeiro = "c444444444444444444444444", novoContrato = "c555555555555555555555555";
const parametros = { pipelineId: financeiro, etapaId: novoContrato, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true };
const grafo = { inicioId: "enviar", nos: [
  { id: "enviar", tipo: "ACAO", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros, proximoId: "fim" }, { id: "fim", tipo: "FIM" },
] };
let db: PrismaClient, diretorio: string;
function tabelas(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelos = ["Cliente", "usuarios", "Setor", "SetorPermissao", "UsuarioPermissaoOverride", "BpmPipelineSetor", "BpmEtapaVisibilidade", "BpmCard", "BpmPipeline", "BpmEtapa", "BpmCardMembro", "BpmCardVinculo", "BpmCardHistorico", "BpmCampo", "BpmCampoPipeline", "BpmCardCampoValor", "BpmCardAnexo", "BpmCardServicoContexto", "ClienteServico", "BpmTarefa", "BpmEventoDominio", "BpmAutomacao", "BpmAutomacaoVersao", "BpmAutomacaoExecucao", "BpmAutomacaoLease", "BpmAutomacaoPassoExecucao", "BpmCampoEtapaConfig", "BpmCampoMapeamento", "BpmFormularioComponente", "BpmFormularioSecao", "BpmEtapaFormulario"];
  for (const modelo of modelos) {
    const corpo = schema.match(new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (!corpo) throw new Error(`Modelo ausente: ${modelo}`);
    const colunas = corpo.split("\n").flatMap((linha) => {
      const item = linha.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|BigInt|Decimal|Bytes|Json)(\?)?\s*(.*)$/);
      if (!item) return [];
      const [, nome, tipo, opcional, atributos] = item;
      const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB", Json: "TEXT" };
      const valor = atributos.match(/@default\(("[^"]*"|true|false|\d+|now\(\))\)/)?.[1];
      const padrao = valor === "now()" ? "CURRENT_TIMESTAMP" : valor === "true" ? "1" : valor === "false" ? "0" : valor ?? (!opcional ? tipo === "DateTime" ? "CURRENT_TIMESTAMP" : ["Int", "Boolean", "Float", "Decimal", "BigInt"].includes(tipo) ? "0" : "''" : undefined);
      return [`"${nome}" ${tipos[tipo]}${atributos.includes("@id") ? " PRIMARY KEY" : ""}${atributos.includes("@unique") ? " UNIQUE" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
    });
    for (const unica of corpo.matchAll(/@@unique\(\[([^\]]+)\]/g)) colunas.push(`UNIQUE(${unica[1]})`);
    const tabela = corpo.match(/@@map\("([^"\n]+)"\)/)?.[1] ?? modelo;
    sqlite.exec(`CREATE TABLE "${tabela}" (${colunas.join(",")});`);
  }
}

async function evento(marcador = true) {
  const anterior = { etapaId: "em_tratativa", versao: 0 };
  const novo = { etapaId: fechado, versao: 1, movimentoLivre: { tipo: "ADMIN", setor: null },
    automacoesSuprimidas: true, permitirMinutaConfigurada: true,
    ...(marcador ? { permitirEncaminhamentoFinanceiroConfigurado: true } : {}) };
  const historico = await db.bpmCardHistorico.create({ data: { cardId: card, acao: "CARD_MOVIDO", usuarioId: 7,
    valorAnteriorJson: JSON.stringify(anterior), valorNovoJson: JSON.stringify(novo) } });
  return (await publicarEventoBpm({ tipo: "CARD_MOVIDO", entidadeTipo: "CARD", entidadeId: card, cardId: card, pipelineId: origem,
    atorTipo: "USUARIO", atorUserId: 7, correlationId: "teste-financeiro", idempotencyKey: "transition:fechamento-ficticio",
    causationId: historico.id, valorAnterior: anterior, valorNovo: novo }, db))!;
}
beforeEach(async () => {
  vi.clearAllMocks(); estado.falharOutbox = false; estado.auth.mockResolvedValue({ user: { id: "7", role: "Admin" } }); diretorio = mkdtempSync("/dev/shm/alpha-financeiro-livre-");
  const filename = join(diretorio, "privado.sqlite"); const sqlite = new DatabaseSync(filename);
  try { tabelas(sqlite); } finally { sqlite.close(); }
  db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) }); estado.client = db;
  await db.$executeRaw`INSERT INTO usuarios(id,nome,status,role) VALUES(7,'Admin fictício','ATIVO','Admin')`;
  await db.cliente.create({ data: { id: 5, razaoSocial: "Empresa fictícia" } });
  await db.bpmPipeline.create({ data: { id: origem, nome: "Revisão de Radar" } });
  await db.bpmEtapa.create({ data: { id: fechado, pipelineId: origem, nome: "Contrato fechado", chave: "fechado", ordem: 1 } });
  await db.bpmPipeline.create({ data: { id: financeiro, nome: "Financeiro fictício", chave: "financeiro" } });
  await db.bpmEtapa.create({ data: { id: novoContrato, pipelineId: financeiro, nome: "Novo contrato", ordem: 0 } });
  await db.bpmCard.create({ data: { id: card, pipelineId: origem, etapaId: fechado, empresaId: 5, responsavelId: 7, versao: 1 } });
  await db.bpmAutomacao.create({ data: { id: "c666666666666666666666666", nome: "Fechado para Financeiro", pipelineId: origem, etapaId: fechado,
    gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametrosJson: JSON.stringify(parametros), criadoPorId: 7 } });
  await db.bpmAutomacaoVersao.create({ data: { id: "versao", automacaoId: "c666666666666666666666666", versao: 1, status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA",
    gatilhoConfigJson: JSON.stringify({ etapaId: fechado }), grafoJson: JSON.stringify(grafo), criadoPorId: 7, ativadaEm: new Date("2026-01-01") } });
});
afterEach(async () => { await db?.$disconnect(); estado.client = null; if (diretorio) rmSync(diretorio, { recursive: true, force: true }); });

describe("fechamento livre → Financeiro em SQLite privado", () => {
  it("cria um destino vinculado e pendente, preserva origem e suprime cadeias no destino", async () => {
    const e = await evento();
    const run = await executarFinanceiroMovimentoLivreAgora(card, e.id);
    expect(run.fila).toMatchObject({ executados: 1, falhos: 0 });
    const vinculo = await db.bpmCardVinculo.findFirstOrThrow({ where: { cardOrigemId: card } });
    expect(await db.bpmCard.findUnique({ where: { id: vinculo.cardDestinoId } })).toMatchObject({ empresaId: 5, pipelineId: financeiro, etapaId: novoContrato });
    expect(await db.bpmCardHistorico.findUnique({ where: { id: `recepcao-pipeline:${vinculo.cardDestinoId}` } })).toMatchObject({ acao: "RECEPCAO_PIPELINE_PENDENTE" });
    const criado = await db.bpmEventoDominio.findFirstOrThrow({ where: { cardId: vinculo.cardDestinoId, tipo: "CARD_CRIADO" } });
    expect(JSON.parse(criado.valorNovoJson!)).toMatchObject({ automacoesSuprimidas: true });
    expect(ativarCadenciasNaEntradaBpm).not.toHaveBeenCalled();
    expect(await db.bpmCard.findUnique({ where: { id: card } })).toMatchObject({ etapaId: fechado, status: "ATIVO" });
    await executarFinanceiroMovimentoLivreAgora(card, e.id);
    expect(await db.bpmCard.count()).toBe(2); expect(await db.bpmCardVinculo.count()).toBe(1);
  });
  it("eventos antigos sem marcador novo não são reinterpretados", async () => {
    const e = await evento(false); await executarFinanceiroMovimentoLivreAgora(card, e.id);
    expect(await db.bpmCard.count()).toBe(1); expect(await db.bpmCardVinculo.count()).toBe(0);
  });
  it.each(["grafo misto", "destino inativo", "condição falsa", "autoridade revogada"])("recusa %s antes de criar destino", async caso => {
    const e = await evento();
    if (caso === "grafo misto") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { grafoJson: JSON.stringify({ ...grafo, nos: [...grafo.nos, { id: "extra", tipo: "FIM" }] }) } });
    if (caso === "destino inativo") await db.bpmPipeline.update({ where: { id: financeiro }, data: { ativo: false } });
    if (caso === "condição falsa") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { condicaoJson: JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "igual", valor: "ausente" }] }) } });
    if (caso === "autoridade revogada") await db.usuarios.update({ where: { id: 7 }, data: { status: "INATIVO" } });
    await executarFinanceiroMovimentoLivreAgora(card, e.id);
    expect(await db.bpmCard.count()).toBe(1);
  });
  it("revalida autoridade entre materialização e efeito transacional", async () => {
    const e = await evento(); await materializarExecucoesEventosBpm(100, db, { modo: "FINANCEIRO_MOVIMENTO_LIVRE", cardId: card, eventoId: e.id });
    const exec = await db.bpmAutomacaoExecucao.findFirstOrThrow({ where: { status: "PENDENTE" } });
    await db.usuarios.update({ where: { id: 7 }, data: { status: "INATIVO" } });
    await expect(executarEncaminhamentoBpm({ cardId: card, automacaoId: "c666666666666666666666666", execucaoId: exec.id, parametros })).rejects.toThrow("AUTORIDADE_MOVIMENTO_LIVRE_REVOGADA");
    expect(await db.bpmCard.count()).toBe(1);
  });
  it("chamada direta não substitui os parâmetros configurados do grafo", async () => {
    const e = await evento(); await materializarExecucoesEventosBpm(100, db, { modo: "FINANCEIRO_MOVIMENTO_LIVRE", cardId: card, eventoId: e.id });
    const exec = await db.bpmAutomacaoExecucao.findFirstOrThrow({ where: { status: "PENDENTE" } });
    await expect(executarEncaminhamentoBpm({ cardId: card, automacaoId: "c666666666666666666666666", execucaoId: exec.id, parametros: { ...parametros, responsavelId: 999 } })).rejects.toThrow("Parâmetros do encaminhamento financeiro divergentes");
    expect(await db.bpmCard.count()).toBe(1);
  });
});


it("outbox falha desfaz criação; retry é único e preserva posterior edição humana", async () => {
  const e = await evento(); await materializarExecucoesEventosBpm(100, db, { modo: "FINANCEIRO_MOVIMENTO_LIVRE", cardId: card, eventoId: e.id });
  const exec = await db.bpmAutomacaoExecucao.findFirstOrThrow({ where: { status: "PENDENTE" } });
  const executar = () => executarEncaminhamentoBpm({ cardId: card, automacaoId: "c666666666666666666666666", execucaoId: exec.id, parametros });
  estado.falharOutbox = true;
  await expect(executar()).rejects.toThrow("Falha de outbox fictícia");
  expect(await db.bpmCard.count()).toBe(1); expect(await db.bpmCardVinculo.count()).toBe(0);
  expect((await db.bpmCard.findUniqueOrThrow({ where: { id: card } })).versao).toBe(1);
  estado.falharOutbox = false;
  await db.bpmCampo.create({ data: { id: "valor", pipelineId: financeiro, nome: "Valor", chave: "valor", tipo: "texto" } });
  await db.bpmCampoEtapaConfig.create({ data: { campoId: "valor", etapaId: novoContrato, visivel: true } });
  await db.bpmEtapaFormulario.create({ data: { etapaId: novoContrato, secoes: { create: {
    chave: "dados", titulo: "Dados", componentes: { create: { chave: "valor", tipo: "CAMPO", campoId: "valor" } },
  } } } });
  await db.bpmCardCampoValor.create({ data: { cardId: card, campoId: "valor", valor: "1000" } });
  const criado = await executar();
  expect((await db.bpmCardCampoValor.findUniqueOrThrow({ where: { cardId_campoId: { cardId: criado.cardId, campoId: "valor" } } })).valor).toBe("1000");
  await db.bpmCardCampoValor.update({ where: { cardId_campoId: { cardId: criado.cardId, campoId: "valor" } }, data: { valor: "1500" } });
  expect(await executar()).toMatchObject({ existente: true, cardId: criado.cardId });
  expect((await db.bpmCardCampoValor.findUniqueOrThrow({ where: { cardId_campoId: { cardId: criado.cardId, campoId: "valor" } } })).valor).toBe("1500");
  expect(await db.bpmCard.count()).toBe(2); expect(await db.bpmCardVinculo.count()).toBe(1);
});

it("concorrência no novo autorizador converge em um único destino", async () => {
  const e = await evento(); await materializarExecucoesEventosBpm(100, db, { modo: "FINANCEIRO_MOVIMENTO_LIVRE", cardId: card, eventoId: e.id });
  const exec = await db.bpmAutomacaoExecucao.findFirstOrThrow({ where: { status: "PENDENTE" } });
  const executar = () => executarEncaminhamentoBpm({ cardId: card, automacaoId: "c666666666666666666666666", execucaoId: exec.id, parametros });
  const resultados = await Promise.allSettled([executar(), executar()]);
  expect(resultados.some(item => item.status === "fulfilled")).toBe(true);
  expect(await executar()).toMatchObject({ existente: true });
  expect(await db.bpmCard.count()).toBe(2); expect(await db.bpmCardVinculo.count()).toBe(1);
});

it.each(["condição", "destino", "versão"])("worker revalida %s após materializar", async caso => {
  const e = await evento(); await materializarExecucoesEventosBpm(100, db, { modo: "FINANCEIRO_MOVIMENTO_LIVRE", cardId: card, eventoId: e.id });
  if (caso === "condição") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { condicaoJson: JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "igual", valor: "ausente" }] }) } });
  if (caso === "destino") await db.bpmPipeline.update({ where: { id: financeiro }, data: { ativo: false } });
  if (caso === "versão") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { status: "ARQUIVADA" } });
  await executarFinanceiroMovimentoLivreAgora(card, e.id);
  expect(await db.bpmCard.count()).toBe(1);
});


const solicitarRecuperacao = () => RecuperarEncaminhamentoFinanceiroCardBpm({ cardId: card, automacaoId: "c666666666666666666666666",
  etapaOrigemEsperadaId: fechado, versaoEsperada: 1, idempotencyKey: "recuperacao-ficticia-sem-botao" });
it("recuperação autenticada cria solicitação nova sem reinterpretar o evento antigo", async () => {
  const antigo = await evento(false); const original = antigo.valorNovoJson;
  expect(await solicitarRecuperacao()).toMatchObject({ success: true });
  expect((await db.bpmEventoDominio.findUniqueOrThrow({ where: { id: antigo.id } })).valorNovoJson).toBe(original);
  expect(await db.bpmCard.count()).toBe(2);
  const registro = await db.bpmCardHistorico.findFirstOrThrow({ where: { cardId: card, acao: "ENCAMINHAMENTO_ADMIN_SOLICITADO" } });
  expect(registro.usuarioId).toBe(7); expect(JSON.parse(registro.valorNovoJson!)).toMatchObject({ recuperacaoAutomaticaFinanceiro: true });
});
it.each(["sessão ausente", "condição falsa", "fora de fechado", "outro destino"])("recuperação recusa %s", async caso => {
  if (caso === "sessão ausente") estado.auth.mockResolvedValue(null);
  if (caso === "condição falsa") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { condicaoJson: JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "igual", valor: "ausente" }] }) } });
  if (caso === "fora de fechado") await db.bpmEtapa.update({ where: { id: fechado }, data: { chave: "em_tratativa" } });
  if (caso === "outro destino") await db.bpmPipeline.update({ where: { id: financeiro }, data: { chave: "operacional" } });
  expect(await solicitarRecuperacao()).toMatchObject({ success: false }); expect(await db.bpmCard.count()).toBe(1);
  expect(await db.bpmAutomacaoExecucao.count()).toBe(0);
});

it("retry de recuperação falha conserva condição e não vira envio genérico", async () => {
  estado.falharOutbox = true; expect(await solicitarRecuperacao()).toMatchObject({ success: false });
  const exec = await db.bpmAutomacaoExecucao.findFirstOrThrow({ where: { status: "FALHA" } });
  estado.falharOutbox = false;
  await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { condicaoJson: JSON.stringify({ operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "igual", valor: "ausente" }] }) } });
  expect(await RepetirEncaminhamentoCardBpm({ cardId: card, execucaoId: exec.id })).toMatchObject({ success: false });
  expect(await db.bpmCard.count()).toBe(1); expect(await db.bpmCardVinculo.count()).toBe(0);
});
