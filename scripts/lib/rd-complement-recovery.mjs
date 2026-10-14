import { createHash } from 'node:crypto';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
export const stableId = (prefix, ...parts) => `${prefix}_${hash(parts.join('\u001f')).slice(0,28)}`;
export const provider = 'RD_STATION_CRM_V1';
export const statement = (sql, args=[]) => ({sql,args});
// O backup Prisma normaliza DATETIME para ISO; comparar o instante, não sua codificação SQLite.
export const stateHash = rows => hash(rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>{
 if(['createdAt','updatedAt','prazo','concluidaEm','alertaEm','alertaDisparadoEm'].includes(key)&&value!==null){const d=typeof value==='number'?new Date(value):new Date(String(value).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/, '$1T$2Z'));if(Number.isFinite(d.getTime()))return[key,d.toISOString()];}
 return[key,value];
}))));
export const guard = (sql,args,rows) => ({...statement(sql,args),hash:stateHash(rows)});
const cleanRows = result => result.rows.map(row=>({...row}));

/** Plano confirmado: cada lote compara estado e auditoria antes de qualquer escrita. */
export async function applyRecoveryBatch(db, changes, fingerprint, rollback=false) {
 const tx=await db.transaction('write');
 let applied=0,skipped=0;
 try {
  const marks=await tx.batch(changes.map(c=>statement('SELECT id FROM BpmCardHistorico WHERE id IN (?,?)',[stableId('rdcomp',fingerprint,c.key),stableId('rdcompundo',fingerprint,c.key)])));
  const pending=changes.filter((c,i)=>{const reverted=marks[i].rows.some(r=>r.id===stableId('rdcompundo',fingerprint,c.key));if(reverted){if(!rollback)throw Error('Plano já revertido; gere uma nova prévia.');skipped++;return false;}const exists=marks[i].rows.length>0;if(rollback?!exists:exists){skipped++;return false;}return true;});
  const checks=pending.flatMap(c=>rollback?c.after:c.before);
  const read=checks.length?await tx.batch(checks.map(({sql,args})=>({sql,args}))):[];
  if(checks.some((check,i)=>check.hash!==stateHash(cleanRows(read[i]))))throw Error('Estado mudou desde a prévia; lote bloqueado sem sobrescrever alterações.');
  const allWrites=[];
  for(const change of pending){
   const writes=rollback?change.undo:change.writes;
   allWrites.push(...writes);
   const marker=stableId('rdcomp',fingerprint,change.key);
   if(rollback)allWrites.push(statement("INSERT INTO BpmCardHistorico (id,cardId,acao,valorNovoJson,automacaoOrigem,createdAt) VALUES (?,?,'RD_COMPLEMENTO_REVERTIDO',?,'RD_STATION_COMPLEMENT_ROLLBACK',CURRENT_TIMESTAMP)",[stableId('rdcompundo',fingerprint,change.key),change.cardId,JSON.stringify({descricao:change.label,plano:fingerprint})]));
   else allWrites.push(statement("INSERT INTO BpmCardHistorico (id,cardId,acao,valorNovoJson,automacaoOrigem,createdAt) VALUES (?,?,'RD_COMPLEMENTO_IMPORTADO',?,'RD_STATION_COMPLEMENT_RECOVERY',CURRENT_TIMESTAMP)",[marker,change.cardId,JSON.stringify({descricao:change.label,plano:fingerprint})]));
   applied++;
  }
  if(allWrites.length)await tx.batch(allWrites);
  await tx.commit();return{applied,skipped};
 }catch(error){try{await tx.rollback();}catch{}throw error;}finally{tx.close();}
}

export function projectTask(raw, userMap, userNames, readable=x=>String(x??'')) {
 const date=value=> typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
 if(!raw.id&&!raw._id)throw Error('Tarefa sem identidade');
 if(!date(raw.created_at)||!date(raw.date))throw Error('Tarefa sem data válida');
 if(typeof raw.done!=='boolean')throw Error('Estado da tarefa inválido');
 const ids=[...new Set(raw.user_ids??(raw.users??[]).map(u=>u.id??u._id))];
 const names=ids.map(id=>userNames.get(id)??'Responsável não identificado no RD');
 const types={call:'LIGACAO',email:'EMAIL',whatsapp:'WHATSAPP'};
 return {titulo:readable(raw.subject||'Tarefa importada do RD Station'),descricao:[readable(raw.notes||''),`Origem: RD Station${names.length?`\nResponsáveis na origem: ${names.map(readable).join(', ')}`:''}`,`Tipo na origem: ${{call:'Ligação',email:'E-mail',meeting:'Reunião',task:'Tarefa',lunch:'Almoço',visit:'Visita',whatsapp:'WhatsApp'}[raw.type]??'Tarefa'}`].filter(Boolean).join('\n\n'),responsavelId:ids.length===1?(userMap.get(ids[0])??null):null,prazo:date(raw.date),tipo:types[raw.type]??'TAREFA',prioridade:'NORMAL',status:raw.done?'CONCLUIDA':'PENDENTE',createdAt:date(raw.created_at),concluidaEm:raw.done?date(raw.done_date):null};
}
