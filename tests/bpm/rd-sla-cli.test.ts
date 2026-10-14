import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SLA_TARGETS } from '../../scripts/lib/rd-sla-import';
import { slaConfiguracaoAdminSchema, slaConfigIdSchema } from '@/lib/validations/bpm-sla';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (path:string) => { exec(sql:string):void; close():void; prepare(sql:string):{ all():Record<string,unknown>[] } } };
const dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const quote=(s:string)=>`'${s.replaceAll("'","''")}'`;
const cuid=(n:number)=>`c${String(n).padStart(24,'0')}`;
function fixture(extraSql = ''){
 const dir=mkdtempSync(join(tmpdir(),'rd-sla-qa-'));dirs.push(dir);
 const url=`file:${join(dir,'test.db')}`, sourcePath=join(dir,'source.json'), planPath=join(dir,'plan.json'), backup=join(dir,'backup.sql');
 // Public source identities only; the database, cards, histories and content are synthetic.
 const cli=readFileSync('scripts/importar-sla-rd-alpha.mts','utf8');
 const identities=JSON.parse(cli.match(/const sourceIdentities: Record<string, string> = (\{[^\n]+\});/)![1]) as Record<string,string>;
 const stages=[...new Map(Object.values(SLA_TARGETS).map(v=>[v.join('/'),v])).values()];
 const pipes=[...new Set(stages.map(s=>s[0]))];
 const stageId=(i:number)=>`draft-stage-00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
 let dump=`CREATE TABLE BpmPipeline(id TEXT PRIMARY KEY,nome TEXT,configVersion INTEGER,updatedAt TEXT);
 CREATE TABLE BpmEtapa(id TEXT PRIMARY KEY,pipelineId TEXT,nome TEXT,ativo INTEGER,ehFinal INTEGER);
 CREATE TABLE BpmCard(id TEXT PRIMARY KEY,pipelineId TEXT,etapaId TEXT,status TEXT,versao INTEGER,createdAt TEXT,concluidoEm TEXT);
 CREATE TABLE BpmCardEstado(cardId TEXT PRIMARY KEY,canceladoEm TEXT,arquivadoEm TEXT);
 CREATE TABLE BpmCardOrigemExterna(cardId TEXT,sourceStageId TEXT,sourceStageName TEXT,rawJson TEXT);
 CREATE TABLE BpmTransicaoExecucao(id TEXT PRIMARY KEY,cardId TEXT,etapaDestinoId TEXT,concluidoEm TEXT);
 CREATE TABLE BpmCardHistorico(id TEXT PRIMARY KEY,cardId TEXT,acao TEXT,valorNovoJson TEXT,createdAt TEXT);
 CREATE TABLE BpmImportacaoExterna(id TEXT PRIMARY KEY,provider TEXT,fingerprint TEXT,status TEXT,resumoJson TEXT,iniciadoEm TEXT,concluidoEm TEXT);
 CREATE TABLE usuarios(id INTEGER PRIMARY KEY); CREATE TABLE servicos_comerciais(id INTEGER PRIMARY KEY); CREATE TABLE BpmTarefa(id TEXT PRIMARY KEY);`;
 dump+=readFileSync('prisma/migrations/20260904182000_bpm_sla_contrato_definitivo/migration.sql','utf8').replace(/^DROP TABLE .*;$/gm,'');
 pipes.forEach((p,i)=>{dump+=`INSERT INTO BpmPipeline VALUES (${quote(cuid(i+1))},${quote(p)},4,'2026-01-01T00:00:00.000Z');`;});
 stages.forEach(([p,s],i)=>{dump+=`INSERT INTO BpmEtapa VALUES (${quote(stageId(i))},${quote(cuid(pipes.indexOf(p)+1))},${quote(s)},1,0); INSERT INTO BpmCard VALUES (${quote(cuid(i+20))},${quote(cuid(pipes.indexOf(p)+1))},${quote(stageId(i))},'ATIVO',1,'2025-01-01T12:00:00.000Z',NULL);`;});
 dump += extraSql;
 const db=new DatabaseSync(url.slice(5));db.exec(dump);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
 const totalRows=tables.reduce((n,t)=>n+Number(db.prepare(`SELECT count(*) n FROM ${t.name}`).all()[0].n),0);db.close();
 writeFileSync(sourcePath,JSON.stringify({stages:Object.entries(identities).map(([id,identity])=>{const [pipelineId,name]=identity.split(':');return {id,name,pipeline:'Funil sintético',deal_pipeline:{id:pipelineId},configuration:[{type:'deal_stopped',value:name==='Aguardando despacho'?12:1,format:'days',extra:{skip_days:[],work_time:{'00:00:00':'23:59:59'}}}]};})}));
 writeFileSync(backup,dump);writeFileSync(backup.replace('.sql','.manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),databaseHash:sha(url),sha256:sha(dump),sizeBytes:Buffer.byteLength(dump),tables:tables.length,totalRows}));
 const run=(mode:string,args:string[]=[])=>spawnSync(process.execPath,['--import','tsx','scripts/importar-sla-rd-alpha.mts',mode,`--source=${sourcePath}`,`--plan=${planPath}`,...args],{env:{...process.env,TURSO_DATABASE_URL:url,TURSO_AUTH_TOKEN:''},encoding:'utf8',timeout:15000});
 const query=(sql:string)=>{const db=new DatabaseSync(url.slice(5));try{return db.prepare(sql).all();}finally{db.close();}};
 const exec=(sql:string)=>{const db=new DatabaseSync(url.slice(5));try{db.exec(sql);}finally{db.close();}};
 const preview=run('preview');expect(preview.stderr+preview.stdout).not.toContain('Error:');expect(preview.status).toBe(0);
 const plan=JSON.parse(readFileSync(planPath,'utf8')) as {fingerprint:string;summary:Record<string,number>};
 return {run,query,exec,plan,backup,apply:()=>run('apply',[`--confirm=${plan.fingerprint}`,`--backup=${backup}`]),rollback:()=>run('rollback',[`--confirm=rollback:${plan.fingerprint}`,`--backup=${backup}`])};
}
describe('SLA importação SQLite real',()=>{
 it.each(['CARD_MOVIDO_POR_AUTOMACAO','MOVIDO_AUTOMACAO'])('usa entrada %s em vez da criação antiga do card',acao=>{
  const f=fixture(`INSERT INTO BpmCardHistorico SELECT 'auto',id,'${acao}',json_object('etapaId',etapaId),'2026-01-02T10:00:00.000Z' FROM BpmCard WHERE id='${cuid(20)}';`);
  expect(f.apply().status).toBe(0);
  expect(f.query(`SELECT inicioContagem FROM BpmSlaInstancia WHERE cardId='${cuid(20)}'`)[0].inicioContagem).toBe('2026-01-02T10:00:00.000Z');
 },15000);
 it('aplica regras globais, preserva entrada, IDs editáveis, idempotência e rollback auditável',()=>{
  const f=fixture();expect(f.plan.summary).toMatchObject({sourceRules:17,configs:10,activeConfigs:9,inactiveConfigs:1,pipelines:2,instances:9,overdue:9,excluded:1,exceptions:0});
  const applied=f.apply();expect(applied.stderr+applied.stdout).not.toContain('Error:');expect(applied.status).toBe(0);
  expect(f.query('SELECT * FROM BpmSlaConfig WHERE ativa=1')).toHaveLength(9);
  const inactive=f.query('SELECT c.ativa,e.nome FROM BpmSlaConfig c JOIN BpmEtapa e ON e.id=c.etapaId WHERE c.ativa=0');
  expect(inactive).toEqual([{ativa:0,nome:'Cliente cancelado'}]);
  for(const row of f.query('SELECT * FROM BpmSlaConfig')){
   expect(slaConfigIdSchema.safeParse(row).success).toBe(true);
   expect(slaConfiguracaoAdminSchema.safeParse({...row,escopo:'ETAPA',pausaRegra:'NUNCA',ativa:Boolean(row.ativa),amareloTipo:'PERCENTUAL_CONSUMIDO',amareloValor:80,amareloUnidade:null,vermelhoTipo:'PERCENTUAL_CONSUMIDO',vermelhoValor:100,vermelhoUnidade:null}).success).toBe(true);
   expect(row.suspendeAutomacaoAoVencer).toBe(0);
   expect(slaConfigIdSchema.safeParse({...row,id:'rdslaconfig_invalid'}).success).toBe(false);
   expect(slaConfiguracaoAdminSchema.safeParse({...row,etapaId:'draft-stage-invalid',escopo:'ETAPA',pausaRegra:'NUNCA',ativa:Boolean(row.ativa),amareloTipo:'PERCENTUAL_CONSUMIDO',amareloValor:80,amareloUnidade:null,vermelhoTipo:'PERCENTUAL_CONSUMIDO',vermelhoValor:100,vermelhoUnidade:null}).success).toBe(false);
  }
  for(const row of f.query('SELECT * FROM BpmSlaInstancia')){expect(z.string().cuid().safeParse(row.id).success).toBe(true);expect(row.inicioContagem).toBe('2025-01-01T12:00:00.000Z');expect(row.status).toBe('ATRASADO');}
  expect(f.query('PRAGMA foreign_key_check')).toHaveLength(0);expect(f.run('verify').status).toBe(0);expect(f.apply().stdout).toContain('JA_APLICADO');expect(f.query('SELECT * FROM BpmImportacaoExterna')).toHaveLength(1);
  expect(f.rollback().status).toBe(0);expect(f.rollback().stdout).toContain('JA_REVERTIDO');expect(f.apply().status).not.toBe(0);expect(f.run('verify').status).toBe(2);
  expect(f.query('SELECT * FROM BpmSlaConfig WHERE ativa=0')).toHaveLength(10);expect(f.query("SELECT * FROM BpmSlaInstancia WHERE status='CANCELADO'")).toHaveLength(9);expect(f.query('SELECT * FROM BpmSlaEventoLog')).toHaveLength(18);expect(f.query('SELECT * FROM BpmImportacaoExterna')).toHaveLength(2);expect(f.query('SELECT configVersion FROM BpmPipeline').every(p=>p.configVersion===6)).toBe(true);
 },20000);
 it('bloqueia falta de confirmação, backup adulterado e edição concorrente sem escrita parcial',()=>{
  const f=fixture();expect(f.run('apply',[`--backup=${f.backup}`]).status).not.toBe(0);
  f.exec("UPDATE BpmCard SET versao=2 WHERE id='"+cuid(20)+"'");expect(f.apply().stderr).toContain('Estado mudou');expect(f.query('SELECT * FROM BpmSlaConfig')).toHaveLength(0);
  writeFileSync(f.backup,'adulterado');expect(f.apply().stderr).toContain('divergentes');
 },15000);
 it('falha SQL na auditoria reverte configs, instâncias, logs e versões atomicamente',()=>{
  const f=fixture();f.exec("CREATE TRIGGER bloquear BEFORE INSERT ON BpmImportacaoExterna BEGIN SELECT RAISE(ABORT,'falha sintética'); END;");expect(f.apply().status).not.toBe(0);
  for(const table of ['BpmSlaConfig','BpmSlaInstancia','BpmSlaEventoLog','BpmImportacaoExterna'])expect(f.query(`SELECT * FROM ${table}`)).toHaveLength(0);
  expect(f.query('SELECT configVersion FROM BpmPipeline').every(p=>p.configVersion===4)).toBe(true);
 },15000);
 it.each(['edit','cycle','event'])('rollback protege atividade posterior %s',kind=>{
  const f=fixture();expect(f.apply().status).toBe(0);
  if(kind==='edit')f.exec("UPDATE BpmSlaConfig SET nome='Edição humana' WHERE id=(SELECT id FROM BpmSlaConfig LIMIT 1)");
  if(kind==='cycle')f.exec("INSERT INTO BpmSlaInstancia(id,cardId,slaConfigId,status,updatedAt) SELECT 'novo',(SELECT c.id FROM BpmCard c WHERE c.id NOT IN (SELECT cardId FROM BpmSlaInstancia WHERE slaConfigId=i.slaConfigId) LIMIT 1),slaConfigId,'DENTRO_PRAZO',updatedAt FROM BpmSlaInstancia i LIMIT 1");
  if(kind==='event')f.exec("INSERT INTO BpmSlaEventoLog(id,instanciaId,statusNovo) SELECT 'novo',id,'DENTRO_PRAZO' FROM BpmSlaInstancia LIMIT 1");
  expect(f.rollback().status).not.toBe(0);expect(f.query('SELECT * FROM BpmSlaConfig WHERE ativa=1')).toHaveLength(9);expect(f.query('SELECT * FROM BpmImportacaoExterna')).toHaveLength(1);
 },15000);
});
