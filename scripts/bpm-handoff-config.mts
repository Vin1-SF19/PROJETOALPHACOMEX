/** Plano e publicação protegida do handoff Financeiro → Operacional. Sem --apply: leitura. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const { validarGrafoAutomacao, gatilhoConfigSchema } = await import("../src/lib/bpm/automacoes/central-schemas");
const args = new Map(process.argv.slice(2).map((item) => {
  const indice = item.indexOf("=");
  return indice < 0 ? [item, ""] : [item.slice(0, indice), item.slice(indice + 1)];
}));
const novaChave = "financeiro.handoff.contrato.concluido.operacional";
const comercialAutomacaoId = "cmucr4u4700004rih9u8r3kab";
const cardConcluidoId = "cmugxle5800060agmhtfqtnjg";

const pipelines = await db.bpmPipeline.findMany({ where: { chave: { in: ["comercial", "financeiro", "operacional", "radar"] } },
  select: { id: true, chave: true, ativo: true, configVersion: true, etapas: {
    where: { ativo: true }, select: { id: true, chave: true, ehInicial: true, ehFinal: true },
  } } });
const porChave = new Map(pipelines.map((item) => [item.chave, item]));
const comercial = porChave.get("comercial");
const financeiro = porChave.get("financeiro");
const operacional = porChave.get("operacional");
const radarAntigo = porChave.get("radar");
if (!comercial?.ativo || !financeiro?.ativo || !operacional?.ativo || radarAntigo?.ativo) {
  throw new Error("Estado dos pipelines diferente do inventário aprovado");
}
const origemComercial = comercial.etapas.find((item) => item.chave === "fechado" && item.ehFinal);
const origemFinanceiro = financeiro.etapas.find((item) => item.chave === "contratacao_finalizada" && item.ehFinal);
const entradaFinanceiro = financeiro.etapas.find((item) => item.chave === "solicitacao_contrato" && item.ehInicial);
const entradaOperacional = operacional.etapas.find((item) => item.chave === "boas_vindas" && item.ehInicial);
if (!origemComercial || !origemFinanceiro || !entradaFinanceiro || !entradaOperacional) throw new Error("Etapas de saída/entrada divergentes");

const [comercialAutomacao, financeiroAutomacao, cardConcluido, entradasFinal, admin] = await Promise.all([
  db.bpmAutomacao.findUnique({ where: { id: comercialAutomacaoId }, include: { versoes: { where: { status: "ATIVA" } } } }),
  db.bpmAutomacao.findUnique({ where: { pipelineId_chave: { pipelineId: financeiro.id, chave: novaChave } }, include: { versoes: true } }),
  db.bpmCard.findUnique({ where: { id: cardConcluidoId }, select: { id: true, pipelineId: true, etapaId: true, status: true, vinculosOrigem: { select: { cardDestino: { select: { pipelineId: true } } } } } }),
  db.bpmTransicaoEtapa.findMany({ where: { etapaDestinoId: origemFinanceiro.id, permitida: true }, select: { lifecycleDestino: true } }),
  db.usuarios.findUnique({ where: { id: 1 }, select: { role: true, status: true } }),
]);
if (!comercialAutomacao?.ativa || comercialAutomacao.etapaId !== origemComercial.id || comercialAutomacao.versoes.length !== 1
  || comercialAutomacao.versoes[0].versao !== 2 || comercialAutomacao.versoes[0].gatilhoTipo !== "ENTRAR_COLUNA") {
  throw new Error("Automação comercial ativa não corresponde à versão auditada");
}
if (financeiroAutomacao) throw new Error("Automação Financeiro → Operacional já existe; revisar antes de publicar");
if (!cardConcluido || cardConcluido.pipelineId !== financeiro.id || cardConcluido.etapaId !== origemFinanceiro.id
  || cardConcluido.status !== "CONCLUIDO" || cardConcluido.vinculosOrigem.some((item) => item.cardDestino.pipelineId === operacional.id)) {
  throw new Error("Card concluído de referência mudou após o diagnóstico");
}
if (!entradasFinal.length || entradasFinal.some((item) => item.lifecycleDestino !== "CONCLUIDO")) {
  throw new Error("A entrada na etapa final não garante contrato concluído");
}
if (admin?.role !== "Admin" || admin.status !== "ATIVO") throw new Error("Responsável de Boas-vindas indisponível");

const grafoComercialAtual = validarGrafoAutomacao(JSON.parse(comercialAutomacao.versoes[0].grafoJson));
const primeiraAcao = grafoComercialAtual.nos.find((item) => item.id === grafoComercialAtual.inicioId);
const segundaAcao = primeiraAcao?.tipo === "ACAO" ? grafoComercialAtual.nos.find((item) => item.id === primeiraAcao.proximoId) : null;
if (primeiraAcao?.tipo !== "ACAO" || primeiraAcao.acaoTipo !== "CRIAR_CARD_OUTRO_PIPELINE"
  || primeiraAcao.parametros.pipelineId !== financeiro.id || primeiraAcao.parametros.etapaId !== entradaFinanceiro.id
  || segundaAcao?.tipo !== "ACAO" || segundaAcao.acaoTipo !== "CRIAR_CARD_OUTRO_PIPELINE"
  || segundaAcao.parametros.pipelineId !== radarAntigo?.id) {
  throw new Error("Grafo comercial mudou após o inventário");
}
const grafoComercialNovo = validarGrafoAutomacao({ inicioId: "financeiro", nos: [
  { id: "financeiro", tipo: "ACAO", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: primeiraAcao.parametros, proximoId: "fim" },
  { id: "fim", tipo: "FIM" },
] });
const grafoFinanceiro = validarGrafoAutomacao({ inicioId: "operacional", nos: [
  { id: "operacional", tipo: "ACAO", acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametros: {
    pipelineId: operacional.id, etapaId: entradaOperacional.id, responsavelId: 1,
    vincularAoOriginal: true, somenteSeNaoExistirAtivo: true,
  }, proximoId: "fim" },
  { id: "fim", tipo: "FIM" },
] });
const gatilhoFinanceiro = gatilhoConfigSchema.parse({ escopo: "ETAPAS", etapaId: origemFinanceiro.id });
const eventos = await db.bpmEventoDominio.findMany({ where: { pipelineId: financeiro.id, tipo: "CARD_MOVIDO", cardId: cardConcluidoId },
  select: { id: true, ocorridoEm: true, valorNovoJson: true }, orderBy: { ocorridoEm: "desc" } });
const eventosConclusao = eventos.filter((item) => {
  try { return JSON.parse(item.valorNovoJson ?? "{}").etapaId === origemFinanceiro.id; } catch { return false; }
});
if (eventosConclusao.length !== 1) throw new Error("Evento único de conclusão do card testado não identificado");
const ativadaEm = new Date(eventosConclusao[0].ocorridoEm.getTime() - 1);
const posteriores = await db.bpmEventoDominio.findMany({ where: { pipelineId: financeiro.id, tipo: "CARD_MOVIDO", ocorridoEm: { gte: ativadaEm } },
  select: { cardId: true, valorNovoJson: true } });
const conclusoesPosteriores = posteriores.filter((item) => {
  try { return JSON.parse(item.valorNovoJson ?? "{}").etapaId === origemFinanceiro.id; } catch { return false; }
});
if (conclusoesPosteriores.length !== 1 || conclusoesPosteriores[0].cardId !== cardConcluidoId) {
  throw new Error("Existem outros eventos de conclusão no período de reprocessamento; revisar individualmente");
}

const plano = { mode: "PLAN", comercial: { pipelineId: comercial.id, automacaoId: comercialAutomacao.id,
  versaoAtual: 2, removerDestinoRadarInativo: radarAntigo?.id }, financeiro: { pipelineId: financeiro.id, etapaFinalId: origemFinanceiro.id,
  novaChave, destinoPipelineId: operacional.id, destinoEtapaId: entradaOperacional.id, responsavelId: 1,
  catchUpCardId: cardConcluidoId, catchUpEventoId: eventosConclusao[0].id, ativadaEm: ativadaEm.toISOString() },
  configVersions: { comercial: comercial.configVersion, financeiro: financeiro.configVersion } };
if (!args.has("--apply")) { console.log(JSON.stringify(plano, null, 2)); await db.$disconnect(); process.exit(0); }

if (process.env.BPM_HANDOFF_APROVADO !== "SIM_PUBLICAR_HANDOFF") throw new Error("Autorização específica ausente");
const manifestPath = args.get("--backup-manifest");
if (!manifestPath?.startsWith("database-backups/pre-change/")) throw new Error("Manifesto pre-change obrigatório");
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
if (manifest.reason !== "financeiro-final-operacional-handoff-checkpoint" || manifest.integrityCheck !== "ok"
  || manifest.foreignKeyViolations !== 0 || manifest.restoreTest !== "cópia local aberta e checada"
  || !Number.isFinite(Date.parse(manifest.generatedAt)) || Date.now() - Date.parse(manifest.generatedAt) > 48 * 60 * 60 * 1000) {
  throw new Error("Backup dedicado inválido ou vencido");
}
const backup = await readFile(manifest.backupPath);
if (backup.length !== manifest.sizeBytes || createHash("sha256").update(backup).digest("hex") !== manifest.sha256) {
  throw new Error("Backup dedicado não confere com o manifesto");
}
const snapshotPath = resolve(`database-backups/pre-change/bpm-handoff-config-${Date.now()}.json`);
await writeFile(snapshotPath, JSON.stringify({ plano, comercialAutomacao, financeiroAutomacao }, null, 2), { flag: "wx", mode: 0o600 });

const agora = new Date();
await db.bpmAutomacao.update({ where: { id: comercialAutomacao.id }, data: { nome: "Fechamento comercial — criar Financeiro" } });
await db.bpmAutomacaoVersao.update({ where: { id: comercialAutomacao.versoes[0].id }, data: { status: "ARQUIVADA", arquivadaEm: agora } });
await db.bpmAutomacaoVersao.create({ data: { automacaoId: comercialAutomacao.id, versao: 3, status: "ATIVA",
  gatilhoTipo: "ENTRAR_COLUNA", gatilhoConfigJson: comercialAutomacao.versoes[0].gatilhoConfigJson,
  condicaoJson: comercialAutomacao.versoes[0].condicaoJson, grafoJson: JSON.stringify(grafoComercialNovo),
  timezone: comercialAutomacao.versoes[0].timezone, criadoPorId: 1, ativadaEm: agora } });
const automacao = await db.bpmAutomacao.create({ data: { pipelineId: financeiro.id, etapaId: origemFinanceiro.id,
  chave: novaChave, nome: "Contrato concluído — iniciar Operacional", gatilhoTipo: "ENTRAR_COLUNA",
  acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE", parametrosJson: "{}", ativa: false, criadoPorId: 1 } });
await db.bpmAutomacaoVersao.create({ data: { automacaoId: automacao.id, versao: 1, status: "ATIVA",
  gatilhoTipo: "ENTRAR_COLUNA", gatilhoConfigJson: JSON.stringify(gatilhoFinanceiro), condicaoJson: null,
  grafoJson: JSON.stringify(grafoFinanceiro), timezone: "America/Sao_Paulo", criadoPorId: 1, ativadaEm } });
await db.bpmAutomacao.update({ where: { id: automacao.id }, data: { ativa: true } });
await db.bpmPipeline.update({ where: { id: comercial.id }, data: { configVersion: { increment: 1 } } });
await db.bpmPipeline.update({ where: { id: financeiro.id }, data: { configVersion: { increment: 1 } } });
console.log(JSON.stringify({ mode: "APPLIED", automacaoId: automacao.id, snapshotPath, catchUpCardId: cardConcluidoId }));
await db.$disconnect();
