import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import { createClient, type InValue, type Client, type Transaction } from '@libsql/client';
import { SLA_TARGETS, originalEntry, initialSla } from './lib/rd-sla-import';
import { hash, stableId, stateHash } from './lib/rd-complement-recovery.mjs';
import { verificarBackupTurso } from './lib/verificar-backup-turso.mjs';
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true });
type Row = Record<string, string | number | null>;
type Query = { sql: string; args: InValue[] };
type Guard = Query & { hash: string };
type Source = { id: string; name: string; pipeline: string; deal_pipeline: { id: string }; configuration: { type: string; value: number; format: string; extra: { skip_days: unknown[]; work_time: Record<string, string> } }[] };
const provider = 'RD_STATION_SLA_V1';
const opt = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const mode = process.argv[2] ?? 'preview';
if (!['preview', 'apply', 'verify', 'rollback'].includes(mode)) throw Error('Modo inválido');
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw Error('Banco não configurado');
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const planPath = opt('plan') ?? 'database-backups/pre-change/rd-sla/plan.json';
const q = (sql: string, args: InValue[] = []): Query => ({ sql, args });
const rows = async (query: Query, client: Client | Transaction = db): Promise<Row[]> => (await client.execute(query)).rows.map(r => ({ ...r })) as Row[];
const insert = (table: string, row: Row) => q(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`, Object.values(row));
const guard = (query: Query, data: Row[]): Guard => ({ ...query, hash: stateHash(data) });
const cuid = (...parts: string[]): string => `c${hash(parts).slice(0,24)}`;
const conditions = JSON.stringify({ operador: 'AND', condicoes: [{ tipo: 'condicao', campo: { fonte: 'card', campo: 'status' }, operador: 'igual', valor: 'ATIVO' }, { tipo: 'condicao', campo: { fonte: 'card', campo: 'concluidoEm' }, operador: 'vazio' }] });
const sourceIdentities: Record<string, string> = {"667f0aab1817ac0018a06561": "667ed153478ffa00212d88d7:Contratados stand-by", "667ed153478ffa00212d88d9": "667ed153478ffa00212d88d7:Envio do checklist e boas vindas", "6681a7ad67810b001961680e": "6681a7ad67810b001961680c:Elaborar contrato", "6681a7ad67810b0019616810": "6681a7ad67810b001961680c:Pagamento confirmado", "6681a7ad67810b0019616811": "6681a7ad67810b001961680c:Enviar NF - Contratação", "6681a8962a5fe30016466933": "6681a8952a5fe30016466931:Enviar NF - êxito", "6681bc96f250270010f9b255": "6681bc96f250270010f9b253:Processos para revisão", "6866fa9165097a0025c44494": "6681bc96f250270010f9b253:Processos revisado para protocolo", "6681bc96f250270010f9b257": "6681bc96f250270010f9b253:Revisão do protocolo feito", "6681bc96f250270010f9b258": "6681bc96f250270010f9b253:Aguardando despacho", "66881b2f26e5f20010518ef0": "66881b2f26e5f20010518eee:Contratados stand-by", "66881b2f26e5f20010518ef1": "66881b2f26e5f20010518eee:Envio do checklist e boas vindas", "66881b2f26e5f20010518ef2": "66881b2f26e5f20010518eee:Documentação em análise", "69fa3e31479dc00014f0cab8": "69fa3e31479dc00014f0cab6:Contratos Stand-by", "69fa3e31479dc00014f0cab9": "69fa3e31479dc00014f0cab6:Envio do checklist e boas vindas", "69fa3e31479dc00014f0caba": "69fa3e31479dc00014f0cab6:Documentação em análise", "69fa3e31479dc00014f0cabb": "69fa3e31479dc00014f0cab6:CLIENTES CANCELADOS"};
type Plan = { version: number; provider: string; databaseHash: string; sourceHash: string; generatedAt: string; before: Guard[]; after: Guard[]; writes: Query[]; undo: Query[]; summary: Record<string, number>; exceptions: { cardId: string; reason: string }[]; fingerprint: string };
async function preview() {
  const source = JSON.parse(await readFile(opt('source') ?? 'database-backups/pre-change/rd-activities-recovery/sla-cadence-inspection.json', 'utf8'));
  const rules: Source[] = source.stages.filter((s: Source) => s.configuration?.length);
  if (rules.length !== 17 || new Set(rules.map(s => s.id)).size !== 17 || rules.some(s => sourceIdentities[s.id] !== `${s.deal_pipeline.id}:${s.name}`)) throw Error('Inventário RD divergente');
  const activeAudit = await rows(q('SELECT fingerprint,status FROM BpmImportacaoExterna WHERE provider=?', [provider]));
  if (activeAudit.some(r => r.status === 'CONCLUIDO' && !activeAudit.some(u => u.fingerprint === `rollback:${r.fingerprint}`))) throw Error('SLAs já importados');
  const before: Guard[] = [], after: Guard[] = [], writes: Query[] = [], undo: Query[] = [];
  const snapshot = async (query: Query) => { const data = await rows(query); before.push(guard(query, data)); return data; };
  const indexQuery = q("SELECT name,sql FROM sqlite_master WHERE type='index' AND name='BpmSlaInstancia_card_config_key'");
  const originalIndex = await snapshot(indexQuery);
  const oldIndexSql = 'CREATE UNIQUE INDEX "BpmSlaInstancia_card_config_key" ON "BpmSlaInstancia"("cardId", "slaConfigId") WHERE "tarefaId" IS NULL';
  if (originalIndex.length !== 1 || String(originalIndex[0].sql).replace(/\s+/g,' ').trim() !== oldIndexSql) throw Error('Índice SLA divergente; requer revisão');
  const migration = await readFile('prisma/migrations/20261014151000_sla_ciclos_etapa_abertos/migration.sql','utf8');
  const ddl = migration.replace(/^--.*$/gm,'').split(';').map(sql=>sql.trim()).filter(Boolean);
  if (ddl.length !== 2 || !ddl[0].startsWith('DROP INDEX') || !ddl[1].startsWith('CREATE UNIQUE INDEX')) throw Error('DDL inválida');
  writes.push(...ddl.map(sql=>q(sql)));
  after.push(guard(indexQuery,[{name:'BpmSlaInstancia_card_config_key',sql:ddl[1]}]));

  const stages = await snapshot(q('SELECT e.id,e.pipelineId,e.nome,e.ativo,e.ehFinal,p.nome pipelineNome,p.configVersion FROM BpmEtapa e JOIN BpmPipeline p ON p.id=e.pipelineId ORDER BY e.id'));
  const groups = new Map<string, { stage: Row; days: number; sources: Source[] }>();
  for (const source of rules) {
    const target = SLA_TARGETS[source.name]; const rule = source.configuration[0];
    if (!target || source.configuration.length !== 1 || rule.type !== 'deal_stopped' || rule.format !== 'days' || rule.value !== (source.name === 'Aguardando despacho' ? 12 : 1) || rule.extra.skip_days.length || JSON.stringify(rule.extra.work_time) !== JSON.stringify({ '00:00:00': '23:59:59' })) throw Error('Regra RD fora do escopo');
    const matches = stages.filter(s => s.pipelineNome === target[0] && s.nome === target[1] && s.ativo);
    if (matches.length !== 1) throw Error('Etapa ausente ou ambígua');
    const stage = matches[0]; const key = String(stage.id); const old = groups.get(key);
    if (old && old.days !== rule.value) throw Error('Prazos conflitantes');
    groups.set(key, { stage, days: rule.value, sources: [...(old?.sources ?? []), source] });
  }
  if (groups.size !== 10) throw Error('Dez destinos esperados');
  const existing = await snapshot(q('SELECT * FROM BpmSlaConfig ORDER BY id'));
  if (existing.length) throw Error('Há configurações SLA; requer reconciliação antes de importar');
  if ((await snapshot(q('SELECT * FROM BpmSlaInstancia ORDER BY id'))).length) throw Error('Há instâncias SLA; requer reconciliação');
  const stageIds = [...groups.keys()]; const placeholders = stageIds.map(() => '?').join(',');
  const cardQuery = q(`SELECT c.id,c.pipelineId,c.etapaId,c.status,c.versao,c.createdAt,c.concluidoEm,s.canceladoEm,s.arquivadoEm FROM BpmCard c LEFT JOIN BpmCardEstado s ON s.cardId=c.id WHERE c.etapaId IN (${placeholders}) ORDER BY c.id`, stageIds);
  const cards = await snapshot(cardQuery);
  const whereCards = `cardId IN (SELECT id FROM BpmCard WHERE etapaId IN (${placeholders}))`;
  const origins = await snapshot(q(`SELECT cardId,sourceStageId,sourceStageName,rawJson FROM BpmCardOrigemExterna WHERE ${whereCards} ORDER BY cardId`, stageIds));
  const movements = await snapshot(q(`SELECT cardId,etapaDestinoId,concluidoEm FROM BpmTransicaoExecucao WHERE ${whereCards} ORDER BY id`, stageIds));
  const histories = await snapshot(q(`SELECT id,cardId,acao,valorNovoJson,createdAt FROM BpmCardHistorico WHERE ${whereCards} AND acao IN ('CARD_MOVIDO','CARD_MOVIDO_POR_AUTOMACAO','MOVIDO_AUTOMACAO','CARD_CRIADO') ORDER BY id`, stageIds));
  const now = new Date().toISOString(); const exceptions: Plan['exceptions'] = [];
  const configs: Row[] = [], instances: Row[] = [], logs: Row[] = [];
  let excluded = 0; const dateSources: Record<string, number> = {};
  const aliases: Record<string, readonly [string, string]> = { ...SLA_TARGETS, 'Atribuição ao analista responsável': ['Operacional','Boas vindas'], 'Documentação em análise - VITOR': ['Operacional','Documentação em análise'], 'Deferidos - EFETUAR COBRANÇA': ['Financeiro','Emissão de Nota Fiscal'] };
  for (const { stage, days, sources } of groups.values()) {
    const id = cuid('rdslaconfig', String(stage.id));
    const conf: Row = { id, pipelineId: stage.pipelineId, etapaId: stage.id, servicoId: null, tipoProcesso: null, tipoTarefa: null, condicaoRegraJson: conditions, pausaCondicaoJson: null, retomadaCondicaoJson: null, criadoPorId: null, nome: `${stage.nome} — ${days} ${days === 1 ? 'dia' : 'dias'} corridos`, descricao: `Prazo desde a entrada na etapa. Importado do RD: ${sources.map(s => `${s.pipeline} / ${s.name}`).join('; ')}. Aplicável a todos os cards ativos desta etapa.`, quantidade: days, unidade: 'DIAS', inicioMomento: 'ENTRADA_ETAPA', suspendeAutomacaoAoVencer: 0, ativa: stage.nome === 'Cliente cancelado' ? 0 : 1, prioridade: 0, createdAt: now, updatedAt: now };
    configs.push(conf); writes.push(insert('BpmSlaConfig', conf));
    undo.push(q('UPDATE BpmSlaConfig SET ativa=0,updatedAt=CURRENT_TIMESTAMP WHERE id=?', [id]));
    for (const card of cards.filter(c => c.etapaId === stage.id)) {
      if (card.status !== 'ATIVO' || card.concluidoEm || card.canceladoEm || card.arquivadoEm || stage.nome === 'Cliente cancelado' || stage.ehFinal) { excluded++; continue; }
      const origin = origins.find(o => o.cardId === card.id);
      const moves = movements.filter(m => m.cardId === card.id).map(m => ({ etapaDestinoId: String(m.etapaDestinoId), at: m.concluidoEm }));
      for (const h of histories.filter(h => h.cardId === card.id && ['CARD_MOVIDO', 'CARD_MOVIDO_POR_AUTOMACAO', 'MOVIDO_AUTOMACAO'].includes(String(h.acao)))) { const value = JSON.parse(String(h.valorNovoJson)); moves.push({ etapaDestinoId: String(value.etapaId ?? value.etapaDestinoId ?? ''), at: h.createdAt }); }
      const target = origin ? aliases[String(origin.sourceStageName)] : undefined;
      const targetStage = target ? stages.find(s => s.pipelineNome === target[0] && s.nome === target[1]) : null;
      const entry = originalEntry({ etapaId: String(card.etapaId), createdAt: card.createdAt, now, moves, ...(origin ? { origin: { sourceStageId: String(origin.sourceStageId), rawJson: String(origin.rawJson), targetStageId: String(targetStage?.id ?? '') } } : {}) });
      if (!entry) { exceptions.push({ cardId: String(card.id), reason: 'Entrada original não comprovada' }); continue; }
      dateSources[entry.source] = (dateSources[entry.source] ?? 0) + 1;
      const instanceId = cuid('rdsla', id, String(card.id)); const timing = initialSla(entry.date, days, now);
      const instance: Row = { id: instanceId, cardId: card.id, tarefaId: null, slaConfigId: id, ...timing, pausadoEm: null, tempoPausadoAcumuladoMs: 0, alertaPrazoEm: null, alertaPrazoDisparadoEm: null, concluidoEm: null, statusAnterior: null, createdAt: now, updatedAt: now };
      const log: Row = { id: stableId('rdslalog', instanceId), instanciaId: instanceId, statusAnterior: null, statusNovo: timing.status, motivo: `Prazo RD importado; entrada preservada (${entry.source})`, origem: 'IMPORTACAO_RD', metadataJson: null, createdAt: now };
      instances.push(instance); logs.push(log); writes.push(insert('BpmSlaInstancia', instance), insert('BpmSlaEventoLog', log));
      undo.push(q("UPDATE BpmSlaInstancia SET status='CANCELADO',concluidoEm=CURRENT_TIMESTAMP,updatedAt=CURRENT_TIMESTAMP WHERE id=?", [instanceId]));
      undo.push(q("INSERT INTO BpmSlaEventoLog (id,instanciaId,statusAnterior,statusNovo,motivo,origem,createdAt) VALUES (?,?,?,'CANCELADO','Importação de SLA revertida','IMPORTACAO_RD',CURRENT_TIMESTAMP)",[stableId('rdslaundo',instanceId),instanceId,timing.status]));
    }
  }
  for (const [table, data] of [['BpmSlaConfig', configs], ['BpmSlaInstancia', instances], ['BpmSlaEventoLog', logs]] as const) {
    const query = data.length ? q(`SELECT ${Object.keys(data[0]).join(',')} FROM ${table} WHERE id IN (${data.map(() => '?').join(',')}) ORDER BY id`, data.map(r => r.id)) : q(`SELECT * FROM ${table} WHERE 1=0`);
    after.push(guard(query, [...data].sort((a,b) => String(a.id).localeCompare(String(b.id)))));
  }
  for (const table of ['BpmSlaAlertaLimite', 'BpmSlaDisparo']) {
    const query = q(`SELECT * FROM ${table} ORDER BY id`); const data = await snapshot(query); after.push(guard(query,data));
  }
  const pipelineIds = [...new Set(configs.map(c => c.pipelineId))];
  const pipeQuery = q(`SELECT id,configVersion,updatedAt FROM BpmPipeline WHERE id IN (${pipelineIds.map(() => '?').join(',')}) ORDER BY id`, pipelineIds);
  const pipes = await snapshot(pipeQuery); const nextPipes: Row[] = pipes.map(p => ({ ...p, configVersion: Number(p.configVersion) + 1, updatedAt: now }));
  after.push(guard(pipeQuery,nextPipes));
  for (const p of nextPipes) { writes.push(q('UPDATE BpmPipeline SET configVersion=?,updatedAt=? WHERE id=?',[p.configVersion,now,p.id])); undo.push(q('UPDATE BpmPipeline SET configVersion=configVersion+1,updatedAt=CURRENT_TIMESTAMP WHERE id=?',[p.id])); }
  undo.push(q('DROP INDEX \"BpmSlaInstancia_card_config_key\"'),q(String(originalIndex[0].sql)));
  const plan = { version: 1, provider, databaseHash: hash(url), sourceHash: hash(source), generatedAt: now, before, after, writes, undo, exceptions, summary: { sourceRules: 17, indexes: 1, configs: configs.length, activeConfigs: configs.filter(c=>c.ativa===1).length, inactiveConfigs: configs.filter(c=>c.ativa===0).length, pipelines: pipes.length, instances: instances.length, overdue: instances.filter(i => i.status === 'ATRASADO').length, excluded, exceptions: exceptions.length, ...dateSources } };
  await mkdir(path.dirname(planPath),{recursive:true,mode:0o700}); await writeFile(planPath, JSON.stringify({...plan,fingerprint:hash(plan)},null,2),{mode:0o600}); await chmod(planPath,0o600);
  console.log(JSON.stringify({planPath,fingerprint:hash(plan),...plan.summary}));
}
async function execute() {
  const parsed: Plan = JSON.parse(await readFile(planPath,'utf8')); const {fingerprint,...plan}=parsed;
  if(hash(plan)!==fingerprint || plan.databaseHash!==hash(url) || plan.provider!==provider || plan.version!==1)throw Error('Plano inválido');
  const auditId=stableId('rdslamigration',fingerprint), undoId=stableId('rdslamigrationundo',fingerprint);
  const auditQuery=q('SELECT id,fingerprint,status FROM BpmImportacaoExterna WHERE provider=? ORDER BY id',[provider]);
  const check=async(guards:Guard[],client:Client|Transaction=db)=>{const results=await client.batch(guards.map(({sql,args})=>({sql,args})));return guards.filter((g,i)=>g.hash===stateHash(results[i].rows.map(r=>({...r})))).length;};
  if(mode==='verify'){const audits=await rows(auditQuery);const matching=await check(plan.after);const valid=audits.some(a=>a.id===auditId)&&!audits.some(a=>a.id===undoId)&&matching===plan.after.length;console.log(JSON.stringify({fingerprint,valid,checks:plan.after.length,matching,...plan.summary}));if(!valid)process.exitCode=2;return;}
  if(opt('confirm')!==(mode==='rollback'?`rollback:${fingerprint}`:fingerprint))throw Error('Confirmação específica ausente');
  const backup=opt('backup');if(!backup?.endsWith('.sql'))throw Error('Backup obrigatório');const manifestPath=backup.replace(/\.sql$/,'.manifest.json');const manifest=JSON.parse(await readFile(manifestPath,'utf8'));const age=Date.now()-Date.parse(manifest.generatedAt);if(manifest.databaseHash!==plan.databaseHash||!Number.isFinite(age)||age<0||age>48*3600000)throw Error('Backup incorreto ou vencido');await verificarBackupTurso(backup,manifestPath);
  const tx=await db.transaction('write');try{
    const audits=await rows(auditQuery,tx);const applied=audits.some(a=>a.id===auditId),undone=audits.some(a=>a.id===undoId);
    if(mode==='apply'&&undone)throw Error('Plano revertido');
    if(mode==='rollback'&&undone){await tx.rollback();console.log('JA_REVERTIDO');return;}
    if(mode==='apply'&&applied){if(await check(plan.after,tx)!==plan.after.length)throw Error('Estado aplicado divergiu');await tx.rollback();console.log('JA_APLICADO');return;}
    if(mode==='rollback'&&!applied)throw Error('Plano não aplicado');
    if(mode==='apply'&&audits.some(a=>a.status==='CONCLUIDO'&&!audits.some(u=>u.fingerprint===`rollback:${a.fingerprint}`)))throw Error('Outro plano aplicado');
    const guards=mode==='apply'?plan.before:plan.after;if(await check(guards,tx)!==guards.length)throw Error('Estado mudou; nenhuma escrita efetuada');
    if(mode==='rollback'){
      if((await rows(q('SELECT cardId,slaConfigId FROM BpmSlaInstancia WHERE tarefaId IS NULL GROUP BY cardId,slaConfigId HAVING count(*)>1'),tx)).length)throw Error('Ciclos históricos impedem restaurar unicidade antiga');
      const ids=plan.writes.filter(w=>w.sql.startsWith('INSERT INTO BpmSlaConfig ')).map(w=>w.args[0]);
      const all=await rows(q(`SELECT id FROM BpmSlaInstancia WHERE slaConfigId IN (${ids.map(()=>'?').join(',')})`,ids),tx);
      if(all.length!==plan.summary.instances)throw Error('Novos ciclos SLA impedem rollback automático');
      const logs=await rows(q(`SELECT l.id FROM BpmSlaEventoLog l JOIN BpmSlaInstancia i ON i.id=l.instanciaId WHERE i.slaConfigId IN (${ids.map(()=>'?').join(',')})`,ids),tx);
      if(logs.length!==plan.summary.instances)throw Error('Atividade posterior impede rollback automático');
    }
    await tx.batch(mode==='apply'?plan.writes:plan.undo);
    const now=new Date().toISOString();await tx.execute(insert('BpmImportacaoExterna',{id:mode==='apply'?auditId:undoId,provider,fingerprint:mode==='apply'?fingerprint:`rollback:${fingerprint}`,status:mode==='apply'?'CONCLUIDO':'REVERTIDO',resumoJson:JSON.stringify({plan:parsed,operation:mode}),iniciadoEm:now,concluidoEm:now}));await tx.commit();console.log(JSON.stringify({status:mode==='apply'?'CONCLUIDO':'REVERTIDO',...plan.summary}));
  }catch(error){await tx.rollback();throw error;}finally{tx.close();}
}
try{await(mode==='preview'?preview():execute());}finally{db.close();}
