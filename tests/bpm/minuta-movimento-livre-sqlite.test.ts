import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, chave) => {
  if (!estado.client) throw new Error("Fixture privada não inicializada");
  const valor = Reflect.get(estado.client, chave);
  return typeof valor === "function" ? valor.bind(estado.client) : valor;
} }) }));
vi.mock("@/lib/bpm/checklists/integracao", () => ({
  carregarResumoChecklistAplicavelSeguro: vi.fn().mockResolvedValue({ total: 0, concluidos: 0, percentual: 0, concluido: false, pendentesObrigatorios: 0, possuiPendenciaObrigatoria: false }),
  montarFatoChecklistAutomacaoBpm: vi.fn().mockResolvedValue({ placeholders: {} }),
}));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: vi.fn() }));
vi.mock("@/lib/bibble/gerar-ficha-server", () => ({ gerarFichaServer: vi.fn() }));

import { materializarExecucoesEventosBpm, publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";
import { executarMinutaMovimentoLivreAgora } from "@/lib/bpm/automacoes/orquestrador";
import { grafoEhMinutaConfigurada } from "@/lib/bpm/automacoes/minuta-movimento-livre";
import { resolverDocumentosContratacaoComercial } from "@/lib/bpm/contratacao-comercial-server";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => { exec(sql: string): void; close(): void };
};
const pipeline = "c111111111111111111111111";
const etapa = "c222222222222222222222222";
const card = "c333333333333333333333333";
const template = "c444444444444444444444444";
const campo = "c555555555555555555555555";
const comercial = "c666666666666666666666666";
const comercialPipeline = "c777777777777777777777777";
const comercialEtapa = "c888888888888888888888888";
const parametros = { templateId: template, campoIdContrato: campo, titulo: "Minuta fictícia", permitirPendencias: true, variaveis: { __bpmCardId: "forjado" } };
const grafo = { inicioId: "gerar", nos: [
  { id: "gerar", tipo: "ACAO", acaoTipo: "GERAR_CONTRATO", parametros, proximoId: "fim" }, { id: "fim", tipo: "FIM" },
] };
const condicao = { operador: "AND", condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "servico" }, operador: "contem", valor: "Radar" }] };
let db: PrismaClient;
let diretorio: string;

// Mesmo padrão das fixtures SQLite de contratação: somente banco novo privado,
// tabelas e unicidades necessárias derivadas do schema, sem env ou migration real.
function tabelas(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modelos = ["Cliente", "usuarios", "Setor", "SetorPermissao", "UsuarioPermissaoOverride", "BpmPipelineSetor", "BpmEtapaVisibilidade",
    "BpmCard", "BpmPipeline", "BpmEtapa", "BpmCardVinculo", "BpmCardHistorico", "BpmCampo", "BpmCampoPipeline", "BpmCardCampoValor", "BpmCardAnexo", "BpmCardServicoContexto", "ClienteServico",
    "DocumentoTemplate", "DocumentoClasula", "DocumentoGerado", "DocumentoClasulaGerada", "BpmTarefa", "BpmEventoDominio", "BpmAutomacao", "BpmAutomacaoVersao", "BpmAutomacaoExecucao", "BpmAutomacaoLease", "BpmAutomacaoPassoExecucao"];
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

async function evento(alteracoes: Record<string, unknown> = {}, novo: Record<string, unknown> = {}) {
  const autoridade = novo.movimentoLivre ?? { tipo: "ADMIN", setor: null };
  const historico = await db.bpmCardHistorico.create({ data: { cardId: card, acao: "CARD_MOVIDO", usuarioId: 7,
    valorAnteriorJson: JSON.stringify({ etapaId: "origem", versao: 0 }),
    valorNovoJson: JSON.stringify({ etapaId: etapa, versao: 1, movimentoLivre: autoridade }) } });
  return publicarEventoBpm({ tipo: "CARD_MOVIDO", entidadeTipo: "CARD", entidadeId: card, cardId: card, pipelineId: pipeline,
    atorTipo: "USUARIO", atorUserId: 7, correlationId: "movimento", idempotencyKey: "transition:novo-movimento", profundidade: 0, causationId: historico.id,
    valorAnterior: { etapaId: "origem", versao: 0 }, valorNovo: { etapaId: etapa, versao: 1, automacoesSuprimidas: true, permitirMinutaConfigurada: true, movimentoLivre: autoridade, ...novo }, ...alteracoes }, db);
}
async function materializar() { return materializarExecucoesEventosBpm(100, db, { cardId: card }); }
async function executar() { return processarFilaAutomacoesCentraisBpm(20, { cardId: card }); }
async function semEfeitos() {
  expect(await db.documentoGerado.count()).toBe(0);
  expect(await db.bpmCardAnexo.count()).toBe(0);
  expect(await db.bpmTarefa.count()).toBe(0);
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  diretorio = mkdtempSync(join(tmpdir(), "alpha-minuta-livre-"));
  const filename = join(diretorio, "privado.sqlite");
  const sqlite = new DatabaseSync(filename);
  try { sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;"); tabelas(sqlite); } finally { sqlite.close(); }
  db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) });
  estado.client = db;
  await db.$executeRaw`INSERT INTO usuarios(id,nome,status,role) VALUES(7,'Admin fictício','ATIVO','Admin')`;
  await db.cliente.create({ data: { id: 5, razaoSocial: "Empresa fictícia" } });
  await db.bpmPipeline.create({ data: { id: pipeline, nome: "Financeiro fictício", chave: "financeiro" } });
  await db.bpmEtapa.create({ data: { id: etapa, pipelineId: pipeline, nome: "Etapa configurada", ordem: 1 } });
  await db.bpmCard.create({ data: { id: card, pipelineId: pipeline, etapaId: etapa, empresaId: 5, responsavelId: 7, servico: "Revisão RADAR - 150K" } });
  await db.bpmPipeline.create({ data: { id: comercialPipeline, nome: "Comercial fictício", chave: "comercial" } });
  await db.bpmEtapa.create({ data: { id: comercialEtapa, pipelineId: comercialPipeline, nome: "Fechado", chave: "fechado", ordem: 1 } });
  await db.bpmCard.create({ data: { id: comercial, pipelineId: comercialPipeline, etapaId: comercialEtapa, empresaId: 5, responsavelId: 7, statusPosFechamento: "AGUARDANDO_CONTRATO" } });
  await db.bpmCardVinculo.create({ data: { cardOrigemId: comercial, cardDestinoId: card } });
  await db.bpmCampo.create({ data: { id: campo, pipelineId: pipeline, nome: "Contrato", chave: C.LINK_CONTRATO, tipo: "arquivo" } });
  await db.documentoTemplate.create({ data: { id: template, titulo: "Modelo fictício", variaveisJson: [], criadoPorId: 7 } });
  await db.bpmAutomacao.create({ data: { id: "regra", nome: "Minuta configurada", pipelineId: pipeline, etapaId: etapa, gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "GERAR_CONTRATO", criadoPorId: 7 } });
  await db.bpmAutomacaoVersao.create({ data: { id: "versao", automacaoId: "regra", versao: 1, status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA", gatilhoConfigJson: JSON.stringify({ etapaId: etapa }), grafoJson: JSON.stringify(grafo), condicaoJson: JSON.stringify(condicao), criadoPorId: 7, ativadaEm: new Date("2026-01-01") } });
});
afterEach(async () => { await db?.$disconnect(); estado.client = null; if (diretorio) rmSync(diretorio, { recursive: true, force: true }); vi.unstubAllEnvs(); });

describe("minuta de movimento livre em Prisma/SQLite privado", () => {
  it.each(["Admin", "LIDER FINANCEIRO"])("%s gera uma conferência vinculada sem liberar o Comercial; replay/reentrada reutilizam", async (role) => {
    if (role.startsWith("LIDER")) {
      await db.usuarios.update({ where: { id: 7 }, data: { role, permissoes: "crm" } });
      await db.setor.create({ data: { id: 1, nome: "FINANCEIRO", ativo: true } });
      await db.bpmPipelineSetor.create({ data: { pipelineId: pipeline, setorId: 1 } });
      await db.bpmPipeline.update({ where: { id: pipeline }, data: { visualizacaoConfigJson: JSON.stringify({
        permissoesPipeline: { version: 2, regras: [{ tipo: "USUARIO", id: 7, nivel: "ADMINISTRATIVO" }] },
      }) } });
    }
    await evento({}, role.startsWith("LIDER") ? { movimentoLivre: { tipo: "ADMIN_PIPELINE", setor: null } } : {});
    const materializacao = await materializar();
    expect((await db.bpmAutomacaoExecucao.findFirst())?.resultadoJson).toBeNull();
    expect(materializacao).toMatchObject({ criadas: 1 });
    expect(await executar()).toMatchObject({ executados: 1, falhos: 0 });
    const documento = await db.documentoGerado.findFirstOrThrow();
    expect(documento.status).toBe("CONFERENCIA");
    expect(documento.clienteId).toBe(5);
    expect(JSON.parse(String(documento.variaveisJson)).__bpmCardId).toBe(card);
    const anexo = await db.bpmCardAnexo.findFirstOrThrow();
    expect(anexo).toMatchObject({ cardId: card, campoId: campo, tipo: "application/x-painel-alpha-documento" });
    expect((await db.bpmCardCampoValor.findFirstOrThrow()).valor).toBe(anexo.id);
    expect(await resolverDocumentosContratacaoComercial(comercial, db)).toMatchObject({ paraEnvio: { estado: "PENDENTE" }, assinado: { estado: "PENDENTE" } });
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: comercial } })).statusPosFechamento).toBe("AGUARDANDO_CONTRATO");
    expect(await db.bpmTarefa.count()).toBe(0);
    expect(await materializar()).toMatchObject({ criadas: 0 });
    await evento({ correlationId: "reentrada", idempotencyKey: "transition:reentrada" });
    expect(await materializar()).toMatchObject({ criadas: 1 });
    await executar();
    expect(await db.documentoGerado.count()).toBe(1);
    expect(await db.bpmCardAnexo.count()).toBe(1);
    expect(await db.bpmCard.count()).toBe(2);
  });

  it.each(["antigo", "false", "ator", "inativo", "pipeline", "etapa", "arquivado", "cancelado", "condicao", "regra", "versao", "gatilho"])("bloqueia materialização indevida: %s", async (caso) => {
    if (caso === "inativo") await db.usuarios.update({ where: { id: 7 }, data: { status: "INATIVO" } });
    if (caso === "pipeline") await db.bpmPipeline.update({ where: { id: pipeline }, data: { ativo: false } });
    if (caso === "etapa") await db.bpmEtapa.update({ where: { id: etapa }, data: { ativo: false } });
    if (["arquivado", "cancelado"].includes(caso)) await db.bpmCard.update({ where: { id: card }, data: { status: caso.toUpperCase() } });
    if (caso === "condicao") await db.bpmCard.update({ where: { id: card }, data: { servico: "Outro serviço" } });
    if (caso === "regra") await db.bpmAutomacao.update({ where: { id: "regra" }, data: { ativa: false } });
    if (caso === "versao") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { status: "ARQUIVADA" } });
    if (caso === "gatilho") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { gatilhoTipo: "SAIR_COLUNA" } });
    await evento(caso === "ator" ? { atorTipo: "SISTEMA" } : {}, caso === "antigo" ? { permitirMinutaConfigurada: undefined } : caso === "false" ? { permitirMinutaConfigurada: false } : {});
    expect(await materializar()).toMatchObject({ criadas: 0 });
    await executar();
    await semEfeitos();
  });

  it.each(["revogada", "etapa", "regra", "versao", "condicao", "grafo"])("revalida após enfileirar: %s", async (caso) => {
    await evento(); expect(await materializar()).toMatchObject({ criadas: 1 });
    if (caso === "revogada") await db.usuarios.update({ where: { id: 7 }, data: { role: "COMERCIAL", permissoes: "[]" } });
    if (caso === "etapa") {
      await db.bpmEtapa.create({ data: { id: "outra", nome: "Outra", pipelineId: pipeline, ordem: 2 } });
      await db.bpmCard.update({ where: { id: card }, data: { etapaId: "outra" } });
    }
    if (caso === "regra") await db.bpmAutomacao.update({ where: { id: "regra" }, data: { ativa: false } });
    if (caso === "versao") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { status: "ARQUIVADA" } });
    if (caso === "condicao") await db.bpmCard.update({ where: { id: card }, data: { servico: "Outro" } });
    if (caso === "grafo") await db.bpmAutomacaoVersao.update({ where: { id: "versao" }, data: { grafoJson: JSON.stringify({ inicioId: "nota", nos: [{ id: "nota", tipo: "ACAO", acaoTipo: "ADICIONAR_ANOTACAO", parametros: { texto: "Não executar" }, proximoId: "fim" }, { id: "fim", tipo: "FIM" }] }) } });
    expect(await executar()).toMatchObject({ ignorados: 1, executados: 0 });
    await semEfeitos();
    expect(await db.bpmAutomacaoPassoExecucao.count()).toBe(0);
  });

  it("materializadores e workers concorrentes convergem com unicidade/claim/lease reais", async () => {
    await evento();
    const materializacoes = await Promise.allSettled([materializar(), materializar()]);
    expect(materializacoes.filter((item) => item.status === "rejected")).toEqual([]);
    await materializar();
    expect(await db.bpmAutomacaoExecucao.count()).toBe(1);
    await Promise.allSettled([executar(), executar()]);
    await executar();
    expect(await db.documentoGerado.count()).toBe(1);
    expect(await db.bpmCardAnexo.count()).toBe(1);
    expect(await db.bpmTarefa.count()).toBe(0);
  });

  it("erro do gerador mantém retry e não cria uma minuta falsa", async () => {
    await evento(); await materializar();
    await db.documentoTemplate.update({ where: { id: template }, data: { status: "ARQUIVADO" } });
    expect(await executar()).toMatchObject({ adiados: 1, executados: 0 });
    expect(await db.bpmAutomacaoExecucao.findFirst()).toMatchObject({ status: "PENDENTE", mensagemErro: expect.stringContaining("Template") });
    await semEfeitos();
    await db.documentoTemplate.update({ where: { id: template }, data: { status: "ATIVO" } });
    await db.bpmAutomacaoExecucao.updateMany({ data: { disponivelEm: new Date(0) } });
    expect(await executar()).toMatchObject({ executados: 1 });
    expect(await db.documentoGerado.count()).toBe(1);
  });

  it.each(["livre", "lease-ocupado", "resgate-alvo"])("flush imediato isolado preserva todas as filas sentinela: %s", async (modo) => {
    const alvo = await evento();
    if (!alvo) throw new Error("Evento alvo ausente");
    const misto = { inicioId: "gerar", nos: [{ ...grafo.nos[0], proximoId: "nota" },
      { id: "nota", tipo: "ACAO", acaoTipo: "ADICIONAR_ANOTACAO", parametros: { texto: "Não executar" }, proximoId: "fim" }, grafo.nos[1]] };
    await db.bpmAutomacao.create({ data: { id: "regra-mista", nome: "Mista", pipelineId: pipeline, etapaId: etapa,
      gatilhoTipo: "ENTRAR_COLUNA", acaoTipo: "GERAR_CONTRATO", criadoPorId: 7 } });
    await db.bpmAutomacaoVersao.create({ data: { id: "versao-mista", automacaoId: "regra-mista", versao: 1,
      status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA", grafoJson: JSON.stringify(misto), criadoPorId: 7, ativadaEm: new Date("2026-01-01") } });
    const sentinelas = [];
    for (const [id, status] of [["antigo-pendente", "PENDENTE"], ["antigo-vencido", "EM_EXECUCAO"], ["outro-card", "EM_EXECUCAO"]]) {
      const antigo = await evento({ correlationId: id, idempotencyKey: `transition:${id}` });
      if (!antigo) throw new Error("Evento sentinela ausente");
      sentinelas.push(await db.bpmAutomacaoExecucao.create({ data: {
        id, automacaoId: "regra", automacaoVersaoId: "versao", eventoId: antigo.id, eventoChave: id,
        cardId: id === "outro-card" ? comercial : card, gatilhoTipo: "ENTRAR_COLUNA", status,
        tentativas: 1, iniciadoEm: new Date(0), claimToken: "sentinela", disponivelEm: new Date(0),
      } }));
    }
    sentinelas.push(await db.bpmAutomacaoExecucao.create({ data: { id: "mista-atual", automacaoId: "regra-mista",
      automacaoVersaoId: "versao-mista", eventoId: alvo.id, eventoChave: "mista", cardId: card,
      gatilhoTipo: "ENTRAR_COLUNA", status: "EM_EXECUCAO", tentativas: 1, iniciadoEm: new Date(0), claimToken: "mista-sentinela" } }));
    sentinelas.push(await db.bpmAutomacaoExecucao.create({ data: { id: "legada-atual", automacaoId: "regra",
      eventoId: alvo.id, eventoChave: "legada", cardId: card, gatilhoTipo: "ENTRAR_COLUNA" } }));
    if (modo === "lease-ocupado") await db.bpmAutomacaoLease.create({ data: { recurso: `card:${card}`, titular: "outro-worker", fencingToken: 1, expiraEm: new Date(Date.now() + 60_000) } });
    if (modo === "resgate-alvo") {
      await materializarExecucoesEventosBpm(100, db, { modo: "MINUTA_MOVIMENTO_LIVRE", cardId: card, eventoId: alvo.id });
      await db.bpmAutomacaoExecucao.updateMany({ where: { eventoId: alvo.id, automacaoVersaoId: "versao" }, data: { status: "EM_EXECUCAO", tentativas: 1, iniciadoEm: new Date(0), claimToken: "alvo-antigo" } });
    }
    const retorno = await executarMinutaMovimentoLivreAgora(card, alvo.id);
    expect(retorno.fila).toMatchObject(modo === "lease-ocupado" ? { executados: 0, adiados: 1 } : { executados: 1 });
    expect(await db.bpmAutomacaoExecucao.findMany({ where: { id: { in: sentinelas.map((item) => item.id) } }, orderBy: { id: "asc" } }))
      .toEqual(sentinelas.sort((a, b) => a.id.localeCompare(b.id)));
    expect(await db.documentoGerado.count()).toBe(modo === "lease-ocupado" ? 0 : 1);
    expect(await db.bpmTarefa.count()).toBe(0);
    expect(await db.bpmCard.count()).toBe(2);
  });

  it("chamada normal filtrada por card mantém o resgate global existente sem executar outro card", async () => {
    await db.bpmAutomacaoExecucao.create({ data: { id: "normal-vencida", automacaoId: "regra", automacaoVersaoId: "versao",
      eventoChave: "normal-vencida", cardId: comercial, gatilhoTipo: "ENTRAR_COLUNA", status: "EM_EXECUCAO",
      tentativas: 1, iniciadoEm: new Date(0), claimToken: "antigo" } });
    expect(await executar()).toMatchObject({ encontrados: 0, executados: 0 });
    expect(await db.bpmAutomacaoExecucao.findUnique({ where: { id: "normal-vencida" } }))
      .toMatchObject({ status: "PENDENTE", claimToken: null, tentativas: 1 });
    await semEfeitos();
  });
});

describe("classificação documental integral", () => {
  it("aceita apenas ação válida diretamente ligada ao fim", () => {
    expect(grafoEhMinutaConfigurada(grafo)).toBe(true);
    expect(grafoEhMinutaConfigurada({ ...grafo, nos: [grafo.nos[0], grafo.nos[1], { id: "extra", tipo: "FIM" }] })).toBe(false);
    expect(grafoEhMinutaConfigurada({ ...grafo, nos: [{ ...grafo.nos[0], parametros: {} }, grafo.nos[1]] })).toBe(false);
  });
  it.each(["CHAMAR_HTTP", "CRIAR_CARD_OUTRO_PIPELINE", "ALTERAR_CAMPO", "ENVIAR_EMAIL", "ESPERA", "CONDICAO"])("grafo misto %s é recusado por inteiro", (acaoTipo) => {
    const extra = acaoTipo === "ESPERA" ? { id: "extra", tipo: "ESPERA", minutos: 1, proximoId: "fim" }
      : acaoTipo === "CONDICAO" ? { id: "extra", tipo: "CONDICAO", condicao, entaoId: "fim", senaoId: "fim" }
      : { id: "extra", tipo: "ACAO", acaoTipo, parametros: {}, proximoId: "fim" };
    expect(grafoEhMinutaConfigurada({ ...grafo, nos: [{ ...grafo.nos[0], proximoId: "extra" }, extra, grafo.nos[1]] })).toBe(false);
  });
});
