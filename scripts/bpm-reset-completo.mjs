/**
 * Alpha CRM full reset. Preview is read-only; simulation uses a disposable copy
 * of a verified SQLite backup. Live mutation is deliberately gated by an exact
 * inventory fingerprint, verified backup and a specific approval flag.
 *
 * Usage:
 *   node scripts/bpm-reset-completo.mjs --preview
 *   node scripts/bpm-reset-completo.mjs --simulate --backup=<snapshot.sql|.db> --manifest=<snapshot.manifest.json>
 *   node scripts/bpm-reset-completo.mjs --apply --backup=<snapshot.sql|.db> --manifest=<snapshot.manifest.json> \
 *     --expect-fingerprint=<preview fingerprint> --approval=RESET_COMPLETO_ALPHA_CRM
 */
import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';

config({ path: '.env.local', quiet: true });

const modes = ['--preview', '--simulate', '--apply'].filter((flag) => process.argv.includes(flag));
if (modes.length !== 1) throw new Error('Escolha exatamente um modo: --preview, --simulate ou --apply.');
const mode = modes[0].slice(2);
function arg(name) { return process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3); }
function quote(name) { return `"${String(name).replaceAll('"', '""')}"`; }
function count(result) { return Number(result.rows[0]?.n ?? 0); }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
// O fingerprint detecta divergência de IDs de pipelines e contagens, mas não
// mudanças de conteúdo que preservem as contagens. Exige pausa de gravações e
// uma nova prévia/backup imediatamente antes de qualquer execução autorizada.
const fingerprintScope = 'pipeline identity and BPM/external-reference counts; same-count row edits are not detected';
function assert(condition, message) { if (!condition) throw new Error(message); }
function localExecutor(db) {
  return {
    execute: async (input) => {
      const { sql, args = [] } = typeof input === 'string' ? { sql: input } : input;
      const statement = db.prepare(sql);
      if (/^\s*(SELECT|PRAGMA)/i.test(sql)) return { rows: statement.all(...args), rowsAffected: 0 };
      const result = statement.run(...args);
      return { rows: [], rowsAffected: result.changes };
    },
  };
}
async function tablesAndFks(executor) {
  const master = await executor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tables = master.rows.map((row) => String(row.name));
  const fks = new Map();
  for (const table of tables) {
    const result = await executor.execute(`PRAGMA foreign_key_list(${quote(table)})`);
    fks.set(table, result.rows.map((row) => ({ parent: String(row.table), from: String(row.from), onDelete: String(row.on_delete) })));
  }
  return { tables, fks };
}
function deletionOrder(tables, fks) {
  const bpm = tables.filter((table) => table.startsWith('Bpm') && table !== 'BpmPipeline');
  assert(tables.includes('BpmPipeline') && bpm.includes('BpmCard') && bpm.includes('BpmEtapa') && bpm.includes('BpmCampo'), 'Schema BPM incompleto.');
  const remaining = new Set(bpm);
  const edges = new Map(bpm.map((table) => [table, new Set((fks.get(table) ?? [])
    .filter((fk) => remaining.has(fk.parent) && fk.parent !== table && fk.onDelete !== 'SET NULL')
    .map((fk) => fk.parent))]));
  const order = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) => ![...remaining].some((child) => edges.get(child).has(table))).sort();
    assert(ready.length, `Ciclo de FK no BPM: ${[...remaining].join(', ')}`);
    const table = ready[0];
    remaining.delete(table);
    order.push(table);
  }
  return order;
}
async function inventory(executor, schema) {
  const pipelines = (await executor.execute('SELECT id, chave, nome, ativo FROM BpmPipeline ORDER BY chave, id')).rows
    .map((row) => ({ id: String(row.id), chave: row.chave === null ? null : String(row.chave), nome: String(row.nome), ativo: Number(row.ativo) }));
  const order = deletionOrder(schema.tables, schema.fks);
  const counts = {};
  for (const table of [...order, 'BpmPipeline']) counts[table] = count(await executor.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`));
  const externalReferences = [];
  for (const table of schema.tables.filter((item) => !item.startsWith('Bpm'))) {
    for (const fk of schema.fks.get(table) ?? []) {
      if (!fk.parent.startsWith('Bpm')) continue;
      assert(fk.onDelete === 'SET NULL', `Referência externa ${table}.${fk.from} -> ${fk.parent} exige plano próprio (${fk.onDelete}).`);
      const n = count(await executor.execute(`SELECT COUNT(*) AS n FROM ${quote(table)} WHERE ${quote(fk.from)} IS NOT NULL`));
      externalReferences.push({ table, column: fk.from, target: fk.parent, onDelete: fk.onDelete, populated: n });
    }
  }
  const canonical = JSON.stringify({ pipelines, counts, externalReferences });
  return { pipelines, counts, externalReferences, fingerprint: digest(canonical), order };
}
async function verifyBackup(backupArg, manifestArg, requireFresh) {
  assert(backupArg && manifestArg, 'Informe --backup=<snapshot.sql|.db> e --manifest=<snapshot.manifest.json>.');
  const backup = path.resolve(backupArg);
  const manifestPath = path.resolve(manifestArg);
  assert(backup.startsWith(path.resolve('database-backups/pre-change') + path.sep), 'Backup deve estar em database-backups/pre-change/.');
  const extension = path.extname(backup);
  assert(extension === '.db' || extension === '.sql', 'Use backup SQLite completo (.db ou .sql).');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const file = await readFile(backup);
  const info = await stat(backup);
  assert(info.size > 1_000_000 && info.size === manifest.sizeBytes && digest(file) === manifest.sha256, 'Backup vazio, divergente ou sem hash válido.');
  assert((extension === '.sql' || manifest.format === 'sqlite') && manifest.tables > 0 && manifest.totalRows >= 0, 'Manifest não demonstra backup completo SQLite.');
  if (manifest.backupPath) assert(path.resolve(manifest.backupPath) === backup, 'Manifest aponta para outro backup.');
  const age = Date.now() - Date.parse(manifest.generatedAt);
  assert(Number.isFinite(age) && age >= 0 && (!requireFresh || age <= 48 * 60 * 60 * 1000), 'Backup inválido ou com mais de 48 horas.');
  let restoreDirectory;
  let restoredPath = backup;
  if (extension === '.sql') {
    restoreDirectory = await mkdtemp(path.join(os.tmpdir(), 'alpha-crm-reset-restore-'));
    restoredPath = path.join(restoreDirectory, 'restored.db');
    const restore = new DatabaseSync(restoredPath);
    try { restore.exec(file.toString('utf8')); }
    finally { restore.close(); }
  }
  const db = new DatabaseSync(restoredPath, { readOnly: true });
  let backupFingerprint;
  try {
    assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', 'Integrity check do backup falhou.');
    assert(db.prepare('PRAGMA foreign_key_check').all().length === 0, 'FK check do backup falhou.');
    const actualTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    assert(actualTables.length === manifest.tables, 'Quantidade de tabelas do backup diverge do manifest.');
    let rows = 0;
    for (const { name } of actualTables) rows += Number(db.prepare(`SELECT COUNT(*) AS n FROM ${quote(name)}`).get().n);
    assert(rows === manifest.totalRows, 'Quantidade de linhas do backup diverge do manifest.');
    const executor = localExecutor(db);
    backupFingerprint = (await inventory(executor, await tablesAndFks(executor))).fingerprint;
  } catch (error) {
    if (restoreDirectory) await rm(restoreDirectory, { recursive: true, force: true });
    throw error;
  } finally { db.close(); }
  return { backup, restoredPath, sha256: manifest.sha256, generatedAt: manifest.generatedAt, fingerprint: backupFingerprint,
    cleanup: async () => { if (restoreDirectory) await rm(restoreDirectory, { recursive: true, force: true }); } };
}
async function reset(executor, before, schema) {
  for (const table of before.order) await executor.execute(`DELETE FROM ${quote(table)}`);
  await executor.execute('DELETE FROM BpmPipeline');
  const after = await inventory(executor, schema);
  assert(after.pipelines.length === 0, 'Restaram pipelines.');
  for (const [table, n] of Object.entries(after.counts)) {
    assert(n === 0, `Restaram ${n} registros em ${table}.`);
  }
  const fk = await executor.execute('PRAGMA foreign_key_check');
  assert(fk.rows.length === 0, `FK check falhou (${fk.rows.length} violações).`);
  const integrity = await executor.execute('PRAGMA integrity_check');
  assert(integrity.rows.length === 1 && Object.values(integrity.rows[0])[0] === 'ok', 'Integrity check falhou.');
  return after;
}
if (mode === 'simulate') {
  const evidence = await verifyBackup(arg('backup'), arg('manifest'), false);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'alpha-crm-reset-sim-'));
  const copy = path.join(dir, 'simulation.db');
  try {
    await copyFile(evidence.restoredPath, copy);
    const db = new DatabaseSync(copy);
    try {
      db.exec('PRAGMA foreign_keys=ON');
      const executor = localExecutor(db);
      const schema = await tablesAndFks(executor);
      const before = await inventory(executor, schema);
      db.exec('BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON;');
      try {
        const after = await reset(executor, before, schema);
        db.exec('COMMIT');
        console.info(JSON.stringify({ mode, backupSha256: evidence.sha256, fingerprintScope, before: { pipelines: before.pipelines, counts: before.counts, externalReferences: before.externalReferences, fingerprint: before.fingerprint }, after: { pipelines: after.pipelines, counts: after.counts, externalReferences: after.externalReferences }, integrity: 'ok', foreignKeys: 0 }));
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } finally { db.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); await evidence.cleanup(); }
} else {
  const rawUrl = process.env.TURSO_DATABASE_URL ?? '';
  const authToken = process.env.TURSO_AUTH_TOKEN ?? '';
  assert(rawUrl && authToken, 'Turso remoto não configurado em .env.local.');
  let applyEvidence;
  if (mode === 'apply') {
    assert(arg('approval') === 'RESET_COMPLETO_ALPHA_CRM', 'Falta --approval=RESET_COMPLETO_ALPHA_CRM.');
    assert(/^[a-f0-9]{64}$/.test(arg('expect-fingerprint') ?? ''), 'Falta --expect-fingerprint da prévia atual.');
    applyEvidence = await verifyBackup(arg('backup'), arg('manifest'), true);
    if (applyEvidence.fingerprint !== arg('expect-fingerprint')) {
      await applyEvidence.cleanup();
      throw new Error('Backup não corresponde ao inventário da prévia; execução bloqueada.');
    }
  }
  const client = createClient({ url: rawUrl.replace(/^libsql:\/\//, 'https://'), authToken });
  try {
    const tx = await client.transaction(mode === 'apply' ? 'write' : 'read');
    try {
      const schema = await tablesAndFks(tx);
      const before = await inventory(tx, schema);
      if (mode === 'preview') {
        await tx.commit();
        console.info(JSON.stringify({ mode, pipelines: before.pipelines, counts: before.counts, externalReferences: before.externalReferences, fingerprint: before.fingerprint, fingerprintScope, deletionOrder: before.order }));
      } else {
        assert(before.fingerprint === arg('expect-fingerprint'), 'Inventário vivo mudou desde a prévia; execução bloqueada.');
        const foreignKeys = await tx.execute('PRAGMA foreign_keys');
        assert(Number(foreignKeys.rows[0]?.foreign_keys) === 1, 'Foreign keys desativadas na conexão.');
        await tx.execute('PRAGMA defer_foreign_keys=ON');
        const after = await reset(tx, before, schema);
        await tx.commit();
        console.info(JSON.stringify({ mode, beforeFingerprint: before.fingerprint, pipelines: after.pipelines, counts: after.counts, integrity: 'ok', foreignKeys: 0 }));
      }
    } catch (error) { await tx.rollback(); throw error; }
    finally { tx.close(); }
  } finally { await client.close(); await applyEvidence?.cleanup(); }
}
