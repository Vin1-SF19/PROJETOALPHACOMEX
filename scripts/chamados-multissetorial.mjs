#!/usr/bin/env node
// Usage: node --import tsx scripts/chamados-multissetorial.mjs [--apply ...]
// Dry-run is read-only. Actual execution additionally requires human consent
// documented by Vault; CLI flags are safeguards, not a substitute for consent.
import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCategoriasIniciaisDoSetor } from '../src/lib/chamados/categorias-iniciais.ts';
import { normalizeRole } from '../src/lib/roles.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
config({ path: path.join(root, '.env.local'), quiet: true });
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const supported = ['--apply', '--database-hash=', '--approve-plan=', '--backup-manifest='];
if (args.some((arg) => !supported.some((prefix) => prefix.endsWith('=') ? arg.startsWith(prefix) : arg === prefix))) {
  throw new Error('Argumento desconhecido. Uso: node --import tsx scripts/chamados-multissetorial.mjs [--apply --database-hash=<sha256> --approve-plan=<sha256> --backup-manifest=<manifest.json>]');
}
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error('TURSO_DATABASE_URL ausente');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const databaseHash = hash(url);
const migrationPath = path.join(root, 'prisma/migrations/20261015190000_chamados_multissetorial/migration.sql');
const sql = await readFile(migrationPath, 'utf8');
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

async function inspect(db) {
  const setores = (await db.execute('SELECT id,nome,ativo FROM setor ORDER BY id')).rows;
  const normalized = new Set();
  const destinos = setores.filter((setor) => Boolean(setor.ativo) && normalizeRole(String(setor.nome)) !== 'DESVINCULADO');
  for (const setor of destinos) {
    const key = normalizeRole(String(setor.nome));
    if (!key || normalized.has(key)) throw new Error('Setores ativos ausentes ou ambíguos após normalização');
    normalized.add(key);
  }
  if (!normalized.has('TI')) throw new Error('Setor TI ativo obrigatório; criação exige outro plano autorizado');
  const seeds = destinos.flatMap((setor) => getCategoriasIniciaisDoSetor(String(setor.nome)).map((categoria) => ({
    setorId: Number(setor.id), ...categoria, nomeNormalizado: normalizeRole(categoria.nome),
  })));
  const columns = (await db.execute('PRAGMA table_info(chamados)')).rows.map((row) => row.name);
  const added = ['setorDestinoId','setorDestinoNome','categoriaId'].filter((column) => columns.includes(column));
  const tableExists = (await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chamado_categoria'")).rows.length === 1;
  if (added.length !== 0 && added.length !== 3) throw new Error('Schema parcialmente aplicado; investigar sem mutação');
  if (tableExists !== (added.length === 3)) throw new Error('Catálogo/colunas incompatíveis; investigar sem mutação');
  const phase = tableExists ? 'estrutura-existente' : 'estrutura-pendente';
  const historical = Number((await db.execute('SELECT count(*) AS n FROM chamados')).rows[0].n);
  const planHash = hash(JSON.stringify({ version: 1, databaseHash, sql, seeds }));
  if (tableExists) {
    const categoryColumns = (await db.execute('PRAGMA table_info(chamado_categoria)')).rows.map((row) => row.name);
    for (const column of ['id','setorId','nome','nomeNormalizado','descricao','ativo','ordem','createdAt','updatedAt']) {
      if (!categoryColumns.includes(column)) throw new Error(`Catálogo incompatível: coluna ${column} ausente`);
    }
    const callFks = (await db.execute('PRAGMA foreign_key_list(chamados)')).rows;
    for (const [from, table] of [['setorDestinoId','setor'],['categoriaId','chamado_categoria']]) {
      if (!callFks.some((fk) => fk.from === from && fk.table === table && fk.on_delete === 'RESTRICT')) throw new Error('FK incompatível: ' + from);
    }
  }
  return { phase, historical, seeds, planHash, destinos: destinos.length };
}

try {
  const state = await inspect(client);
  console.info(JSON.stringify({ mode: apply ? 'apply-requested' : 'dry-run-read-only', environment: url.startsWith('file:') ? 'local' : 'remote-production-assumed', databaseHash, planHash: state.planHash, migrationSha256: hash(sql), phase: state.phase, destinos: state.destinos, categoriasPropostas: state.seeds.length, chamadosPreservados: state.historical }));
  if (apply) {
    if (value('--database-hash') !== databaseHash || value('--approve-plan') !== state.planHash) throw new Error('Hash do ambiente ou plano não confirmado. Execute dry-run e obtenha aprovação humana específica via Vault.');
    const manifestArg = value('--backup-manifest');
    if (!manifestArg) throw new Error('Manifesto de backup completo obrigatório');
    const manifestPath = path.resolve(root, manifestArg);
    const backupRoot = path.join(root, 'database-backups/pre-change') + path.sep;
    if (!manifestPath.startsWith(backupRoot) || !manifestPath.endsWith('.manifest.json')) throw new Error('Backup precisa estar em database-backups/pre-change/');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const age = Date.now() - Date.parse(manifest.generatedAt);
    if (!Number.isFinite(age) || age < 0 || age > 48 * 60 * 60 * 1000) throw new Error('Backup inválido ou mais antigo que 48 horas');
    if (manifest.databaseHash !== databaseHash) throw new Error('Backup pertence a outro banco');
    if (!String(manifest.reason).includes('chamados-multissetorial')) throw new Error('Backup não identificado para esta mudança');
    const dumpPath = manifestPath.replace(/\.manifest\.json$/, '.sql');
    if ((await stat(dumpPath)).size <= 0) throw new Error('Backup vazio');
    execFileSync(process.execPath, [path.join(root, 'scripts/verify-turso-backup.mjs'), dumpPath, manifestPath], { stdio: ['ignore','pipe','pipe'] });

    await client.execute('PRAGMA foreign_keys=ON');
    if (Number((await client.execute('PRAGMA foreign_keys')).rows[0].foreign_keys) !== 1) throw new Error('Foreign keys desabilitadas; alteração bloqueada');
    const transaction = await client.transaction('write');
    try {
      const locked = await inspect(transaction);
      if (locked.planHash !== state.planHash || locked.phase !== state.phase) throw new Error('Inventário mudou desde dry-run; plano deve ser reaprovado');
      if (locked.phase === 'estrutura-pendente') {
        // SQL artifact contains only simple statements without semicolons in strings.
        const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map((statement) => statement.trim()).filter(Boolean);
        for (const statement of statements) await transaction.execute(statement);
      }
      let inserted = 0;
      for (const category of locked.seeds) {
        const result = await transaction.execute({
          sql: 'INSERT INTO chamado_categoria (setorId,nome,nomeNormalizado,descricao,ativo,ordem,createdAt,updatedAt) VALUES (?,?,?,?,1,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(setorId,nomeNormalizado) DO NOTHING',
          args: [category.setorId,category.nome,category.nomeNormalizado,category.descricao,category.ordem],
        });
        inserted += result.rowsAffected;
      }
      const integrity = (await transaction.execute('PRAGMA integrity_check')).rows;
      const foreignKeys = (await transaction.execute('PRAGMA foreign_key_check')).rows;
      const count = Number((await transaction.execute('SELECT count(*) AS n FROM chamados')).rows[0].n);
      if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || foreignKeys.length || count !== locked.historical) throw new Error('Integridade/FKs/contagens divergentes; operação revertida');
      await transaction.commit();
      console.info(JSON.stringify({ applied: true, categoriasInseridas: inserted, chamadosPreservados: count, integrity: 'ok', foreignKeyViolations: 0 }));
    } catch (error) {
      await transaction.rollback();
      throw error;
    } finally {
      transaction.close();
    }
  }
} finally {
  client.close();
}
