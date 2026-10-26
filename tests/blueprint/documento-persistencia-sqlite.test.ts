import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { persistirDocumentoBlueprint } from '@/lib/blueprint/documento-persistencia';
import { repetirTransacaoOcupada } from '@/lib/bpm/sqlite-busy-retry';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {DatabaseSync:new(path:string)=>{exec(sql:string):void;close():void}};
let directory: string;
let db: PrismaClient;
const projectId='c000000000000000000000001';
const creationKey='00000000-0000-4000-8000-000000000001';
const input={projectId,creationKey,title:'Especificação',contentJson:'{"type":"doc"}',contentText:'Primeiro texto'};
beforeEach(()=>{
  directory=mkdtempSync(join(tmpdir(),'blueprint-documento-'));
  const file=join(directory,'test.db');const sqlite=new DatabaseSync(file);
  sqlite.exec(`CREATE TABLE BlueprintDocument(id TEXT PRIMARY KEY,projectId TEXT NOT NULL,title TEXT NOT NULL,contentJson TEXT NOT NULL,contentText TEXT,"order" INTEGER NOT NULL DEFAULT 0,createdById INTEGER NOT NULL,updatedById INTEGER,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE BlueprintActivity(id TEXT PRIMARY KEY,projectId TEXT NOT NULL,userId INTEGER NOT NULL,action TEXT NOT NULL,entityType TEXT NOT NULL,entityId TEXT,previousValueJson TEXT,newValueJson TEXT,metadataJson TEXT,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  sqlite.close();db=new PrismaClient({adapter:new PrismaLibSQL({url:`file:${file}`})});
});
afterEach(async()=>{await db.$disconnect();rmSync(directory,{recursive:true,force:true});});
const save=(data:Parameters<typeof persistirDocumentoBlueprint>[1])=>repetirTransacaoOcupada(()=>db.$transaction(tx=>persistirDocumentoBlueprint(tx,data,1)));

it('retentativa de criação tem a mesma identidade e não duplica documento ou histórico',async()=>{
  const first=await save(input);expect(first.success).toBe(true);
  const again=await save(input);expect(again.success).toBe(true);expect(again.data.id).toBe(first.data.id);
  expect(await db.blueprintDocument.count()).toBe(1);expect(await db.blueprintActivity.count()).toBe(1);
  const altered=await save({...input,contentText:'Outra revisão sem base confirmada'});
  expect(altered.success).toBe(false);expect(await db.blueprintDocument.count()).toBe(1);
});
it('compare-and-swap recusa versão antiga e o timestamp avança mesmo se o relógio estiver atrás',async()=>{
  const first=await save(input);const base=new Date('2099-01-01T00:00:00.000Z');
  await db.blueprintDocument.update({where:{id:first.data.id},data:{updatedAt:base}});
  const updated=await save({...input,documentId:first.data.id,baseUpdatedAt:base,contentText:'Segundo texto'});
  expect(updated.success).toBe(true);expect(updated.data.updatedAt.getTime()).toBe(base.getTime()+1);
  const stale=await save({...input,documentId:first.data.id,baseUpdatedAt:base,contentText:'Texto atrasado'});
  expect(stale.success).toBe(false);expect(stale.data.contentText).toBe('Segundo texto');
  expect(await db.blueprintActivity.count()).toBe(2);
});
it('falha do histórico reverte a criação e permite repetir a mesma intenção',async()=>{
  await db.$executeRawUnsafe(`CREATE TRIGGER activity_failure BEFORE INSERT ON BlueprintActivity BEGIN SELECT RAISE(ABORT,'falha de histórico simulada'); END`);
  await expect(save(input)).rejects.toThrow();
  expect(await db.blueprintDocument.count()).toBe(0);expect(await db.blueprintActivity.count()).toBe(0);
  await db.$executeRawUnsafe('DROP TRIGGER activity_failure');
  expect((await save(input)).success).toBe(true);expect(await db.blueprintDocument.count()).toBe(1);
});
it('falha do histórico reverte a edição e preserva a versão-base anterior',async()=>{
  const first=await save(input);
  await db.$executeRawUnsafe(`CREATE TRIGGER activity_failure BEFORE INSERT ON BlueprintActivity BEGIN SELECT RAISE(ABORT,'falha de histórico simulada'); END`);
  await expect(save({...input,documentId:first.data.id,baseUpdatedAt:first.data.updatedAt,contentText:'Não deve persistir'})).rejects.toThrow();
  expect(await db.blueprintDocument.findUnique({where:{id:first.data.id}})).toMatchObject({contentText:input.contentText,updatedAt:first.data.updatedAt});
});
it('duas sessões na mesma versão não sobrescrevem o conteúdo confirmado pela outra',async()=>{
  const first=await save(input);
  const results=await Promise.all([
    save({...input,documentId:first.data.id,baseUpdatedAt:first.data.updatedAt,contentText:'Sessão A'}),
    save({...input,documentId:first.data.id,baseUpdatedAt:first.data.updatedAt,contentText:'Sessão B'}),
  ]);
  expect(results.filter(r=>r.success)).toHaveLength(1);expect(results.filter(r=>!r.success)).toHaveLength(1);
  expect(await db.blueprintActivity.count()).toBe(2);
});
