import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { verificarBackupTurso } from "../lib/verificar-backup-turso.mjs";

export const MIGRATION_PATH = fileURLToPath(new URL("../../prisma/migrations/20261022143000_checklist_analistas_crm/migration.sql", import.meta.url));
export const SCHEMA_PATH = fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url));
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
export const normalizeCode = (value) => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
export const TYPES = ["RECEITA_BRUTA_DAS", "RECEITA_BRUTA_CPRB", "INICIO_RETOMADA", "DISPONIBILIDADE_FINANCEIRA"];
export const STATUSES = ["PENDENTE", "OK", "IRREGULAR", "PARCIALMENTE_IRREGULAR", "REVISAR", "DESNECESSARIO", "EM_ANALISE", "AGUARDANDO_DOCUMENTOS", "PRIORIDADE", "FALAR_DR_EDVAN", "FALAR_ANDREW"];
export const NEW_TABLES = ["ModeloChecklistIdentidade", "ChecklistCrmVinculo", "ChecklistEvento", "ChecklistEventoLeitura", "ChecklistUploadRecibo"];

export async function artifacts() {
  const migration = await readFile(MIGRATION_PATH, "utf8");
  return { migration, schemaSha256: hash(await readFile(SCHEMA_PATH)), migrationSha256: hash(migration) };
}

export function splitSql(sql) {
  // This migration deliberately has no SQL triggers, procedural blocks or string semicolons.
  return sql.replace(/^--.*$/gm, "").split(";").map((statement) => statement.trim()).filter(Boolean);
}

export function migrationShape(sql) {
  const addedColumns = [...sql.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/g)].map((m) => ({ table: m[1], column: m[2] }));
  const indexes = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].map((m) => m[1]);
  return { addedColumns, indexes, newTables: NEW_TABLES };
}

export async function schemaMetadata(db) {
  const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map((row) => String(row.name));
  const columns = {};
  for (const table of ["operacional_clientes", "Cliente", "ClienteOperacional", "ModeloItemChecklist", "Checklist", "ItemChecklist", "DocumentoChecklist", "NotificacaoCliente", "Auditoria", ...NEW_TABLES]) {
    columns[table] = tables.includes(table) ? (await db.execute(`PRAGMA table_info(${quote(table)})`)).rows.map((row) => ({ name: String(row.name), type: String(row.type).toUpperCase() })) : [];
  }
  const indexes = (await db.execute("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")).rows.map((row) => String(row.name));
  const schemaRows = (await db.execute("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name")).rows;
  return { tables, columns, indexes, schemaFingerprint: hash(JSON.stringify(schemaRows.map((row) => [row.type, row.name, row.tbl_name, row.sql]))) };
}

export function canonicalLayout(metadata) {
  const op = metadata.columns.operacional_clientes ?? [];
  return op.some((field) => field.name === "clienteId" && field.type === "INTEGER") && op.some((field) => field.name === "clienteOperacionalId" && field.type === "TEXT") && metadata.columns.Cliente.some((field) => field.name === "id" && field.type === "INTEGER");
}

export function phaseState(metadata, shape) {
  const flags = [...shape.newTables.map((table) => metadata.tables.includes(table)), ...shape.addedColumns.map(({ table, column }) => metadata.columns[table]?.some((field) => field.name === column)), ...shape.indexes.map((index) => metadata.indexes.includes(index))];
  return flags.every(Boolean) ? "APPLIED" : flags.some(Boolean) ? "PARTIAL" : "NOT_APPLIED";
}

async function count(db, sql, args = []) {
  return Number((await db.execute({ sql, args })).rows[0].n);
}

/** Never returns names, account e-mails, document URLs or raw model codes. */
export async function diagnose(db) {
  const { migration } = await artifacts();
  const metadata = await schemaMetadata(db);
  const canonical = canonicalLayout(metadata);
  const state = phaseState(metadata, migrationShape(migration));
  if (!canonical) return { canonical: false, state, schemaFingerprint: metadata.schemaFingerprint, blockers: ["LAYOUT_MASTER_INCOMPATIVEL"], mutationCount: 0 };
  const blockers = [];
  const required = ["usuarios", "BpmCard", "ModeloItemChecklist", "Checklist", "ItemChecklist", "DocumentoChecklist", "PastaChecklist", "NotificacaoCliente", "Auditoria"];
  if (required.some((table) => !metadata.tables.includes(table))) {
    return { canonical, state, schemaFingerprint: metadata.schemaFingerprint, blockers: ["TABELAS_CANONICAS_AUSENTES"], mutationCount: 0 };
  }
  const checks = {
    masterOrphans: 'SELECT count(*) n FROM operacional_clientes o LEFT JOIN Cliente c ON c.id=o.clienteId WHERE c.id IS NULL',
    accountOrphans: 'SELECT count(*) n FROM operacional_clientes o LEFT JOIN ClienteOperacional c ON c.id=o.clienteOperacionalId WHERE c.id IS NULL',
    checklistOrphans: 'SELECT count(*) n FROM Checklist c LEFT JOIN operacional_clientes o ON o.id=c.empresaId WHERE o.id IS NULL',
    itemOrphans: 'SELECT count(*) n FROM ItemChecklist i LEFT JOIN Checklist c ON c.id=i.checklistId WHERE c.id IS NULL',
    documentOrphans: 'SELECT count(*) n FROM DocumentoChecklist d LEFT JOIN ItemChecklist i ON i.id=d.itemId WHERE i.id IS NULL',
    legacyModelReferences: 'SELECT count(*) n FROM ItemChecklist i LEFT JOIN ModeloItemChecklist m ON m.id=i.modeloItemId WHERE i.modeloItemId IS NOT NULL AND m.id IS NULL',
  };
  const counts = {};
  for (const [key, sql] of Object.entries(checks)) counts[key] = await count(db, sql);
  if (Object.values(counts).some((value) => value > 0)) blockers.push("ORFAOS_LEGADOS");
  counts.accountsPlaintext = await count(db, "SELECT count(*) n FROM ClienteOperacional WHERE senha <> ''");
  counts.operationalRecords = await count(db, "SELECT count(*) n FROM operacional_clientes");
  counts.documents = await count(db, "SELECT count(*) n FROM DocumentoChecklist");
  counts.unassignedOwners = state === "APPLIED" ? await count(db, "SELECT count(*) n FROM operacional_clientes WHERE analistaId IS NULL") : counts.operationalRecords;
  const invalidStatuses = await db.execute({ sql: `SELECT status,count(*) n FROM ItemChecklist WHERE status NOT IN (${STATUSES.map(() => "?").join(",")}) GROUP BY status`, args: STATUSES });
  // Unknown statuses may contain user-entered values: counts only, never echo text.
  counts.invalidStatusValues = invalidStatuses.rows.reduce((total, row) => total + Number(row.n), 0);
  if (counts.invalidStatusValues) blockers.push("STATUS_DESCONHECIDO");
  const modelPlan = await planModelBootstrap(db, state);
  if (modelPlan.collisions.length || modelPlan.invalidIds.length) blockers.push("MODELOS_EXIGEM_RESOLUCAO_EXPLICITA");
  if (state === "PARTIAL") blockers.push("FASE_ADITIVA_PARCIAL");
  return { canonical, state, schemaFingerprint: metadata.schemaFingerprint, counts, modelPlan, blockers, mutationCount: 0 };
}

export async function planModelBootstrap(db, state = "APPLIED") {
  // Cursor pagination: no silent take500 truncation and bounded memory per request.
  let after = "";
  const groups = new Map();
  const invalidIds = [];
  const candidates = [];
  for (;;) {
    const result = await db.execute({ sql: `SELECT id,tipo,codigo${state === "APPLIED" ? ",identidadeId" : ""} FROM ModeloItemChecklist WHERE id > ? ORDER BY id LIMIT 250`, args: [after] });
    if (!result.rows.length) break;
    for (const row of result.rows) {
      after = String(row.id);
      const normalized = normalizeCode(row.codigo);
      const scope = row.tipo === null ? "GLOBAL" : String(row.tipo);
      if (!normalized || normalized.length > 80 || (scope !== "GLOBAL" && !TYPES.includes(scope))) { invalidIds.push(after); continue; }
      const key = `${scope}:${normalized}`;
      const entry = { id: after, scope, codeHash: hash(normalized), identidadeId: row.identidadeId ?? null };
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
      if (!row.identidadeId) candidates.push({ ...entry, normalized });
    }
  }
  const collisions = [...groups.values()].filter((group) => group.length > 1 && (!group[0].identidadeId || group.some((entry) => entry.identidadeId !== group[0].identidadeId)));
  // Do not emit raw model codes in diagnostics; internal normalized is used only in apply.
  return { candidates: candidates.map((entry) => ({ id: entry.id, scope: entry.scope, codeHash: entry.codeHash, identidadeId: entry.identidadeId })), collisions, invalidIds, totalModels: [...groups.values()].reduce((sum, group) => sum + group.length, 0) + invalidIds.length };
}

export async function planTestFolder(db) {
  const folders = (await db.execute({ sql: 'SELECT id FROM PastaChecklist WHERE nome = ? ORDER BY id', args: ["Teste"] })).rows;
  const entries = [];
  for (const folder of folders) {
    const id = String(folder.id);
    const companyIds = [];
    let after = "";
    for (;;) {
      const rows = (await db.execute({ sql: "SELECT id FROM operacional_clientes WHERE pastaChecklistId=? AND id>? ORDER BY id LIMIT 250", args: [id, after] })).rows;
      if (!rows.length) break;
      for (const row of rows) { after = String(row.id); companyIds.push(after); }
    }
    entries.push({ id, companyIds, companies: await count(db, "SELECT count(*) n FROM operacional_clientes WHERE pastaChecklistId=?", [id]), checklists: await count(db, "SELECT count(*) n FROM Checklist c JOIN operacional_clientes o ON o.id=c.empresaId WHERE o.pastaChecklistId=?", [id]), documents: await count(db, "SELECT count(*) n FROM DocumentoChecklist d JOIN ItemChecklist i ON i.id=d.itemId JOIN Checklist c ON c.id=i.checklistId JOIN operacional_clientes o ON o.id=c.empresaId WHERE o.pastaChecklistId=?", [id]) });
  }
  return { folders: entries, virtualSemPasta: "FILTRO_VIRTUAL_NAO_EXCLUIR", mutationCount: 0 };
}

export async function planStorage(db) {
  // Metadata counts only: copying/hashing/removing object payload is intentionally absent.
  const meta = await schemaMetadata(db);
  const hasStorage = meta.columns.DocumentoChecklist.some((field) => field.name === "storageAccess");
  return { documents: await count(db, "SELECT count(*) n FROM DocumentoChecklist"), legacyWithoutPrivateMetadata: await count(db, hasStorage ? "SELECT count(*) n FROM DocumentoChecklist WHERE storageAccess IS NULL OR storageAccess <> 'private'" : "SELECT count(*) n FROM DocumentoChecklist"), requiresSeparateVaultPlan: true, copies: 0, objectReads: 0, deletes: 0 };
}

export async function buildPlan(operation, db = undefined) {
  const art = await artifacts();
  const state = db && operation === "bootstrap-modelos" ? phaseState(await schemaMetadata(db), migrationShape(art.migration)) : "APPLIED";
  const operationPlan = operation === "schema" ? { migrationSha256: art.migrationSha256, schemaSha256: art.schemaSha256, shape: migrationShape(art.migration) } : operation === "bootstrap-modelos" ? await planModelBootstrap(db, state) : operation === "limpar-teste" ? await planTestFolder(db) : operation === "storage-legado" ? await planStorage(db) : null;
  if (!operationPlan) throw new Error("OPERACAO_INVALIDA");
  const plan = { version: 1, operation, operationPlan };
  return { ...plan, planSha256: hash(JSON.stringify(plan)) };
}

/** Verify real evidence, including restoring the full backup to disposable local SQLite. */
export async function assertApplyGates({ environment, panelOrigin, databaseUrl, stagingFingerprint, operation, planSha256, consentPath, vaultPath, backupPath, manifestPath, now = Date.now() }) {
  if (environment !== "staging" || panelOrigin !== "https://staging.alpha-comex.com") throw new Error("AMBIENTE_STAGING_NAO_COMPROVADO");
  const fingerprint = hash(databaseUrl);
  if (stagingFingerprint !== fingerprint) throw new Error("FINGERPRINT_STAGING_DIVERGENTE");
  if (!consentPath || !vaultPath || !backupPath || !manifestPath) throw new Error("EVIDENCIAS_VAULT_BACKUP_CONSENTIMENTO_OBRIGATORIAS");
  const [consent, vault, manifest] = await Promise.all([consentPath, vaultPath, manifestPath].map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  const generated = Date.parse(manifest.generatedAt);
  if (!Number.isFinite(generated) || now - generated > 48 * 3600_000 || generated > now || manifest.databaseHash !== fingerprint || !(manifest.sizeBytes > 0) || !(manifest.tables > 0) || !(manifest.totalRows > 0)) throw new Error("BACKUP_VENCIDO_VAZIO_OU_BANCO_DIVERGENTE");
  const confirmed = Date.parse(consent.confirmedAt);
  if (!Number.isFinite(confirmed) || confirmed > now || now - confirmed > 48 * 3600_000 || consent.confirmed !== true || consent.confirmedBy !== "user") throw new Error("CONSENTIMENTO_ESPECIFICO_AUSENTE");
  if (vault.approved !== true) throw new Error("VAULT_NAO_APROVADO");
  for (const evidence of [consent, vault]) {
    if (evidence.environment !== "staging" || evidence.databaseFingerprint !== fingerprint || evidence.operation !== operation || evidence.planSha256 !== planSha256 || evidence.backupSha256 !== manifest.sha256) throw new Error("EVIDENCIA_NAO_CORRESPONDE_AO_PLANO");
  }
  const restored = await verificarBackupTurso(backupPath, manifestPath);
  return { fingerprint, backupSha256: restored.sha256, verified: true };
}

export async function applyPrepared(db, operation, expectedPlanSha256, gatesVerified) {
  if (gatesVerified?.verified !== true) throw new Error("GATES_OBRIGATORIOS");
  if (!["schema", "bootstrap-modelos", "limpar-teste"].includes(operation)) throw new Error("OPERACAO_SOMENTE_PLANEJAMENTO");
  const tx = await db.transaction("write");
  try {
    const plan = await buildPlan(operation, tx);
    if (plan.planSha256 !== expectedPlanSha256) throw new Error("PLANO_MUDOU_REFAZER_APROVACAO");
    const diagnostic = await diagnose(tx);
    if (diagnostic.blockers.length) throw new Error("PREFLIGHT_BLOQUEADO");
    if (operation === "schema") {
      if (diagnostic.state === "APPLIED") { await tx.commit(); return { applied: false, alreadyApplied: true }; }
      const { migration } = await artifacts();
      for (const sql of splitSql(migration)) await tx.execute(sql);
      const verified = await diagnose(tx);
      if (verified.state !== "APPLIED" || verified.blockers.length) throw new Error("VALIDACAO_POS_MIGRATION_FALHOU");
    } else {
      if (diagnostic.state !== "APPLIED") throw new Error("SCHEMA_NOVO_OBRIGATORIO");
      if (operation === "bootstrap-modelos") await bootstrapModels(tx);
      else {
        for (const folder of plan.operationPlan.folders) {
          await tx.execute({ sql: "UPDATE operacional_clientes SET pastaChecklistId=NULL WHERE pastaChecklistId=?", args: [folder.id] });
          await tx.execute({ sql: "DELETE FROM PastaChecklist WHERE id=? AND nome=?", args: [folder.id, "Teste"] });
        }
      }
    }
    if ((await tx.execute("PRAGMA foreign_key_check")).rows.length) throw new Error("FK_CHECK_FALHOU");
    await tx.commit();
    return { applied: true, operation, planSha256: expectedPlanSha256 };
  } catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

async function bootstrapModels(tx) {
  const plan = await planModelBootstrap(tx);
  if (plan.collisions.length || plan.invalidIds.length) throw new Error("MODELOS_EXIGEM_RESOLUCAO_EXPLICITA");
  for (const candidate of plan.candidates) {
    const row = (await tx.execute({ sql: "SELECT id,tipo,codigo,identidadeId FROM ModeloItemChecklist WHERE id=?", args: [candidate.id] })).rows[0];
    if (!row || row.identidadeId) throw new Error("MODELO_ALTERADO_CONCORRENTEMENTE");
    const scope = row.tipo === null ? "GLOBAL" : String(row.tipo);
    const normalized = normalizeCode(row.codigo);
    const existing = (await tx.execute({ sql: "SELECT id FROM ModeloChecklistIdentidade WHERE escopo=? AND codigoNormalizado=?", args: [scope, normalized] })).rows;
    // Never merge existing identities/revisions implicitly.
    if (existing.length) throw new Error("IDENTIDADE_EXISTENTE_EXIGE_RESOLUCAO");
    const identityId = randomUUID();
    const now = new Date().toISOString();
    await tx.execute({ sql: "INSERT INTO ModeloChecklistIdentidade(id,escopo,codigoNormalizado,revision,createdAt,updatedAt) VALUES(?,?,?,0,?,?)", args: [identityId, scope, normalized, now, now] });
    await tx.execute({ sql: "UPDATE ModeloItemChecklist SET identidadeId=?,versao=1 WHERE id=? AND identidadeId IS NULL", args: [identityId, candidate.id] });
  }
}
