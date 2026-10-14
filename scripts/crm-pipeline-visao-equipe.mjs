import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { verificarBackupTurso } from './lib/verificar-backup-turso.mjs';
config({path:'.env.local',quiet:true}); config({path:'.env',quiet:true});
const sql = 'ALTER TABLE "BpmPipeline" ADD COLUMN "visualizacaoConfigJson" TEXT';
const hash = (v) => createHash('sha256').update(v).digest('hex');
const fingerprint = hash(sql);
const option = (name) => process.argv.find((a)=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const mode = process.argv[2] ?? 'preview';
if (!['preview','apply','verify'].includes(mode)) throw Error('Modo inválido');
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw Error('Banco não configurado');
const db = createClient({url,authToken:process.env.TURSO_AUTH_TOKEN});
async function inspect(client) {
  const rows=(await client.execute('PRAGMA table_info("BpmPipeline")')).rows;
  if(!rows.some(r=>r.name==='configVersion')) throw Error('Tabela de pipeline incompatível');
  const col=rows.find(r=>r.name==='visualizacaoConfigJson');
  if(col && (String(col.type).toUpperCase()!=='TEXT' || Number(col.notnull)!==0 || col.dflt_value!==null || Number(col.pk)!==0)) throw Error('Definição divergente');
  return Boolean(col);
}
try {
  if(mode==='apply') {
    if(option('confirm')!==fingerprint) throw Error('Confirmação específica ausente');
    const backup=option('backup'); if(!backup)throw Error('Backup obrigatório');
    const manifestPath=backup.replace(/\.sql$/,'.manifest.json');
    const manifest=JSON.parse(await readFile(manifestPath,'utf8'));const age=Date.now()-Date.parse(manifest.generatedAt);
    if(manifest.databaseHash!==hash(url)||!Number.isFinite(age)||age<0||age>48*3600000)throw Error('Backup expirado ou de outro banco');
    await verificarBackupTurso(backup,manifestPath);
    const tx=await db.transaction('write');let result;
    try {
      const exists=await inspect(tx);const before=Number((await tx.execute('SELECT count(*) n FROM BpmPipeline')).rows[0].n);
      if(!exists)await tx.execute(sql);
      if(!await inspect(tx))throw Error('Coluna ausente');
      const after=Number((await tx.execute('SELECT count(*) n FROM BpmPipeline')).rows[0].n);if(before!==after)throw Error('Contagem divergente');
      await tx.commit();result={fingerprint,created:!exists,before,after,backup,finishedAt:new Date().toISOString()};
    }catch(e){try{await tx.rollback()}catch{}throw e}finally{tx.close()}
    const receipt=option('receipt')??'database-backups/pre-change/crm-pipeline-visao-equipe/receipt.json';
    await mkdir(path.dirname(path.resolve(receipt)),{recursive:true,mode:0o700});
    await writeFile(receipt,JSON.stringify(result,null,2),{mode:0o600});console.info(JSON.stringify(result));
  }else{const exists=await inspect(db);console.info(JSON.stringify({fingerprint,sql,exists}));if(mode==='verify'&&!exists)process.exitCode=1;}
}finally{db.close()}
