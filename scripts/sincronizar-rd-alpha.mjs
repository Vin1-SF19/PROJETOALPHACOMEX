import { readFile, writeFile, mkdir, mkdtemp, chmod, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { hash, stateHash, applySyncChange, verifySyncChange } from './lib/rd-sync-engine.mjs';
import { criarPlanoRd, SMART_ID } from './lib/rd-sync-plan.mjs';
import { verificarBackupTurso } from './lib/verificar-backup-turso.mjs';

const DEFAULT_DIR = 'database-backups/pre-change/rd-fields-sync-2026-10-16';
const runtimeFiles=['./sincronizar-rd-alpha.mjs','./lib/rd-sync-plan.mjs','./lib/rd-sync-engine.mjs','./lib/rd-field-mapping.mjs'];
const runtimeHash=async()=>hash(await Promise.all(runtimeFiles.map(async file=>hash(await readFile(new URL(file,import.meta.url),'utf8')))));
const privateJson = async (file, value) => {
  await mkdir(path.dirname(file), { recursive:true, mode:0o700 });
  await writeFile(file,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});
  await chmod(file,0o600);
};
const readJson = async file => JSON.parse(await readFile(file,'utf8'));
const sleep = milliseconds => new Promise(resolve=>setTimeout(resolve,milliseconds));

/** A repeated page or a missing end marker must never become a completed collection. */
export async function coletarPaginasRd(request, endpoint, params = {}) {
  const rows=new Map(),seenCursors=new Set();let cursor=null;
  for(let page=1;page<=1000;page++){
    const data=await request(endpoint,{...params,limit:200,...(cursor?{next_page:cursor}:{page})});
    if(endpoint==='deals'&&(Array.isArray(data)||typeof data.has_more!=='boolean'))throw Error('RD_DEALS_END_MARKER_REQUIRED');
    const values=Array.isArray(data)?data:data[endpoint];
    if(!Array.isArray(values))throw Error('RD_PAGE_INVALID');
    if(values.length&&values.every(row=>rows.has(row.id??row._id)))throw Error('RD_PAGE_REPEATED');
    for(const row of values){const id=row.id??row._id;if(typeof id!=='string'||rows.has(id))throw Error('RD_ID_DUPLICATE');rows.set(id,row);}
    if(Array.isArray(data)||data.has_more===false||(!data.has_more&&values.length<200))return [...rows.values()];
    if(data.next_page){if(seenCursors.has(data.next_page))throw Error('RD_CURSOR_REPEATED');seenCursors.add(data.next_page);cursor=data.next_page;}
    else if(values.length===0)throw Error('RD_EMPTY_PAGE_WITH_MORE');
  }
  throw Error('RD_PAGE_LIMIT');
}

function requestRd(token){
  if(!token)throw Error('RD_TOKEN_MISSING');
  return async(endpoint,params={})=>{
    for(let attempt=0;attempt<5;attempt++){
      const url=new URL(`https://crm.rdstation.com/api/v1/${endpoint}`);url.searchParams.set('token',token);
      for(const[key,value]of Object.entries(params))url.searchParams.set(key,String(value));
      try{
        const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(25000)});
        if(response.ok)return await response.json();
        if(response.status!==429&&response.status<500)throw Error(`RD_HTTP_${response.status}`);
      }catch(error){if(error instanceof Error&&/^RD_HTTP_/.test(error.message))throw error;}
      await sleep(Math.min(10000,1500*(attempt+1)));
    }
    throw Error('RD_RETRIES_EXHAUSTED');
  };
}

async function collect(options){
  const directory=options.dir??DEFAULT_DIR,request=requestRd(process.env.RD_STATION_CRM_V1_TOKEN);
  let deals,pipelines,stages,users,inventoryGeneratedAt=new Date().toISOString();
  if(options['reuse-source']){
    const cached=await readJson(path.join(directory,'source-all.json'));
    if(cached.total!==cached.deals.length||!cached.pages?.length||cached.pages.at(-1).has_more!==false)throw Error('RD_REUSED_SOURCE_INCOMPLETE');
    if(Date.now()-Date.parse(cached.generatedAt)>3600000)throw Error('RD_REUSED_SOURCE_EXPIRED');
    deals=cached.deals;inventoryGeneratedAt=cached.generatedAt;pipelines=await readJson(path.join(directory,'pipelines.json'));stages=await readJson(path.join(directory,'stages.json'));users=await readJson(path.join(directory,'rd-users.json'));
  }else{
    deals=await coletarPaginasRd(request,'deals');
    const rawPipelines=await request('deal_pipelines');pipelines=Array.isArray(rawPipelines)?rawPipelines:rawPipelines.deal_pipelines;
    if(!Array.isArray(pipelines))throw Error('RD_PIPELINES_INVALID');
    stages=[];
    for(const pipeline of pipelines){
      const pipelineId=pipeline.id??pipeline._id;
      const values=await coletarPaginasRd(request,'deal_stages',{deal_pipeline_id:pipelineId});
      stages.push({pipelineId,pipelineName:pipeline.name,stages:values});
    }
    users=await request('users',{limit:200});
  }
  const rawFields=await request('custom_fields');const customFields=Array.isArray(rawFields)?rawFields:rawFields.custom_fields;
  if(!Array.isArray(customFields))throw Error('RD_FIELDS_INVALID');
  const scope=await readJson(options.scope??path.join(directory,'scope.json'));
  const eligibleIds=new Set(scope.newDeals.filter(deal=>deal.alphaPipelineId||deal.sourcePipelineId===SMART_ID).map(deal=>deal.id));
  const existingDetails=options['resume-details']?await readJson(path.join(directory,'details.json')):{};
  const details={...existingDetails};
  for(const deal of deals){
    const id=deal.id??deal._id;if(!eligibleIds.has(id)||details[id]?.complete)continue;
    const detail=await request(`deals/${encodeURIComponent(id)}`);
    const activities=await coletarPaginasRd(request,'activities',{deal_id:id});
    details[id]={complete:true,collectedAt:new Date().toISOString(),detail,activities};
    await privateJson(path.join(directory,'details.json'),details);
    console.info(JSON.stringify({readOnly:true,detailedNewDeals:Object.keys(details).length,required:eligibleIds.size}));
  }
  const source={complete:true,generatedAt:new Date().toISOString(),inventoryGeneratedAt,deals,pipelines,stages,users,customFields};
  await privateJson(path.join(directory,'source.json'),source);
  await privateJson(path.join(directory,'details.json'),details);
  console.info(JSON.stringify({mode:'collect',complete:true,deals:deals.length,details:Object.keys(details).length,directory}));
}

async function validBackup(file, databaseHash){
  if(!file||!path.resolve(file).includes('/database-backups/pre-change/'))throw Error('PRE_CHANGE_BACKUP_REQUIRED');
  const manifestPath=file.replace(/\.sql$/,'.manifest.json'),manifest=await readJson(manifestPath),age=Date.now()-Date.parse(manifest.generatedAt);
  if(!Number.isFinite(age)||age<0||age>48*3600000||manifest.databaseHash!==databaseHash)throw Error('BACKUP_EXPIRED_OR_WRONG_DATABASE');
  const evidence=await verificarBackupTurso(file,manifestPath);
  return {...evidence,manifestPath,generatedAt:manifest.generatedAt};
}

async function restoredClient(backup,directory){
  await mkdir(directory,{recursive:true,mode:0o700});
  const temp=await mkdtemp(path.join(path.resolve(directory),'simulation-')),file=path.join(temp,'restore.db');
  const sqlite=new DatabaseSync(file);try{sqlite.exec(await readFile(backup,'utf8'));}catch(error){sqlite.close();throw error;}
  await chmod(file,0o600);
  // The same SQL/guard engine runs against real SQLite, without network-adapter
  // overhead for tens of thousands of statements in the private simulation.
  sqlite.exec('PRAGMA foreign_keys=ON');
  const prepared=new Map();
  const execute=async query=>{
    const sql=typeof query==='string'?query:query.sql,args=typeof query==='string'?[]:query.args??[];
    let cached=prepared.get(sql);
    if(!cached){const statement=sqlite.prepare(sql);cached={statement,returnsRows:statement.columns().length>0};prepared.set(sql,cached);}
    const values=args.map(value=>typeof value==='boolean'?Number(value):value);
    if(cached.returnsRows)return{rows:cached.statement.all(...values).map(row=>({...row}))};
    const result=cached.statement.run(...values);return{rows:[],rowsAffected:Number(result.changes)};
  };
  const insideBatch=async queries=>{const results=[];for(const query of queries)results.push(await execute(query));return results;};
  const db={execute,batch:async queries=>{sqlite.exec('BEGIN IMMEDIATE');try{const results=await insideBatch(queries);sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}},transaction:async mode=>{
    sqlite.exec(mode==='write'?'BEGIN IMMEDIATE':'BEGIN');let done=false;
    return{execute,batch:insideBatch,commit:async()=>{sqlite.exec('COMMIT');done=true;},rollback:async()=>{if(!done){sqlite.exec('ROLLBACK');done=true;}},close:()=>{if(!done){sqlite.exec('ROLLBACK');done=true;}}};
  }};
  return{db,close:async()=>{prepared.clear();sqlite.close();await rm(temp,{recursive:true,force:true});}};
}

async function preview(options){
  const directory=options.dir??DEFAULT_DIR,databaseHash=hash(process.env.TURSO_DATABASE_URL??'');
  const backupEvidence=await validBackup(options.backup,databaseHash);
  const sourceFile=options.source??path.join(directory,'source.json'),scopeFile=options.scope??path.join(directory,'scope.json'),detailsFile=options.details??path.join(directory,'details.json');
  const[source,scope,details]=await Promise.all([readJson(sourceFile),readJson(scopeFile),readJson(detailsFile)]);
  const sourceHashes={source:hash(source),scope:hash(scope),details:hash(details)};
  const restored=await restoredClient(options.backup,directory);
  try{
    const plan=await criarPlanoRd(restored.db,{source,scope,details,databaseHash,sourceHashes,smartOwnerId:34,smartSectorId:4});
    plan.runtimeHash=await runtimeHash();
    plan.backup={file:path.resolve(options.backup),...backupEvidence};
    plan.scopeNotes=['Smart: etapas e formulários próprios, acesso OPERACIONAL (4), responsável Wivian (34) por e-mail exato.','Smart: sem transições/automação inferidas; movimentação depende de configuração posterior.','Demais cinco funis RD fora da carga atual por decisão do usuário.','Rollback arquiva novos cards e desativa Smart; conserva identidades e proveniência com auditoria.'];
    const fingerprint=hash(plan),result={...plan,fingerprint};
    await privateJson(options.plan??path.join(directory,'plan.json'),result);
    console.info(JSON.stringify({mode:'preview',fingerprint,summary:plan.summary,backup:backupEvidence,scopeNotes:plan.scopeNotes}));
  }finally{await restored.close();}
}

async function loadPlan(options){
  const file=options.plan??path.join(options.dir??DEFAULT_DIR,'plan.json');const{fingerprint,...plan}=await readJson(file);
  if(hash(plan)!==fingerprint||plan.databaseHash!==hash(process.env.TURSO_DATABASE_URL??''))throw Error('PLAN_HASH_OR_DATABASE_INVALID');
  if(plan.runtimeHash!==await runtimeHash())throw Error('RUNTIME_CHANGED_REGENERATE_PLAN_AND_SIMULATION');
  return{plan,fingerprint};
}

async function integrity(db){
  const check=(await db.execute('PRAGMA integrity_check')).rows[0];const fk=(await db.execute('PRAGMA foreign_key_check')).rows;
  if(check.integrity_check!=='ok'||fk.length)throw Error('INTEGRITY_FAILED');
  return{integrity:'ok',foreignKeyViolations:0};
}

async function runChanges(db,changes,fingerprint,rollback=false){
  let applied=0,skipped=0;
  for(const[index,change]of(rollback?[...changes].reverse():changes).entries()){
    const result=await applySyncChange(db,change,fingerprint,{rollback});applied+=result.applied;skipped+=result.skipped;
    if((index+1)%100===0)console.info(JSON.stringify({phase:rollback?'rollback':'apply',processed:index+1,total:changes.length,applied,skipped}));
  }
  return{applied,skipped};
}

async function verify(db,plan,fingerprint){
  let applied=0,rolledBack=0,matching=0;
  for(const change of plan.changes){const result=await verifySyncChange(db,change,fingerprint);if(result.applied)applied++;if(result.rolledBack)rolledBack++;if(result.stateMatches)matching++;}
  return{planned:plan.changes.length,applied,rolledBack,matching,differing:plan.changes.length-matching};
}

async function simulate(options){
  const{plan,fingerprint}=await loadPlan(options);await validBackup(options.backup??plan.backup.file,plan.databaseHash);
  const restored=await restoredClient(options.backup??plan.backup.file,options.dir??DEFAULT_DIR);
  try{
    const first=await runChanges(restored.db,plan.changes,fingerprint),verified=await verify(restored.db,plan,fingerprint);
    if(verified.differing||verified.applied!==plan.changes.length)throw Error('SIMULATION_VERIFY_FAILED');
    const retry=await runChanges(restored.db,plan.changes,fingerprint);
    if(retry.applied!==0||retry.skipped!==plan.changes.length)throw Error('SIMULATION_RETRY_FAILED');
    const afterApply=await integrity(restored.db),rollback=await runChanges(restored.db,plan.changes,fingerprint,true),afterRollback=await verify(restored.db,plan,fingerprint);
    if(afterRollback.differing||afterRollback.rolledBack!==plan.changes.length){
      const mismatches=[];
      for(const change of plan.changes)for(const check of change.rollbackAfter??change.before){const rows=(await restored.db.execute(check)).rows;if(stateHash(rows)!==check.hash)mismatches.push({key:change.key,check,actualRows:rows});}
      await privateJson(path.join(options.dir??DEFAULT_DIR,'simulation-failure-private.json'),{fingerprint,afterRollback,mismatches});
      throw Error('SIMULATION_ROLLBACK_FAILED');
    }
    const report={verified:true,fingerprint,generatedAt:new Date().toISOString(),first,verifiedState:verified,retry,afterApply,rollback,afterRollback,integrity:await integrity(restored.db)};
    await privateJson(path.join(options.dir??DEFAULT_DIR,'simulation.json'),report);console.info(JSON.stringify(report));
  }finally{await restored.close();}
}

async function execute(mode,options){
  const{plan,fingerprint}=await loadPlan(options);
  if(mode!=='verify'){
    if(options.confirm!==(mode==='rollback'?`rollback:${fingerprint}`:fingerprint))throw Error('SPECIFIC_CONFIRMATION_REQUIRED');
    await validBackup(options.backup,plan.databaseHash);
    const simulation=await readJson(path.join(options.dir??DEFAULT_DIR,'simulation.json'));
    if(!simulation.verified||simulation.fingerprint!==fingerprint)throw Error('SUCCESSFUL_SIMULATION_REQUIRED');
  }
  const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
  try{
    const result=mode==='verify'?await verify(db,plan,fingerprint):await runChanges(db,plan.changes,fingerprint,mode==='rollback');
    await privateJson(path.join(options.dir??DEFAULT_DIR,`${mode}-result.json`),{mode,fingerprint,generatedAt:new Date().toISOString(),result});
    console.info(JSON.stringify({mode,fingerprint,result}));
    if(mode==='verify'&&result.differing)process.exitCode=1;
  }finally{db.close();}
}

export async function main(args=process.argv.slice(2)){
  config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
  const[mode='preview',...rest]=args,options=Object.fromEntries(rest.map(arg=>{const match=/^--([^=]+)(?:=(.*))?$/.exec(arg);if(!match)throw Error('INVALID_ARGUMENT');return[match[1],match[2]??true];}));
  if(mode==='collect')await collect(options);
  else if(mode==='preview')await preview(options);
  else if(mode==='simulate')await simulate(options);
  else if(['apply','verify','rollback'].includes(mode))await execute(mode,options);
  else throw Error('INVALID_MODE');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(async error=>{await privateJson(path.join(DEFAULT_DIR,'last-error.json'),{message:error?.message,stack:error?.stack});console.error(JSON.stringify({failed:true,error:typeof error?.message==='string'&&/^[A-Z_\d]+$/.test(error.message)?error.message:'Operation failed; inspect private last-error.json.',type:error?.name??'Error'}));process.exitCode=1;});
}
