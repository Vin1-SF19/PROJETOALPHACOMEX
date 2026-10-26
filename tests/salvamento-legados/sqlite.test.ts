import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ client: null as PrismaClient | null, other: null as PrismaClient | null, next:0 }));
vi.mock("../../auth", () => ({ auth: vi.fn(async()=>({user:{id:"1",nome:"Pessoa fictícia"}})) }));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/permissions/effective",()=>({readEffectiveModulePermissions:vi.fn(async()=>["Reservas","gerenciamentoTarefas"])}));
vi.mock("@/lib/prisma",()=>({default:new Proxy({}, {get:(_target,key)=>{
  const client=m.client!;
  if(key==="$transaction")return (...args: Parameters<PrismaClient["$transaction"]>)=>{
    const target=m.next++%2 && m.other ? m.other : client;
    return Reflect.apply(target.$transaction,target,args);
  };
  if(key==="$executeRaw") { const target=m.next++%2 && m.other ? m.other : client; return target.$executeRaw.bind(target); }
  const value=Reflect.get(client,key);return typeof value==="function"?value.bind(client):value;
}})}));

import { agendarSala, editarReserva, buscarReservasAtivas } from "@/actions/Reservas";
import { salvarAlteracoesCliente } from "@/actions/Clientes";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {DatabaseSync:new(path:string)=>{exec(sql:string):void;close():void}};
let ddl:string;
let directory:string;
beforeAll(()=>{
  // Gera DDL a partir do schema sem conexão a qualquer banco; só será aplicado ao fixture temporário.
  ddl=execFileSync("node_modules/.bin/prisma",["migrate","diff","--from-empty","--to-schema-datamodel","prisma/schema.prisma","--script"],{encoding:"utf8",env:{...process.env,PRISMA_HIDE_UPDATE_MESSAGE:"1",DATABASE_URL:"file:/tmp/alpha-schema-diff-unused.db",TURSO_DATABASE_URL:"file:/tmp/alpha-schema-diff-unused.db",TURSO_AUTH_TOKEN:""}});
});
beforeEach(async()=>{
  directory=mkdtempSync(join(tmpdir(),"alpha-save-legacy-"));const file=join(directory,"fixture.db");
  const sqlite=new DatabaseSync(file);sqlite.exec("BEGIN;" + ddl + "COMMIT;");sqlite.close();
  m.client=new PrismaClient({adapter:new PrismaLibSQL({url:`file:${file}`})});
  m.other=new PrismaClient({adapter:new PrismaLibSQL({url:`file:${file}`})});m.next=0;
  await m.client.usuarios.create({data:{id:1,nome:"Pessoa fictícia",usuario:"fixture",email:"fixture@example.test",senha:"synthetic",role:"Admin",status:"ATIVO"},select:{id:true}});
});
afterEach(async()=>{await m.client?.$disconnect();await m.other?.$disconnect();m.client=null;m.other=null;rmSync(directory,{recursive:true,force:true});});
const changes={razaoSocial:"Depois",nomeFantasia:null,dataConstituicao:null,regimeTributario:null,uf:null,municipio:null};

it("rollback real: cadastro mestre permanece intacto quando o histórico é rejeitado",async()=>{
  const client=await m.client!.cliente.create({data:{cnpj:"00000000000191",razaoSocial:"Antes"},select:{id:true}});
  await m.client!.$executeRawUnsafe(`CREATE TRIGGER fail_history BEFORE INSERT ON historico_alteracao_cliente BEGIN SELECT RAISE(ABORT, 'teste: histórico indisponível'); END`);
  expect((await salvarAlteracoesCliente(client.id,changes)).success).toBe(false);
  expect((await m.client!.cliente.findUnique({where:{id:client.id},select:{razaoSocial:true}}))?.razaoSocial).toBe("Antes");
  expect(await m.client!.historicoAlteracaoCliente.count()).toBe(0);
});

it("dois clientes SQLite concorrentes não confirmam reservas sobrepostas",async()=>{
  const booking={sala:"Sala fictícia",data:"2026-11-02",inicio:"10:00",fim:"11:00",tipo:"Reunião",paoDeQueijo:false,motivo:"Fixture concorrente"};
  const results=await Promise.all([agendarSala(booking),agendarSala(booking)]);
  expect(results.filter(r=>r.success)).toHaveLength(1);
  expect(results.filter(r=>!r.success)).toHaveLength(1);
  expect(await m.client!.reservas.count()).toBe(1);
});


it("reserva condicional aceita leitura de datas pelo Prisma e respeita registros ORM existentes",async()=>{
  const booking={sala:"Sala fictícia",data:"2026-11-02",inicio:"10:00",fim:"11:00",tipo:"Reunião",paoDeQueijo:false,motivo:"Fixture"};
  expect((await agendarSala(booking)).success).toBe(true);
  const rows=await buscarReservasAtivas();expect(rows).toHaveLength(1);expect(rows[0].inicio).toEqual(new Date("2026-11-02T13:00:00Z"));
  await m.client!.reservas.create({data:{sala:"Sala ORM",usuario:"Pessoa fictícia",data:new Date("2026-11-02T03:00:00Z"),inicio:new Date("2026-11-02T13:00:00Z"),fim:new Date("2026-11-02T14:00:00Z"),status:"Agendado"}});
  expect((await agendarSala({...booking,sala:"Sala ORM",inicio:"10:30",fim:"11:30"})).success).toBe(false);
  expect((await agendarSala({...booking,sala:"Sala ORM",inicio:"11:00",fim:"12:00"})).success).toBe(true);
});

it("duas edições concorrentes não movem reservas distintas para o mesmo intervalo",async()=>{
  const first=await m.client!.reservas.create({data:{sala:"Sala fictícia",usuario:"Pessoa fictícia",data:new Date("2026-11-02T03:00:00Z"),inicio:new Date("2026-11-02T11:00:00Z"),fim:new Date("2026-11-02T12:00:00Z"),status:"Agendado"},select:{id:true}});
  const second=await m.client!.reservas.create({data:{sala:"Sala fictícia",usuario:"Pessoa fictícia",data:new Date("2026-11-02T03:00:00Z"),inicio:new Date("2026-11-02T15:00:00Z"),fim:new Date("2026-11-02T16:00:00Z"),status:"Agendado"},select:{id:true}});
  const patch={sala:"Sala fictícia",data:"2026-11-02",inicio:"10:00",fim:"11:00"};
  const results=await Promise.all([editarReserva(first.id,patch),editarReserva(second.id,patch)]);
  expect(results.filter(r=>r.success)).toHaveLength(1);expect(await m.client!.reservas.count({where:{inicio:new Date("2026-11-02T13:00:00Z")}})).toBe(1);
});
