import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {config} from 'dotenv';
import {createClient} from '@libsql/client';
import {hash,stateHash,stableId,provider,statement as q,guard,applyRecoveryBatch,projectTask} from './lib/rd-complement-recovery.mjs';
import {textoLegivelRd} from '../src/lib/bpm/rd-station-text.ts';
import {verificarBackupTurso} from './lib/verificar-backup-turso.mjs';
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
const mode=process.argv[2]??'preview';const opt=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
if(!['preview','apply','verify','rollback'].includes(mode))throw Error('Modo inválido');
const dir='database-backups/pre-change/rd-activities-recovery',planPath=opt('plan')??`${dir}/plan.json`;
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const rows=async(sql,args=[],client=db)=>(await client.execute(q(sql,args))).rows.map(r=>({...r}));
const mapping=JSON.parse(await readFile(opt('mapping')??`${dir}/confirmed-users.json`,'utf8'));
const taskColumns=['id','cardId','titulo','descricao','responsavelId','prazo','tipo','prioridade','status','createdAt','updatedAt','concluidaEm','alertaEm','alertaDisparadoEm','checklistJson','presetId','cardChecklistId','cadenciaExecucaoId'];
const eventColumns=['id','origemId','sourceKey','sourceEventId','eventType','occurredAt','rawJson','projectedJson','createdAt','updatedAt'];
const selectTask='SELECT '+taskColumns.join(',')+' FROM BpmTarefa WHERE id=?';
const selectEvent='SELECT '+eventColumns.join(',')+' FROM BpmEventoExternoCard WHERE id=?';
const selectOrigin='SELECT id,cardId,provider,sourceDealId,sourceOwnerId,sourcePipelineId,rawJson FROM BpmCardOrigemExterna WHERE id=?';
const insertion=(table,columns,data)=>q(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,columns.map(c=>data[c]??null));
async function preview(){
 const source=JSON.parse(await readFile(opt('source')??`${dir}/source.json`,'utf8'));
 if(!Array.isArray(source.tasks)||!Array.isArray(source.activities))throw Error('Coleta incompleta');
 const currentOwners=JSON.parse(await readFile(`${dir}/current-owners.json`,'utf8'));
 if(!Array.isArray(mapping)||new Set(mapping.map(m=>m.rd)).size!==mapping.length||mapping.some(m=>typeof m.rd!=='string'||!Number.isInteger(m.alpha)||m.alpha<1||typeof m.name!=='string'))throw Error('De/para inválido');
 const origins=await rows('SELECT o.*,c.responsavelId,c.pipelineId,c.etapaId,c.updatedAt cardUpdatedAt,p.nome pipelineNome FROM BpmCardOrigemExterna o JOIN BpmCard c ON c.id=o.cardId JOIN BpmPipeline p ON p.id=c.pipelineId WHERE o.provider=?',[provider]);
 const users=await rows('SELECT id,nome,email,role,status FROM usuarios');
 const sourceUsers=Array.isArray(source.users)?source.users:source.users.users;
 const userNames=new Map(sourceUsers.map(u=>[String(u.id??u._id),u.name]));
 const userMap=new Map();
 for(const sourceUser of sourceUsers){const email=String(sourceUser.email??'').trim().toLowerCase();const matches=users.filter(u=>email&&String(u.email??'').trim().toLowerCase()===email);if(matches.length===1)userMap.set(String(sourceUser.id??sourceUser._id),Number(matches[0].id));}
 for(const match of mapping){if(!users.some(u=>Number(u.id)===match.alpha&&u.nome===match.name&&u.status==='ATIVO')||!userNames.has(match.rd))throw Error('Identidade confirmada não confere');userMap.set(match.rd,match.alpha);}
 const allEvents=await rows('SELECT * FROM BpmEventoExternoCard');const eventByKey=new Map(allEvents.map(e=>[`${e.origemId}:${e.sourceKey}`,e]));
 const corrections=await rows('SELECT id,eventoId,versao,camposAlteradosJson,autorId FROM BpmEventoExternoCorrecao ORDER BY versao');
 const tasksExisting=new Set((await rows('SELECT id FROM BpmTarefa')).map(t=>t.id));
 const members=await rows('SELECT id,cardId,userId,role,createdAt FROM BpmCardMembro ORDER BY id');
 const plannedAt=new Date().toISOString();
 const changes=[],exceptions=[];const originByDeal=new Map(origins.map(o=>[o.sourceDealId,o]));
 const originGuard=o=>guard(selectOrigin,[o.id],[{id:o.id,cardId:o.cardId,provider:o.provider,sourceDealId:o.sourceDealId,sourceOwnerId:o.sourceOwnerId,sourcePipelineId:o.sourcePipelineId,rawJson:o.rawJson}]);
 const addEvent=(o,sourceKey,raw,projection,eventType,date)=>{const id=stableId('rdevent',o.id,sourceKey);const data={id,origemId:o.id,sourceKey,sourceEventId:String(raw.id??raw._id),eventType,occurredAt:date,rawJson:JSON.stringify(raw),projectedJson:JSON.stringify(projection),createdAt:plannedAt,updatedAt:plannedAt};return{id,data,insert:insertion('BpmEventoExternoCard',eventColumns,data)};};
 for(const raw of source.activities){const o=originByDeal.get(raw.deal_id);if(!o)continue;const key=`activity:${raw.id??raw._id}`;const existing=eventByKey.get(`${o.id}:${key}`);const author=userNames.get(String(raw.user_id))??null;
  if(existing){
   const previous=JSON.parse(existing.projectedJson);const next={...previous,type:'ANOTACAO',authorName:author};
   const protectedFields=new Set(corrections.filter(c=>c.eventoId===existing.id && (c.autorId!==null || (!c.id.startsWith('rdnote_') && !c.id.startsWith('rdnoteundo_')))).flatMap(c=>Object.keys(JSON.parse(c.camposAlteradosJson))));
   for(const field of protectedFields)if(field in previous)next[field]=previous[field];
   if(JSON.stringify(next)===existing.projectedJson)continue;
   const before=Object.fromEntries(eventColumns.map(k=>[k,existing[k]]));const after={...before,projectedJson:JSON.stringify(next),updatedAt:plannedAt};
   const version=Math.max(0,...corrections.filter(c=>c.eventoId===existing.id).map(c=>Number(c.versao)))+1;
   const correctionId=stableId('rdnote',existing.id,String(version),hash(after.projectedJson));
   const corrSql='SELECT id FROM BpmEventoExternoCorrecao WHERE eventoId=? ORDER BY id';const corrRows=corrections.filter(c=>c.eventoId===existing.id).map(c=>({id:c.id})).sort((a,b)=>a.id.localeCompare(b.id));
   changes.push({key:`note:${existing.id}`,kind:'note',cardId:o.cardId,label:'Anotação do RD Station identificada com autoria',before:[originGuard(o),guard(selectEvent,[existing.id],[before]),guard(corrSql,[existing.id],corrRows)],after:[guard(selectEvent,[existing.id],[after]),guard(corrSql,[existing.id],[...corrRows,{id:correctionId}].sort((a,b)=>a.id.localeCompare(b.id)))],writes:[q('UPDATE BpmEventoExternoCard SET projectedJson=?,updatedAt=? WHERE id=?',[after.projectedJson,plannedAt,existing.id]),q('INSERT INTO BpmEventoExternoCorrecao (id,eventoId,versao,camposAlteradosJson,projecaoAnteriorJson,projecaoNovaJson,autorId) VALUES (?,?,?,?,?,?,NULL)',[correctionId,existing.id,version,JSON.stringify(Object.fromEntries(Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(previous[k])).map(k=>[k,true]))),existing.projectedJson,after.projectedJson])],undo:[q('UPDATE BpmEventoExternoCard SET projectedJson=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?',[existing.projectedJson,existing.id]),q('INSERT INTO BpmEventoExternoCorrecao (id,eventoId,versao,camposAlteradosJson,projecaoAnteriorJson,projecaoNovaJson,autorId) VALUES (?,?,?,?,?,?,NULL)',[stableId('rdnoteundo',correctionId),existing.id,version+1,JSON.stringify(Object.fromEntries(Object.keys(next).filter(k=>JSON.stringify(next[k])!==JSON.stringify(previous[k])).map(k=>[k,true]))),after.projectedJson,existing.projectedJson])]});
  }else{const e=addEvent(o,key,raw,{title:'Anotação',content:raw.text??'',date:raw.date??null,type:'ANOTACAO',authorName:author},'ACTIVITY_NOTE',raw.date??null);changes.push({key:`note:${e.id}`,kind:'newNote',cardId:o.cardId,label:'Anotação do RD Station recuperada',before:[originGuard(o),guard(selectEvent,[e.id],[])],after:[guard(selectEvent,[e.id],[e.data]),guard('SELECT id FROM BpmEventoExternoCorrecao WHERE eventoId=? ORDER BY id',[e.id],[])],writes:[e.insert],undo:[q('DELETE FROM BpmEventoExternoCard WHERE id=?',[e.id])]});}
 }
 for(const raw of source.tasks){const o=originByDeal.get(raw.deal_id??raw.deal?.id??raw.deal?._id);if(!o)continue;const id=stableId('rdtask',provider,String(raw.id??raw._id));if(tasksExisting.has(id))continue;
  let task;try{task=projectTask(raw,userMap,userNames,textoLegivelRd);}catch{exceptions.push({kind:'task',sourceId:raw.id,reason:'Datas ou estado inválidos'});continue;}
  const data={id,cardId:o.cardId,...task,updatedAt:task.createdAt,alertaEm:null,alertaDisparadoEm:null,checklistJson:null,presetId:null,cardChecklistId:null,cadenciaExecucaoId:null};const e=addEvent(o,`task:${raw.id??raw._id}`,raw,{title:task.titulo,content:task.descricao,date:raw.created_at,type:'TAREFA',status:task.status,dueDate:task.prazo,completedAt:task.concluidaEm,authorName:(raw.user_ids??[]).map(u=>userNames.get(u)).filter(Boolean).join(', ')},'TASK_RD',raw.created_at);
  if(eventByKey.has(`${o.id}:task:${raw.id??raw._id}`)){exceptions.push({kind:'task',sourceId:raw.id,reason:'Proveniência existente sem tarefa'});continue;}
  changes.push({key:`task:${id}`,kind:'task',cardId:o.cardId,label:'Tarefa do RD Station importada',before:[originGuard(o),guard(selectTask,[id],[]),guard(selectEvent,[e.id],[])],after:[guard('SELECT id FROM BpmSlaInstancia WHERE tarefaId=? ORDER BY id',[id],[]),guard(selectTask,[id],[data]),guard(selectEvent,[e.id],[e.data]),guard('SELECT id FROM BpmEventoExternoCorrecao WHERE eventoId=? ORDER BY id',[e.id],[])],writes:[insertion('BpmTarefa',taskColumns,data),e.insert],undo:[q('DELETE FROM BpmTarefa WHERE id=?',[id]),q('DELETE FROM BpmEventoExternoCard WHERE id=?',[e.id])]});
 }
 for(const o of origins){if(o.pipelineNome!=='Revisão de Radar')continue;const match=mapping.find(m=>m.rd===o.sourceOwnerId);if(!match)continue;if(currentOwners[o.sourceDealId]!==o.sourceOwnerId)throw Error('Responsável atual do RD não confirmado');if(Number(o.responsavelId)===match.alpha)continue;
  const oldId=stableId('rdmember',o.cardId,8);const currentMembers=members.filter(m=>m.cardId===o.cardId);const old=currentMembers.find(m=>m.id===oldId&&Number(m.userId)===8&&m.role==='RESPONSAVEL');
  if(Number(o.responsavelId)!==8||!old||currentMembers.some(m=>Number(m.userId)===match.alpha)){exceptions.push({kind:'owner',cardId:o.cardId,reason:'Vínculo atual diverge do fallback original'});continue;}
  const cardSql='SELECT id,responsavelId,pipelineId,etapaId,updatedAt FROM BpmCard WHERE id=?';const memberSql='SELECT id,cardId,userId,role,createdAt FROM BpmCardMembro WHERE cardId=? ORDER BY id';
  const before={id:o.cardId,responsavelId:o.responsavelId,pipelineId:o.pipelineId,etapaId:o.etapaId,updatedAt:o.cardUpdatedAt};const after={...before,responsavelId:match.alpha,updatedAt:plannedAt};
  const newMember={...old,id:stableId('rdmember',o.cardId,match.alpha),userId:match.alpha};const afterMembers=currentMembers.filter(m=>m.id!==old.id).concat(newMember).sort((a,b)=>a.id.localeCompare(b.id));
  changes.push({key:`owner:${o.cardId}`,kind:'owner',cardId:o.cardId,label:`Responsável corrigido conforme RD Station: ${match.name}`,before:[originGuard(o),guard(cardSql,[o.cardId],[before]),guard(memberSql,[o.cardId],currentMembers)],after:[guard(cardSql,[o.cardId],[after]),guard(memberSql,[o.cardId],afterMembers)],writes:[q('UPDATE BpmCard SET responsavelId=?,updatedAt=? WHERE id=?',[match.alpha,plannedAt,o.cardId]),q('DELETE FROM BpmCardMembro WHERE id=? AND cardId=? AND userId=8',[old.id,o.cardId]),insertion('BpmCardMembro',['id','cardId','userId','role','createdAt'],newMember)],undo:[q('UPDATE BpmCard SET responsavelId=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?',[8,o.cardId]),q('DELETE FROM BpmCardMembro WHERE id=?',[newMember.id]),insertion('BpmCardMembro',['id','cardId','userId','role','createdAt'],old)]});
 }
 const identityIds=[...new Set(userMap.values())];
 for(const change of changes){for(const uid of identityIds){const u=users.find(u=>Number(u.id)===uid);change.before.push(guard('SELECT id,nome,email,role,status FROM usuarios WHERE id=?',[uid],[u]));}}
 const unresolvedOwners=origins.filter(o=>o.pipelineNome==='Revisão de Radar'&&Number(o.responsavelId)===8&&!mapping.some(m=>m.rd===o.sourceOwnerId)).length;
 const summary={unresolvedOwners,tasks:changes.filter(c=>c.kind==='task').length,notes:changes.filter(c=>c.kind==='note').length,newNotes:changes.filter(c=>c.kind==='newNote').length,owners:changes.filter(c=>c.kind==='owner').length,exceptions:exceptions.length,pending:source.tasks.filter(t=>!t.done).length,done:source.tasks.filter(t=>t.done).length,multipleAssignees:source.tasks.filter(t=>t.user_ids?.length>1).length};
 const plan={version:1,databaseHash:hash(process.env.TURSO_DATABASE_URL),generatedAt:new Date().toISOString(),sourceHash:hash(source),currentOwnersHash:hash(currentOwners),confirmedMapping:mapping,summary,exceptions,changes};const fingerprint=hash(plan);await mkdir(dir,{recursive:true,mode:0o700});await writeFile(planPath,JSON.stringify({...plan,fingerprint}),{mode:0o600});console.log(JSON.stringify({planPath,fingerprint,summary}));
}
async function execute(){const {fingerprint,...plan}=JSON.parse(await readFile(planPath,'utf8'));if(hash(plan)!==fingerprint||plan.databaseHash!==hash(process.env.TURSO_DATABASE_URL))throw Error('Plano inválido');
 if(mode==='verify'){const markers=await rows("SELECT id FROM BpmCardHistorico WHERE automacaoOrigem='RD_STATION_COMPLEMENT_RECOVERY'");const set=new Set(markers.map(m=>m.id));const checks=plan.changes.flatMap(c=>c.after);let matching=0;for(let i=0;i<checks.length;i+=100){const part=checks.slice(i,i+100);const results=await db.batch(part.map(({sql,args})=>({sql,args})),'read');matching+=part.filter((g,j)=>g.hash===stateHash(results[j].rows.map(r=>({...r})))).length;}console.log(JSON.stringify({fingerprint,planned:plan.changes.length,applied:plan.changes.filter(c=>set.has(stableId('rdcomp',fingerprint,c.key))).length,checks:checks.length,matching,differing:checks.length-matching}));return;}
 if(opt('confirm')!==(mode==='rollback'?`rollback:${fingerprint}`:fingerprint))throw Error('Confirmação específica ausente');const backup=opt('backup');if(!backup)throw Error('Backup obrigatório');const manifestPath=backup.replace(/\.sql$/,'.manifest.json');const manifest=JSON.parse(await readFile(manifestPath,'utf8'));const age=Date.now()-Date.parse(manifest.generatedAt);if(manifest.databaseHash!==plan.databaseHash||!Number.isFinite(age)||age<0||age>48*3600000)throw Error('Backup inválido');await verificarBackupTurso(backup,manifestPath);
 let applied=0,skipped=0;const changes=mode==='rollback'?[...plan.changes].reverse():plan.changes;for(let i=0;i<changes.length;i+=20){const r=await applyRecoveryBatch(db,changes.slice(i,i+20),fingerprint,mode==='rollback');applied+=r.applied;skipped+=r.skipped;if(i%100===0)console.log(JSON.stringify({applied,skipped,total:changes.length}));}console.log(JSON.stringify({fingerprint,applied,skipped,completed:true}));
}
try{await(mode==='preview'?preview():execute());}finally{db.close();}
