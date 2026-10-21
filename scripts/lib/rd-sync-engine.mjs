import { hash, stableId } from './rd-complement-recovery.mjs';

export { hash, stableId };
export const statement = (sql, args = []) => ({ sql, args });

const dateColumns = new Set([
  'createdAt', 'updatedAt', 'criadoEm', 'dataReuniao', 'proximoContatoEm',
  'iniciadoEm', 'concluidoEm', 'prazo', 'concluidaEm', 'alertaEm', 'alertaDisparadoEm',
]);

// Prisma backups use ISO timestamps, while libSQL can return SQL text or milliseconds.
// Only known DATETIME columns are normalized; payload JSON remains byte-for-byte text.
export const stateHash = rows => hash(rows.map(row => Object.fromEntries(
  Object.entries(row).map(([key, value]) => {
    if (dateColumns.has(key) && value !== null) {
      const raw = typeof value === 'number' || typeof value === 'bigint'
        ? Number(value)
        : String(value).replace(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/, '$1T$2Z');
      const date = new Date(raw);
      if (Number.isFinite(date.getTime())) return [key, date.toISOString()];
    }
    if (typeof value === 'bigint') return [key, { sqliteBigInt: String(value) }];
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      return [key, { sqliteBlob: Buffer.from(bytes).toString('base64') }];
    }
    return [key, value];
  }),
)));

const hexHash = /^[a-f\d]{64}$/i;
const readPragmas = new Set([
  'table_info', 'table_xinfo', 'foreign_key_list', 'foreign_key_check',
  'index_list', 'index_info', 'index_xinfo', 'integrity_check', 'quick_check',
  'database_list', 'compile_options', 'foreign_keys', 'encoding', 'schema_version',
  'user_version', 'page_count', 'freelist_count',
]);

function validateStatement(query, readOnly = false) {
  if (!query || typeof query.sql !== 'string' || !query.sql.trim() || !Array.isArray(query.args)) {
    throw Error('SQL ou argumentos inválidos no plano.');
  }
  const { sql, args } = query;
  // Restrict to one statement and disallow comments instead of attempting to parse
  // arbitrary executable SQL. Quoted literal content is excluded from token checks.
  if (sql.includes(';') || sql.includes('--') || sql.includes('/*') || sql.includes('*/')) {
    throw Error('Separadores ou comentários SQL não são permitidos no plano.');
  }
  const tokens = sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]/g, '');
  if (/[:@$]|\?\d/.test(tokens) || (tokens.match(/\?/g) ?? []).length !== args.length) {
    throw Error('Argumentos SQL inesperados; use parâmetros posicionais simples.');
  }
  if (args.some(value => value !== null && !['string', 'number', 'bigint', 'boolean'].includes(typeof value)
    && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value))
    || args.some(value => typeof value === 'number' && !Number.isFinite(value))) {
    throw Error('Argumento SQL inválido.');
  }
  if (!readOnly) return;
  if (/^\s*SELECT\b/i.test(tokens)) {
    // SQLite replace(value, search, replacement) is a pure text function; the
    // REPLACE statement remains forbidden, including malformed SELECT + DML.
    if (/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|ATTACH|DETACH|VACUUM|REINDEX|load_extension|writefile)\b|\bREPLACE\b(?!\s*\()/i.test(tokens)) {
      throw Error('Guard deve conter somente leitura SELECT/PRAGMA.');
    }
    return;
  }
  const pragma = tokens.match(/^\s*PRAGMA\s+(?:(?:main|temp)\.)?([a-z_]+)\s*(\([^()]*\))?\s*$/i);
  const argumentPragmas = /^(?:table_info|table_xinfo|foreign_key_list|foreign_key_check|index_list|index_info|index_xinfo|integrity_check|quick_check)$/i;
  if (!pragma || !readPragmas.has(pragma[1].toLowerCase()) || (pragma[2] && !argumentPragmas.test(pragma[1]))) {
    throw Error('Guard deve conter somente leitura SELECT/PRAGMA.');
  }
}

export function guard(sql, args, rows) {
  const query = statement(sql, args);
  validateStatement(query, true);
  return { ...query, hash: stateHash(rows) };
}

function validateChange(change, fingerprint) {
  if (typeof fingerprint !== 'string' || !hexHash.test(fingerprint)) throw Error('Fingerprint deve ser SHA-256 de 64 caracteres.');
  if (!change || !['key', 'cardId', 'label'].every(key => typeof change[key] === 'string' && change[key].trim())) {
    throw Error('Identidade da operação inválida.');
  }
  for (const key of ['before', 'after', 'writes', 'undo']) {
    if (!Array.isArray(change[key]) || !change[key].length) throw Error(`Operação sem ${key}.`);
  }
  if (change.rollbackAfter !== undefined && (!Array.isArray(change.rollbackAfter) || !change.rollbackAfter.length)) {
    throw Error('Estado compensatório inválido.');
  }
  if (change.rollbackFinal !== undefined && (!Array.isArray(change.rollbackFinal) || !change.rollbackFinal.length)) {
    throw Error('Estado compensatório final inválido.');
  }
  for (const query of [...change.before, ...change.after, ...(change.rollbackAfter ?? []), ...(change.rollbackFinal ?? [])]) {
    validateStatement(query, true);
    if (typeof query.hash !== 'string' || !hexHash.test(query.hash)) throw Error('Hash do guard inválido.');
  }
  for (const query of [...change.writes, ...change.undo]) validateStatement(query);
}

async function matches(tx, checks) {
  // All reads use the same transaction, including remote libSQL clients.
  const results = await tx.batch(checks.map(({ sql, args }) => ({ sql, args })));
  return checks.every((check, index) => check.hash === stateHash(results[index].rows.map(row => ({ ...row }))));
}

async function markers(tx, change, fingerprint) {
  const appliedId = stableId('rdsync', fingerprint, change.key);
  const rollbackId = stableId('rdsyncundo', fingerprint, change.key);
  const result = await tx.execute(statement(
    'SELECT id,cardId,acao,automacaoOrigem FROM BpmCardHistorico WHERE id IN (?,?)', [appliedId, rollbackId],
  ));
  for (const row of result.rows) {
    const undo = row.id === rollbackId;
    if (row.cardId !== change.cardId || row.acao !== (undo ? 'RD_DADOS_REVERTIDOS' : 'RD_DADOS_PREENCHIDOS')
      || row.automacaoOrigem !== (undo ? 'RD_STATION_FIELDS_ROLLBACK' : 'RD_STATION_FIELDS_SYNC')) {
      throw Error('Auditoria existente incompatível com a operação.');
    }
  }
  const applied = result.rows.some(row => row.id === appliedId);
  const rolledBack = result.rows.some(row => row.id === rollbackId);
  if (rolledBack && !applied) throw Error('Auditoria de reversão sem aplicação original.');
  return { applied, rolledBack };
}

function audit(change, fingerprint, rollback) {
  const metadata = { operacao: change.key, descricao: change.label, plano: fingerprint };
  const before = rollback ? change.after : change.before;
  const after = rollback ? (change.rollbackAfter ?? change.before) : change.after;
  const evidence = Array.isArray(change.evidence) ? { campos: change.evidence } : {};
  return statement(
    'INSERT INTO BpmCardHistorico (id,cardId,acao,valorAnteriorJson,valorNovoJson,automacaoOrigem,createdAt) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)',
    [stableId(rollback ? 'rdsyncundo' : 'rdsync', fingerprint, change.key), change.cardId,
      rollback ? 'RD_DADOS_REVERTIDOS' : 'RD_DADOS_PREENCHIDOS',
      JSON.stringify({ ...metadata, estado: before.map(check => check.hash) }),
      JSON.stringify({ ...metadata, estado: after.map(check => check.hash), ...evidence }),
      rollback ? 'RD_STATION_FIELDS_ROLLBACK' : 'RD_STATION_FIELDS_SYNC'],
  );
}

/** Apply exactly one approved change, validating both state transitions atomically. */
export async function applySyncChange(db, change, fingerprint, { rollback = false } = {}) {
  validateChange(change, fingerprint);
  const tx = await db.transaction('write');
  try {
    const marks = await markers(tx, change, fingerprint);
    if (!rollback && marks.rolledBack) throw Error('Plano já revertido; gere uma nova prévia.');
    if ((rollback && marks.rolledBack) || (!rollback && marks.applied)) {
      const checks = rollback ? (change.rollbackAfter ?? change.before) : change.after;
      const immediateMatches=await matches(tx,checks);
      const finalMatches=rollback&&change.rollbackFinal?await matches(tx,change.rollbackFinal):false;
      if (!immediateMatches&&!finalMatches) throw Error('Estado mudou após operação auditada; alterações preservadas.');
      await tx.commit();
      return { applied: 0, skipped: 1 };
    }
    if (rollback && !marks.applied) {
      await tx.commit();
      return { applied: 0, skipped: 1 };
    }
    if (!await matches(tx, rollback ? change.after : change.before)) {
      throw Error('Estado mudou desde a prévia; operação bloqueada sem sobrescrever alterações.');
    }
    await tx.batch(rollback ? change.undo : change.writes);
    if (!await matches(tx, rollback ? (change.rollbackAfter ?? change.before) : change.after)) {
      throw Error('Estado após escrita diverge do plano; transação revertida.');
    }
    await tx.execute(audit(change, fingerprint, rollback));
    await tx.commit();
    return { applied: 1, skipped: 0 };
  } catch (error) {
    try { await tx.rollback(); } catch { /* Preserve original failure after an aborted transaction. */ }
    throw error;
  } finally { tx.close(); }
}

/** Inspect consistent state and markers without attempting repairs or writes. */
export async function verifySyncChange(db, change, fingerprint) {
  validateChange(change, fingerprint);
  const tx = await db.transaction('read');
  try {
    const marks = await markers(tx, change, fingerprint);
    const checks = marks.rolledBack ? (change.rollbackFinal ?? change.rollbackAfter ?? change.before) : marks.applied ? change.after : change.before;
    const stateMatches = await matches(tx, checks);
    await tx.commit();
    return { ...marks, stateMatches };
  } catch (error) {
    try { await tx.rollback(); } catch { /* Preserve original failure. */ }
    throw error;
  } finally { tx.close(); }
}
