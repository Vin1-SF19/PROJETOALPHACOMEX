import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import { createClient, type Client, type Transaction, type InValue } from '@libsql/client';
import { PLAYBOOK_DESTINATIONS, PLAYBOOK_SOURCES, composePlaybooks, type SourcePlaybook } from './lib/rd-playbooks';
import { verificarBackupTurso } from './lib/verificar-backup-turso.mjs';
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true });
const mode = process.argv[2] ?? 'preview';
const opt = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!['preview', 'apply', 'verify', 'rollback'].includes(mode)) throw Error('Modo inválido');
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const provider = 'RD_STATION_PLAYBOOK_V1';
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw Error('Banco não configurado');
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const planPath = opt('plan') ?? 'database-backups/pre-change/rd-playbooks/plan.json';
type Stage = { id: string; pipelineId: string; nome: string; script: string | null; updatedAt: string | number; ativo: number };
type Pipeline = { id: string; nome: string; configVersion: number; updatedAt: string | number };
type Plan = { version: 1; provider: string; databaseHash: string; generatedAt: string; sourceHash: string; changes: { before: Stage; after: Stage; sources: string[] }[]; pipelines: { before: Pipeline; after: Pipeline }[]; summary: { guides: number; stages: number; pipelines: number }; fingerprint: string };
async function rows<T>(sql: string, args: InValue[] = [], client: Client | Transaction = db): Promise<T[]> { return (await client.execute({ sql, args })).rows.map(r => ({ ...r })) as T[]; }
const stageSelect = 'SELECT id,pipelineId,nome,script,updatedAt,ativo FROM BpmEtapa WHERE id=?';
const pipelineSelect = 'SELECT id,nome,configVersion,updatedAt FROM BpmPipeline WHERE id=?';
function same(a: unknown, b: unknown) { return hash(a) === hash(b); }
async function preview() {
  const source: (SourcePlaybook & { deal_pipeline: { id: string } })[] = JSON.parse(await readFile(opt('source') ?? 'database-backups/pre-change/rd-activities-recovery/procedures-inspection.json', 'utf8'));
  if (!Array.isArray(source)) throw Error('Snapshot inválido');
  const guides = source.filter(s => s.objective?.trim() || s.description?.trim());
  if (guides.length !== 14 || new Set(guides.map(g => g.id)).size !== 14 || guides.some(g => !PLAYBOOK_DESTINATIONS[g.id])) throw Error('Escopo deve conter os 14 guias mapeados');
  for (const g of guides) { const expected = PLAYBOOK_SOURCES[g.id]; if (g.name !== expected.name || g.pipeline !== expected.pipeline || g.deal_pipeline?.id !== expected.pipelineId) throw Error('Identidade de origem divergente'); }
  if (new Set(guides.map(g => g.pipeline)).size !== 6) throw Error('Funis de origem fora do escopo');
  const ledgers = await rows<{ fingerprint: string; status: string }>('SELECT fingerprint,status FROM BpmImportacaoExterna WHERE provider=?', [provider]);
  if (ledgers.some(l => l.status === 'CONCLUIDO' && !ledgers.some(r => r.status === 'REVERTIDO' && r.fingerprint === `rollback:${l.fingerprint}`))) throw Error('Playbooks já importados; use verify ou rollback do plano existente');
  const stages = await rows<Stage & { pipelineNome: string }>('SELECT e.id,e.pipelineId,e.nome,e.script,e.updatedAt,e.ativo,p.nome pipelineNome FROM BpmEtapa e JOIN BpmPipeline p ON p.id=e.pipelineId');
  const groups = new Map<string, { stage: Stage; guides: SourcePlaybook[] }>();
  for (const guide of guides) {
    const [pipelineName, stageName] = PLAYBOOK_DESTINATIONS[guide.id];
    const matches = stages.filter(s => s.pipelineNome === pipelineName && s.nome === stageName && Boolean(s.ativo));
    if (matches.length !== 1) throw Error('Destino ausente ou ambíguo');
    const { pipelineNome: _name, ...stage } = matches[0]; void _name;
    const group = groups.get(stage.id) ?? { stage, guides: [] }; group.guides.push(guide); groups.set(stage.id, group);
  }
  const generatedAt = new Date().toISOString();
  const changes = [...groups.values()].map(({ stage, guides }) => ({ before: stage, after: { ...stage, script: composePlaybooks(stage.script, guides), updatedAt: generatedAt }, sources: guides.map(g => g.id) }));
  const pipelines = await Promise.all([...new Set(changes.map(c => c.before.pipelineId))].map(async id => { const before = (await rows<Pipeline>(pipelineSelect, [id]))[0]; return { before, after: { ...before, configVersion: before.configVersion + 1, updatedAt: generatedAt } }; }));
  const plan = { version: 1 as const, provider, databaseHash: createHash('sha256').update(url!).digest('hex'), generatedAt, sourceHash: hash(source), changes, pipelines, summary: { guides: guides.length, stages: changes.length, pipelines: pipelines.length } };
  if (changes.length !== 10 || pipelines.length !== 3) throw Error('Destinos fora do escopo esperado');
  await mkdir(path.dirname(planPath), { recursive: true, mode: 0o700 });
  await writeFile(planPath, JSON.stringify({ ...plan, fingerprint: hash(plan) }, null, 2), { mode: 0o600 }); await chmod(planPath, 0o600);
  console.log(JSON.stringify({ planPath, fingerprint: hash(plan), ...plan.summary }));
}
async function execute() {
  const parsed: Plan = JSON.parse(await readFile(planPath, 'utf8'));
  const { fingerprint, ...plan } = parsed;
  if (hash(plan) !== fingerprint || plan.databaseHash !== createHash('sha256').update(url!).digest('hex') || plan.provider !== provider || plan.version !== 1 || plan.changes.length !== 10 || plan.pipelines.length !== 3) throw Error('Plano inválido');
  const auditId = `rdplay_${fingerprint.slice(0, 32)}`;
  const rollbackId = `rdplayundo_${fingerprint.slice(0, 32)}`;
  const auditSql = 'SELECT id,status,resumoJson FROM BpmImportacaoExterna WHERE id=? AND provider=?';
  type Audit = { id: string; status: string; resumoJson: string };
  async function check(which: 'before' | 'after', client: Client | Transaction = db) {
    let matches = 0;
    for (const c of plan.changes) if (same((await rows<Stage>(stageSelect, [c.before.id], client))[0], c[which])) matches++;
    for (const p of plan.pipelines) if (same((await rows<Pipeline>(pipelineSelect, [p.before.id], client))[0], p[which])) matches++;
    return matches;
  }
  if (mode === 'verify') { const applied = (await rows<Audit>(auditSql, [auditId, provider])).length === 1; const rolledBack = (await rows<Audit>(auditSql, [rollbackId, provider])).length === 1; const matching = await check('after'); console.log(JSON.stringify({ fingerprint, applied, rolledBack, checks: 13, matching, differing: 13 - matching })); if (!applied || rolledBack || matching !== 13) process.exitCode = 2; return; }
  if (opt('confirm') !== (mode === 'rollback' ? `rollback:${fingerprint}` : fingerprint)) throw Error('Confirmação específica ausente');
  const backup = opt('backup'); if (!backup?.endsWith('.sql')) throw Error('Backup SQL obrigatório');
  const manifestPath = backup.replace(/\.sql$/, '.manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const age = Date.now() - Date.parse(manifest.generatedAt);
  if (manifest.databaseHash !== plan.databaseHash || !Number.isFinite(age) || age < 0 || age > 48 * 3600000) throw Error('Backup incorreto ou vencido');
  await verificarBackupTurso(backup, manifestPath);
  const tx = await db.transaction('write');
  try {
    const applied = (await rows<Audit>(auditSql, [auditId, provider], tx))[0];
    const undone = (await rows<Audit>(auditSql, [rollbackId, provider], tx))[0];
    if (mode === 'apply' && !applied) {
      const ledgers = await rows<{ fingerprint: string; status: string }>('SELECT fingerprint,status FROM BpmImportacaoExterna WHERE provider=?', [provider], tx);
      if (ledgers.some(l => l.status === 'CONCLUIDO' && !ledgers.some(r => r.status === 'REVERTIDO' && r.fingerprint === `rollback:${l.fingerprint}`))) throw Error('Outro plano já importou os playbooks');
    }
    if (mode === 'apply' && undone) throw Error('Plano já revertido; gere nova prévia');
    if (mode === 'apply' && applied) { if (await check('after', tx) !== 13) throw Error('Aplicação anterior divergiu; alterações posteriores preservadas'); await tx.rollback(); console.log(JSON.stringify({ status: 'JA_APLICADO' })); return; }
    if (mode === 'rollback' && undone) { await tx.rollback(); console.log(JSON.stringify({ status: 'JA_REVERTIDO' })); return; }
    if (mode === 'rollback' && !applied) throw Error('Plano não aplicado');
    if (await check(mode === 'apply' ? 'before' : 'after', tx) !== 13) throw Error('Conflito de script, etapa ou versão; nenhuma mudança aplicada');
    const now = new Date().toISOString();
    for (const c of plan.changes) await tx.execute({ sql: 'UPDATE BpmEtapa SET script=?,updatedAt=? WHERE id=?', args: [mode === 'apply' ? c.after.script : c.before.script, mode === 'apply' ? c.after.updatedAt : now, c.before.id] });
    for (const p of plan.pipelines) await tx.execute({ sql: 'UPDATE BpmPipeline SET configVersion=?,updatedAt=? WHERE id=?', args: [mode === 'apply' ? p.after.configVersion : p.after.configVersion + 1, mode === 'apply' ? p.after.updatedAt : now, p.before.id] });
    await tx.execute({ sql: 'INSERT INTO BpmImportacaoExterna (id,provider,fingerprint,status,resumoJson,iniciadoEm,concluidoEm) VALUES (?,?,?,?,?,?,?)', args: [mode === 'apply' ? auditId : rollbackId, provider, mode === 'apply' ? fingerprint : `rollback:${fingerprint}`, mode === 'apply' ? 'CONCLUIDO' : 'REVERTIDO', JSON.stringify({ plan: parsed, operation: mode }), now, now] });
    await tx.commit(); console.log(JSON.stringify({ status: mode === 'apply' ? 'CONCLUIDO' : 'REVERTIDO', ...plan.summary }));
  } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}
try { if (mode === 'preview') await preview(); else await execute(); } finally { db.close(); }
