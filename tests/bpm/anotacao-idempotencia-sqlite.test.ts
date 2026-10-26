import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),acesso:vi.fn(),transaction:vi.fn(),cache:vi.fn(),notificar:vi.fn()}));
vi.mock('../../auth',()=>({auth:mocks.auth}));
vi.mock('@/lib/prisma',()=>({default:{$transaction:mocks.transaction}}));
vi.mock('next/cache',()=>({revalidatePath:mocks.cache}));
vi.mock('@/lib/bpm/ownership',()=>({exigirAcessoBpmCard:mocks.acesso}));
vi.mock('@/lib/bpm/realtime-server',()=>({notificarPipelineBpm:mocks.notificar}));
import { CriarInteracaoCardBpm } from '@/actions/bpm/Interacoes';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as {DatabaseSync:new(path:string)=>{exec(sql:string):void;close():void}};
let directory:string,db:PrismaClient;
const input={cardId:'c000000000000000000000001',tipo:'ANOTACAO',observacoes:'Texto fictício',idempotencyKey:'00000000-0000-4000-8000-000000000001'};
beforeEach(()=>{
  vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:'7',role:'ADMIN'}});mocks.acesso.mockResolvedValue({});
  directory=mkdtempSync(join(tmpdir(),'crm-anotacao-'));const file=join(directory,'test.db');const sqlite=new DatabaseSync(file);
  sqlite.exec(`CREATE TABLE usuarios(id INTEGER PRIMARY KEY,nome TEXT);INSERT INTO usuarios VALUES(7,'Pessoa fictícia');
    CREATE TABLE BpmInteracaoCard(id TEXT PRIMARY KEY,cardId TEXT NOT NULL,tipo TEXT NOT NULL,agendadoEm DATETIME,agendaLink TEXT,observacoes TEXT,resumo TEXT,registradoPorId INTEGER NOT NULL,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE BpmCardHistorico(id TEXT PRIMARY KEY,cardId TEXT NOT NULL,acao TEXT NOT NULL,valorAnteriorJson TEXT,valorNovoJson TEXT,usuarioId INTEGER,automacaoOrigem TEXT,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  sqlite.close();db=new PrismaClient({adapter:new PrismaLibSQL({url:`file:${file}`})});mocks.transaction.mockImplementation((callback,options)=>db.$transaction(callback,options));
});
afterEach(async()=>{await db.$disconnect();rmSync(directory,{recursive:true,force:true});});
it('repetir a mesma intenção confirma uma única anotação e um único histórico',async()=>{
  const first=await CriarInteracaoCardBpm(input),again=await CriarInteracaoCardBpm(input);
  expect(first.success).toBe(true);expect(again).toMatchObject({success:true,data:{id:first.data!.id}});
  expect(await db.bpmInteracaoCard.count()).toBe(1);expect(await db.bpmCardHistorico.count()).toBe(1);
  expect(mocks.acesso).toHaveBeenCalledTimes(4);
});
it('a mesma chave não reescreve outra intenção e o texto confirmado permanece intacto',async()=>{
  await CriarInteracaoCardBpm(input);expect((await CriarInteracaoCardBpm({...input,observacoes:'Texto diferente'})).success).toBe(false);
  expect(await db.bpmInteracaoCard.findFirst()).toMatchObject({observacoes:input.observacoes});expect(await db.bpmInteracaoCard.count()).toBe(1);
});
it('falha de histórico reverte a anotação e permite retry com a mesma chave',async()=>{
  await db.$executeRawUnsafe(`CREATE TRIGGER history_failure BEFORE INSERT ON BpmCardHistorico BEGIN SELECT RAISE(ABORT,'falha sintética'); END`);
  expect((await CriarInteracaoCardBpm(input)).success).toBe(false);expect(await db.bpmInteracaoCard.count()).toBe(0);
  await db.$executeRawUnsafe('DROP TRIGGER history_failure');expect((await CriarInteracaoCardBpm(input)).success).toBe(true);expect(await db.bpmInteracaoCard.count()).toBe(1);
});
it('falha de cache/realtime após commit não informa fracasso nem duplica em repetição',async()=>{
  mocks.cache.mockImplementation(()=>{throw new Error('cache indisponível sintético');});mocks.notificar.mockRejectedValue(new Error('realtime indisponível sintético'));
  expect((await CriarInteracaoCardBpm(input)).success).toBe(true);expect((await CriarInteracaoCardBpm(input)).success).toBe(true);
  expect(await db.bpmInteracaoCard.count()).toBe(1);
});
it('ausência de sessão ou acesso negado impede a gravação',async()=>{
  mocks.auth.mockResolvedValueOnce(null);expect((await CriarInteracaoCardBpm(input)).success).toBe(false);
  mocks.acesso.mockRejectedValue(new Error('Não autorizado'));expect((await CriarInteracaoCardBpm(input)).success).toBe(false);
  expect(await db.bpmInteracaoCard.count()).toBe(0);
});
it('duas sessões concorrentes com a mesma intenção convergem para uma anotação',async()=>{
  const results=await Promise.all([CriarInteracaoCardBpm(input),CriarInteracaoCardBpm(input)]);
  expect(results.every(r=>r.success)).toBe(true);expect(await db.bpmInteracaoCard.count()).toBe(1);expect(await db.bpmCardHistorico.count()).toBe(1);
});
