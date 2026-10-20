/** Configuração aditiva e versionada; nenhuma chamada altera dados sem aprovação e backup. */
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isAdminRole } from "@/lib/roles";
import type { Client, InValue, Transaction } from "@libsql/client";
import { verificarBackupTurso } from "../../../scripts/lib/verificar-backup-turso.mjs";

export const ALVO_CONTRATACAO = {
  pipelineId: "cmuih48la000009gmzw3wwuzf", etapaId: "draft-stage-22afe145-6639-4299-bf9a-68343ce622f9",
  formularioId: "cmullknfk0000dpih2g6n19p9", secaoId: "cmulqa40c002ymaih7agakscg",
  fechadoId: "draft-stage-2484d2bc-34dd-49b6-baf8-e53d58f07a83",
  campos: [
    { id: "cmulgji5o000t9cihst0e4tuc", chave: "alpha.radar.viabilidade.valor_acordado", tipo: "moeda" },
    { id: "cmulgji99000u9cihr9mcumnr", chave: "alpha.radar.viabilidade.forma_pagamento", tipo: "selecao" },
  ],
} as const;
const CONFIG_TABLES = ["BpmPipeline", "BpmEtapa", "BpmCampo", "BpmCampoOpcao", "BpmCampoMapeamento", "BpmCampoEtapaConfig", "BpmCampoObrigatorioEtapa", "BpmCampoOcultoEtapa", "BpmEtapaFormulario", "BpmFormularioSecao", "BpmFormularioComponente"] as const;
const PROTECTED_TABLES = ["BpmCard", "BpmCardCampoValor", "BpmCampoValorGlobal", "BpmCardHistorico"] as const;
const OPERATION = "CONTRATACAO_EM_TRATATIVA_20261016";
type Row = Record<string, unknown>;
type Config = Record<string, Row[]>;
type Executor = Pick<Transaction, "execute" | "batch">;
export interface PlanoContratacao {
  operation: typeof OPERATION; databaseHash: string; schemaHash: string; tableCount: number;
  before: Config; pipelineVersion: number; formVersion: number; changes: ReturnType<typeof intendedChanges>; fingerprint: string;
}
export interface ReciboContratacao {
  plan: PlanoContratacao; afterHash: string; protectedHash: string; auditId: string;
  configIds: string[]; componentIds: string[];
}
export interface AutorizacaoContratacao {
  fingerprint: string; approval: string; adminId: number; backup: string; manifest: string;
}
export const hashContratacao = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const fail = (message: string): never => { throw new Error(message); };
const rows = async (db: Executor, sql: string, args: InValue[] = []): Promise<Row[]> =>
  (await db.execute({ sql, args })).rows.map((row) => Object.fromEntries(Object.entries(row)));
const find = (config: Config, table: string, id: string) => config[table].find((row) => row.id === id) ?? fail(`Identidade ausente: ${table}.`);
const readConfig = async (db: Executor): Promise<Config> => {
  const results = await db.batch(CONFIG_TABLES.map((table) => `SELECT * FROM "${table}" ORDER BY id`));
  return Object.fromEntries(CONFIG_TABLES.map((table, index) => [table, results[index].rows.map((row) => Object.fromEntries(Object.entries(row)))]));
};
const schema = async (db: Executor) => {
  const definition = await rows(db, "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY type,name");
  return { hash: hashContratacao(definition), tables: definition.filter((row) => row.type === "table").length };
};
const protectedHash = async (db: Executor) => {
  const queries = PROTECTED_TABLES.map((table) => table === "BpmCard"
    ? { sql: 'SELECT * FROM BpmCard WHERE pipelineId=? ORDER BY id', args: [ALVO_CONTRATACAO.pipelineId] }
    : table === "BpmCampoValorGlobal"
      ? { sql: 'SELECT * FROM BpmCampoValorGlobal WHERE campoId IN (?,?) ORDER BY id', args: ALVO_CONTRATACAO.campos.map((field) => field.id) }
      : { sql: `SELECT v.* FROM "${table}" v JOIN BpmCard c ON c.id=v.cardId WHERE c.pipelineId=? ORDER BY v.id`, args: [ALVO_CONTRATACAO.pipelineId] });
  const result = await db.batch(queries);
  return hashContratacao(Object.fromEntries(PROTECTED_TABLES.map((table, index) => {
    const records = result[index].rows.map((row) => Object.fromEntries(Object.entries(row)));
    return [table, { count: records.length, hash: hashContratacao(records) }];
  })));
};
function intendedChanges() {
  return {
    stageConfigs: ALVO_CONTRATACAO.campos.map((field, index) => ({ campoId: field.id, etapaId: ALVO_CONTRATACAO.etapaId, visivel: 1, editavel: 1, somenteLeitura: 0, obrigatorio: 0, obrigatorioEntrada: 0, obrigatorioSaida: 0, ordem: 116 + index, grupo: "Dados para o Financeiro" })),
    components: ALVO_CONTRATACAO.campos.map((field, index) => ({ secaoId: ALVO_CONTRATACAO.secaoId, chave: `origem:${field.chave}`, tipo: "CAMPO", campoId: field.id, ordem: 16 + index, configJson: index === 0 ? JSON.stringify({ label: "Valor acordado no contrato (final após desconto)" }) : null })),
    pipeline: { id: ALVO_CONTRATACAO.pipelineId, from: 31, to: 32 }, form: { id: ALVO_CONTRATACAO.formularioId, from: 2, to: 3 },
    audit: { inserts: 1, action: OPERATION },
    protectedScope: { cardsAndHistoryPipeline: ALVO_CONTRATACAO.pipelineId, globalFields: ALVO_CONTRATACAO.campos.map((field) => field.id) },
  };
}
const receiptSummary = ({ plan, ...details }: ReciboContratacao) => ({ ...details, planFingerprint: plan.fingerprint, fields: ALVO_CONTRATACAO.campos.map((field) => field.id), configOrders: [116, 117], componentOrders: [16, 17] });
const ids = (fingerprint: string, kind: string) => ALVO_CONTRATACAO.campos.map((_, index) => `crm-tratativa-${fingerprint.slice(0, 20)}-${kind}-${index}`);

function validateBefore(config: Config) {
  const a = ALVO_CONTRATACAO;
  const pipeline = find(config, "BpmPipeline", a.pipelineId);
  const stage = find(config, "BpmEtapa", a.etapaId);
  const form = find(config, "BpmEtapaFormulario", a.formularioId);
  const section = find(config, "BpmFormularioSecao", a.secaoId);
  if (pipeline.nome !== "Revisão de Radar" || !pipeline.ativo || pipeline.configVersion !== 31
    || stage.pipelineId !== a.pipelineId || stage.nome !== "Em tratativa" || !stage.ativo
    || form.etapaId !== a.etapaId || form.versao !== 2 || !form.ativo
    || section.formularioId !== a.formularioId || section.chave !== "dados_financeiro"
    || section.titulo !== "Dados para o Financeiro") fail("Alvo ou versões divergem do plano 31/2; revisar antes de aplicar.");
  const components = config.BpmFormularioComponente.filter((row) => row.secaoId === a.secaoId).sort((x, y) => Number(x.ordem) - Number(y.ordem));
  if (components.length !== 16 || components.some((row, index) => row.ordem !== index)) fail("Composição existente mudou; esperado 0–15.");
  const configs = config.BpmCampoEtapaConfig.filter((row) => row.etapaId === a.etapaId);
  if (configs.length !== 16 || configs.map((row) => Number(row.ordem)).sort((x, y) => x - y).some((order, index) => order !== 100 + index)) fail("Ordem das configurações mudou; esperado 100–115.");
  for (const field of a.campos) {
    const actual = find(config, "BpmCampo", field.id);
    if (actual.chave !== field.chave || actual.tipo !== field.tipo || !actual.ativo || actual.pipelineId !== a.pipelineId || actual.escopo !== "CARD") fail("Campo existente divergiu.");
    if (configs.some((row) => row.campoId === field.id) || config.BpmFormularioComponente.some((row) => row.campoId === field.id && config.BpmFormularioSecao.some((section) => section.id === row.secaoId && section.formularioId === a.formularioId))) fail("Configuração parcial ou existente: não sobrescrever.");
    const required = config.BpmCampoEtapaConfig.find((row) => row.campoId === field.id && row.etapaId === a.fechadoId);
    if (!required?.visivel || !required.editavel || !required.obrigatorioEntrada) fail("Obrigatoriedade publicada de Fechado divergiu.");
  }
  if (!config.BpmCampoOpcao.some((row) => row.campoId === a.campos[1].id && row.ativo)) fail("Forma de pagamento sem opções ativas.");
}

export async function prepararContratacao(client: Client, databaseUrl: string): Promise<PlanoContratacao> {
  const tx = await client.transaction("read");
  try {
    const before = await readConfig(tx);
    validateBefore(before);
    const structural = await schema(tx);
    const base: Omit<PlanoContratacao, "fingerprint"> = { operation: OPERATION, databaseHash: hashContratacao(databaseUrl), schemaHash: structural.hash, tableCount: structural.tables, before, pipelineVersion: 31, formVersion: 2, changes: intendedChanges() };
    await tx.commit();
    return { ...base, fingerprint: hashContratacao(base) };
  } finally { tx.close(); }
}

function validatePlan(plan: PlanoContratacao, url: string) {
  const { fingerprint, ...base } = plan;
  if (hashContratacao(plan.changes) !== hashContratacao(intendedChanges()) || plan.operation !== OPERATION || hashContratacao(base) !== fingerprint || hashContratacao(url) !== plan.databaseHash) fail("Fingerprint ou identidade do banco inválidos.");
  validateBefore(plan.before);
}

export async function validarBackupContratacao(plan: PlanoContratacao, backupPath: string, manifestPath: string, now = Date.now()) {
  const backup = await realpath(backupPath);
  if (!backup.split(path.sep).includes("database-backups") || !backup.includes(`${path.sep}database-backups${path.sep}pre-change${path.sep}`)) fail("Backup deve estar em database-backups/pre-change/.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const generatedAt = Date.parse(manifest.generatedAt);
  if (!Number.isFinite(generatedAt) || generatedAt > now || now - generatedAt > 48 * 3600_000
    || manifest.databaseHash !== plan.databaseHash || manifest.tables !== plan.tableCount || manifest.totalRows < 1) fail("Backup vencido, incompleto ou de outro banco.");
  const result = await verificarBackupTurso(backup, manifestPath);
  if (!result.verified || result.tables !== plan.tableCount) fail("Backup não foi restaurado e verificado integralmente.");
  return result;
}

async function authorize(plan: PlanoContratacao, url: string, auth: AutorizacaoContratacao, mode: "APLICAR" | "REVERTER") {
  validatePlan(plan, url);
  if (!Number.isSafeInteger(auth.adminId) || auth.adminId <= 0 || auth.fingerprint !== plan.fingerprint
    || auth.approval !== `${mode}_${OPERATION}:${plan.fingerprint}`) fail("Confirmação específica do fingerprint e auditor são obrigatórios.");
  await validarBackupContratacao(plan, auth.backup, auth.manifest);
}
async function validateAuditor(tx: Transaction, id: number) {
  const user = (await rows(tx, 'SELECT id,role,status FROM usuarios WHERE id=?', [id]))[0];
  if (!user || user.status !== "ATIVO" || !isAdminRole(String(user.role))) fail("Auditor administrativo ativo obrigatório.");
}
async function assertState(tx: Transaction, plan: PlanoContratacao, expectedHash: string) {
  if (hashContratacao(await readConfig(tx)) !== expectedHash || (await schema(tx)).hash !== plan.schemaHash) fail("Drift de configuração/estrutura: operação cancelada.");
}
async function incrementVersions(tx: Transaction, pipelineVersion: number, formVersion: number, now: string) {
  const a = ALVO_CONTRATACAO;
  if ((await tx.execute({ sql: 'UPDATE BpmPipeline SET configVersion=configVersion+1,updatedAt=? WHERE id=? AND configVersion=?', args: [now, a.pipelineId, pipelineVersion] })).rowsAffected !== 1
    || (await tx.execute({ sql: 'UPDATE BpmEtapaFormulario SET versao=versao+1,updatedAt=? WHERE id=? AND versao=?', args: [now, a.formularioId, formVersion] })).rowsAffected !== 1) fail("Conflito CAS nas versões.");
}
async function audit(tx: Transaction, plan: PlanoContratacao, auth: AutorizacaoContratacao, id: string, action: string, value: unknown) {
  await tx.execute({ sql: 'INSERT INTO BpmPipelineConfigAuditoria(id,pipelineId,adminId,campoAlterado,valorAnteriorJson,valorNovoJson,createdAt) VALUES(?,?,?,?,?,?,?)', args: [id, ALVO_CONTRATACAO.pipelineId, auth.adminId, action, JSON.stringify({ fingerprint: plan.fingerprint, pipelineVersion: plan.pipelineVersion, formVersion: plan.formVersion }), JSON.stringify(value), new Date().toISOString()] });
}
function assertOnlyIntendedChanges(plan: PlanoContratacao, after: Config, configIds: string[], componentIds: string[]) {
  for (const [index, field] of ALVO_CONTRATACAO.campos.entries()) {
    const config = find(after, "BpmCampoEtapaConfig", configIds[index]);
    const component = find(after, "BpmFormularioComponente", componentIds[index]);
    if (config.campoId !== field.id || config.etapaId !== ALVO_CONTRATACAO.etapaId || config.ordem !== 116 + index
      || config.visivel !== 1 || config.editavel !== 1 || config.somenteLeitura !== 0 || config.obrigatorio !== 0
      || config.obrigatorioEntrada !== 0 || config.obrigatorioSaida !== 0 || config.grupo !== "Dados para o Financeiro"
      || component.campoId !== field.id || component.secaoId !== ALVO_CONTRATACAO.secaoId || component.tipo !== "CAMPO"
      || component.ordem !== 16 + index || component.chave !== `origem:${field.chave}`) fail("Inserções não correspondem ao plano opcional e compartilhado.");
  }
  const normalized: Config = structuredClone(after);
  normalized.BpmCampoEtapaConfig = normalized.BpmCampoEtapaConfig.filter((row) => !configIds.includes(String(row.id)));
  normalized.BpmFormularioComponente = normalized.BpmFormularioComponente.filter((row) => !componentIds.includes(String(row.id)));
  for (const [table, id, version] of [["BpmPipeline", ALVO_CONTRATACAO.pipelineId, "configVersion"], ["BpmEtapaFormulario", ALVO_CONTRATACAO.formularioId, "versao"]]) {
    const actual = find(normalized, table, id);
    const original = find(plan.before, table, id);
    if (actual[version] !== Number(original[version]) + 1) fail("Versão pós-aplicação inválida.");
    actual[version] = original[version]; actual.updatedAt = original.updatedAt;
  }
  if (hashContratacao(normalized) !== hashContratacao(plan.before)) fail("Alteração fora do plano: transação cancelada.");
}

export async function aplicarContratacao(client: Client, url: string, plan: PlanoContratacao, auth: AutorizacaoContratacao): Promise<ReciboContratacao> {
  await authorize(plan, url, auth, "APLICAR");
  const tx = await client.transaction("write");
  try {
    await validateAuditor(tx, auth.adminId);
    const auditId = `crm-tratativa-${plan.fingerprint.slice(0, 20)}-aplicacao`;
    const prior = (await rows(tx, 'SELECT valorNovoJson FROM BpmPipelineConfigAuditoria WHERE id=?', [auditId]))[0];
    if (prior) {
      const stored: ReturnType<typeof receiptSummary> = JSON.parse(String(prior.valorNovoJson));
      const receipt: ReciboContratacao = { ...stored, plan };
      if (stored.planFingerprint !== plan.fingerprint || (await rows(tx, 'SELECT id FROM BpmPipelineConfigAuditoria WHERE id=?', [`${auditId}-reversao`])).length) fail("Recibo já revertido ou divergente.");
      await assertState(tx, plan, receipt.afterHash);
      await tx.commit();
      return { plan, afterHash: receipt.afterHash, protectedHash: receipt.protectedHash, auditId: receipt.auditId, configIds: receipt.configIds, componentIds: receipt.componentIds };
    }
    await assertState(tx, plan, hashContratacao(plan.before));
    const preserved = await protectedHash(tx);
    const now = new Date().toISOString();
    await incrementVersions(tx, plan.pipelineVersion, plan.formVersion, now);
    const configIds = ids(plan.fingerprint, "config"), componentIds = ids(plan.fingerprint, "componente");
    for (const [index, field] of ALVO_CONTRATACAO.campos.entries()) {
      await tx.execute({ sql: 'INSERT INTO BpmCampoEtapaConfig(id,campoId,etapaId,visivel,editavel,somenteLeitura,obrigatorio,obrigatorioEntrada,obrigatorioSaida,ordem,grupo,createdAt,updatedAt) VALUES(?,?,?,1,1,0,0,0,0,?,?,?,?)', args: [configIds[index], field.id, ALVO_CONTRATACAO.etapaId, 116 + index, "Dados para o Financeiro", now, now] });
      const label = index === 0 ? JSON.stringify({ label: "Valor acordado no contrato (final após desconto)" }) : null;
      await tx.execute({ sql: 'INSERT INTO BpmFormularioComponente(id,secaoId,chave,tipo,campoId,ordem,configJson,createdAt,updatedAt) VALUES(?,?,?,\'CAMPO\',?,?,?,?,?)', args: [componentIds[index], ALVO_CONTRATACAO.secaoId, `origem:${field.chave}`, field.id, 16 + index, label, now, now] });
    }
    const after = await readConfig(tx);
    assertOnlyIntendedChanges(plan, after, configIds, componentIds);
    if (await protectedHash(tx) !== preserved) fail("Cards/valores/histórico alterados; cancelado.");
    const receipt: ReciboContratacao = { plan, afterHash: hashContratacao(after), protectedHash: preserved, auditId, configIds, componentIds };
    await audit(tx, plan, auth, auditId, OPERATION, receiptSummary(receipt));
    await tx.commit();
    return receipt;
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}

export async function verificarContratacao(client: Client, url: string, receipt: ReciboContratacao) {
  validatePlan(receipt.plan, url);
  const tx = await client.transaction("read");
  try {
    await assertState(tx, receipt.plan, receipt.afterHash);
    const audit = (await rows(tx, 'SELECT valorNovoJson FROM BpmPipelineConfigAuditoria WHERE id=?', [receipt.auditId]))[0];
    if (!audit || hashContratacao(JSON.parse(String(audit.valorNovoJson))) !== hashContratacao(receiptSummary(receipt))) fail("Auditoria/recibo não conferem.");
    assertOnlyIntendedChanges(receipt.plan, await readConfig(tx), receipt.configIds, receipt.componentIds);
    await tx.commit();
    return { verified: true, pipelineVersion: receipt.plan.pipelineVersion + 1, formVersion: receipt.plan.formVersion + 1 };
  } finally { tx.close(); }
}

export async function reverterContratacao(client: Client, url: string, receipt: ReciboContratacao, auth: AutorizacaoContratacao) {
  await authorize(receipt.plan, url, auth, "REVERTER");
  const tx = await client.transaction("write");
  try {
    await validateAuditor(tx, auth.adminId);
    await assertState(tx, receipt.plan, receipt.afterHash);
    const auditRow = (await rows(tx, 'SELECT valorNovoJson FROM BpmPipelineConfigAuditoria WHERE id=?', [receipt.auditId]))[0];
    if (!auditRow || hashContratacao(JSON.parse(String(auditRow.valorNovoJson))) !== hashContratacao(receiptSummary(receipt))) fail("Recibo não confere com auditoria.");
    if (await protectedHash(tx) !== receipt.protectedHash) fail("Cards/valores mudaram após aplicação; rollback automático bloqueado.");
    const now = new Date().toISOString();
    await incrementVersions(tx, receipt.plan.pipelineVersion + 1, receipt.plan.formVersion + 1, now);
    for (const [table, identifiers] of [["BpmCampoEtapaConfig", receipt.configIds], ["BpmFormularioComponente", receipt.componentIds]] as const) {
      for (const id of identifiers) if ((await tx.execute({ sql: `DELETE FROM "${table}" WHERE id=?`, args: [id] })).rowsAffected !== 1) fail("Registro criado ausente; cancelado.");
    }
    const after = await readConfig(tx);
    // Reversão avança versões para invalidar caches, preservando todos os dados anteriores.
    const expected = structuredClone(receipt.plan.before);
    for (const [table, id, version] of [["BpmPipeline", ALVO_CONTRATACAO.pipelineId, "configVersion"], ["BpmEtapaFormulario", ALVO_CONTRATACAO.formularioId, "versao"]]) {
      const row = find(expected, table, id); row[version] = Number(row[version]) + 2; row.updatedAt = now;
    }
    if (hashContratacao(after) !== hashContratacao(expected) || await protectedHash(tx) !== receipt.protectedHash) fail("Reversão excedeu o plano; cancelado.");
    await audit(tx, receipt.plan, auth, `${receipt.auditId}-reversao`, `${OPERATION}_REVERTIDO`, { revertedAuditId: receipt.auditId, pipelineVersion: receipt.plan.pipelineVersion + 2, formVersion: receipt.plan.formVersion + 2 });
    await tx.commit();
    return { reverted: true, pipelineVersion: receipt.plan.pipelineVersion + 2, formVersion: receipt.plan.formVersion + 2 };
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
