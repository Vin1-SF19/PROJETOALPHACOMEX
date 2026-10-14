import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { verificarBackupTurso } from './lib/verificar-backup-turso.mjs';
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true });
const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const mode = process.argv[2] ?? 'preview';
if (!['preview', 'apply', 'verify'].includes(mode)) throw new Error('Use preview, apply ou verify.');
const hash = (s) => createHash('sha256').update(s).digest('hex');
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('Banco não configurado.');
const definitions = [
  ['BpmCard_board_empresaId_idx', ['empresaId']], ['BpmCard_board_pipelineId_idx', ['pipelineId']],
  ['BpmCard_board_etapaId_idx', ['etapaId']], ['BpmCard_board_responsavelId_idx', ['responsavelId']],
  ['BpmCard_board_status_idx', ['status']], ['BpmCard_quadro_pagina_idx', ['pipelineId', 'status', 'etapaId', 'createdAt', 'id']],
];
const fingerprint = hash(JSON.stringify(definitions));
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
async function inspect(client) {
  const missing = [];
  const indexes = (await client.execute('PRAGMA index_list("BpmCard")')).rows;
  for (const [name, columns] of definitions) {
    const master = (await client.execute({ sql: 'SELECT tbl_name FROM sqlite_master WHERE type=\'index\' AND name=?', args: [name] })).rows[0];
    if (!master) { missing.push(name); continue; }
    const meta = indexes.find((i) => i.name === name);
    const actual = (await client.execute(`PRAGMA index_info("${name}")`)).rows.map((c) => c.name);
    const extended = (await client.execute(`PRAGMA index_xinfo("${name}")`)).rows.filter((c) => Number(c.key) === 1);
    if (master.tbl_name !== 'BpmCard' || !meta || Number(meta.unique) !== 0 || Number(meta.partial) !== 0 || JSON.stringify(actual) !== JSON.stringify(columns) || extended.some((c) => Number(c.desc) !== 0 || c.coll !== 'BINARY')) throw new Error(`Definição divergente: ${name}. Execução bloqueada.`);
  }
  return missing;
}
try {
  if (mode === 'apply') {
    if (option('confirm') !== fingerprint) throw new Error('Confirmação específica ausente.');
    const backup = option('backup'); if (!backup) throw new Error('Backup obrigatório.');
    const manifestPath = backup.replace(/\.sql$/, '.manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const age = Date.now() - Date.parse(manifest.generatedAt);
    if (manifest.databaseHash !== hash(url) || !Number.isFinite(age) || age < 0 || age > 48 * 3600000) throw new Error('Backup expirado ou de outro banco.');
    await verificarBackupTurso(backup, manifestPath);
    const receiptPath = path.resolve(option('receipt') ?? 'database-backups/pre-change/crm-board-indexes/receipt.json');
    await mkdir(path.dirname(receiptPath), { recursive: true, mode: 0o700 });
    let receipt;
    try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (receipt && (receipt.fingerprint !== fingerprint || receipt.databaseHash !== hash(url))) throw new Error('Recibo pertence a outra operação.');
    const tx = await db.transaction('write');
    try {
      const missing = await inspect(tx);
      const before = Number((await tx.execute('SELECT count(*) n FROM BpmCard')).rows[0].n);
      receipt = { ...receipt, fingerprint, databaseHash: hash(url), backup, created: [...new Set([...(receipt?.created ?? []), ...missing])], before, startedAt: receipt?.startedAt ?? new Date().toISOString(), status: 'prepared' };
      await writeFile(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600 });
      for (const [name, columns] of definitions) if (missing.includes(name)) await tx.execute(`CREATE INDEX "${name}" ON "BpmCard"(${columns.map((c) => `"${c}"`).join(',')})`);
      if ((await inspect(tx)).length) throw new Error('Índices ausentes após criação.');
      const after = Number((await tx.execute('SELECT count(*) n FROM BpmCard')).rows[0].n);
      if (after !== before) throw new Error('Contagem de cards divergente.');
      await tx.commit();
      receipt.status = 'applied'; receipt.after = after; receipt.finishedAt = new Date().toISOString();
      await writeFile(receiptPath, JSON.stringify(receipt, null, 2), { mode: 0o600 });
      console.info(JSON.stringify({ fingerprint, createdNow: missing, before, after, receiptPath }));
    } catch (error) { try { await tx.rollback(); } catch { /* Reinspecionar antes de retomar em caso de conexão perdida. */ } throw error; }
    finally { tx.close(); }
  } else {
    const missing = await inspect(db);
    console.info(JSON.stringify({ fingerprint, missing, definitions, complete: missing.length === 0 }));
    if (mode === 'verify' && missing.length) process.exitCode = 1;
  }
} finally { db.close(); }
