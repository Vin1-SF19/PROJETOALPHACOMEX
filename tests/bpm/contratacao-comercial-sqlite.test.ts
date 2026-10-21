import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { describe, expect, it, vi } from "vitest";
const controle = vi.hoisted(() => ({ falharOutbox: false }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/bpm/ownership", () => ({ checarAcessoBpmCard: vi.fn().mockResolvedValue({ autorizado: true }) }));
vi.mock("@/lib/bpm/alertas-tarefas", () => ({ dispararAlertaTarefaBpm: vi.fn(), tarefaAlertaSelect: {} }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", async (original) => {
  const real = await original<typeof import("@/lib/bpm/automacoes/eventos")>();
  return { ...real, publicarEventoBpm: async (...args: Parameters<typeof real.publicarEventoBpm>) => {
    if (controle.falharOutbox) throw new Error("Outbox indisponível (fixture)");
    return real.publicarEventoBpm(...args);
  } };
});
import { disponibilizarContratoComercial, idTarefaContratacao } from "@/lib/bpm/contratacao-comercial-server";
import { CHAVES_CAMPOS as C } from "@/lib/bpm/financeiro-config.client";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => { exec(sql: string): void; close(): void };
};
const comercial = "c111111111111111111111111";
const financeiro = "c222222222222222222222222";
const comercialPipeline = "c333333333333333333333333";
const financeiroPipeline = "c444444444444444444444444";
const comercialEtapa = "c555555555555555555555555";
const financeiroEtapa = "c666666666666666666666666";
function criarTabelas(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  for (const modelo of ["Cliente", "usuarios", "BpmCard", "BpmPipeline", "BpmEtapa", "BpmCardVinculo", "BpmCardHistorico", "BpmCampo", "BpmCardCampoValor", "BpmCardAnexo", "DocumentoGerado", "BpmTarefa", "BpmEventoDominio"]) {
    const corpo = schema.match(new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (!corpo) throw new Error(`Missing model ${modelo}`);
    const colunas = corpo.split("\n").flatMap((linha) => {
      const item = linha.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|BigInt|Decimal|Bytes|Json)(\?)?\s*(.*)$/);
      if (!item) return [];
      const [, nome, tipo, opcional, atributos] = item;
      const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB", Json: "TEXT" };
      const valorPadrao = atributos.match(/@default\(("[^"]*"|true|false|\d+|now\(\))\)/)?.[1];
      const padrao = valorPadrao === "now()" ? "CURRENT_TIMESTAMP" : valorPadrao === "true" ? "1" : valorPadrao === "false" ? "0" : valorPadrao ?? (!opcional ? tipo === "DateTime" ? "CURRENT_TIMESTAMP" : ["Int", "Boolean", "Float", "Decimal", "BigInt"].includes(tipo) ? "0" : "''" : undefined);
      return [`"${nome}" ${tipos[tipo]}${atributos.includes("@id") ? " PRIMARY KEY" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
    });
    if (modelo === "BpmCardVinculo") colunas.push("UNIQUE(cardOrigemId,cardDestinoId)");
    if (modelo === "BpmCardCampoValor") colunas.push("UNIQUE(cardId,campoId)");
    if (modelo === "BpmEventoDominio") colunas.push("UNIQUE(idempotencyKey)");
    sqlite.exec(`CREATE TABLE "${modelo}" (${colunas.join(",")});`);
  }
}

async function fixture(testar: (db: PrismaClient) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "crm-contract-readiness-"));
  const filename = join(dir, "db.sqlite");
  const sqlite = new DatabaseSync(filename);
  try { criarTabelas(sqlite); } finally { sqlite.close(); }
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) });
  controle.falharOutbox = false;
  try {
    await db.$executeRaw`INSERT INTO usuarios(id,nome,status,role) VALUES(7,'Closer','ATIVO','COMERCIAL')`;
    await db.cliente.create({ data: { id: 5, razaoSocial: "Empresa fictícia" } });
    await db.bpmPipeline.create({ data: { id: comercialPipeline, nome: "Revisão de Radar", chave: "comercial" } });
    await db.bpmPipeline.create({ data: { id: financeiroPipeline, nome: "Financeiro", chave: "financeiro" } });
    await db.bpmEtapa.create({ data: { id: comercialEtapa, nome: "Contrato fechado", chave: "fechado", ordem: 1, pipelineId: comercialPipeline } });
    await db.bpmEtapa.create({ data: { id: financeiroEtapa, nome: "Elaboração", ordem: 1, pipelineId: financeiroPipeline } });
    await db.bpmCard.create({ data: { id: comercial, empresaId: 5, pipelineId: comercialPipeline, etapaId: comercialEtapa, responsavelId: 7, statusPosFechamento: "AGUARDANDO_CONTRATO" } });
    await db.bpmCard.create({ data: { id: financeiro, empresaId: 5, pipelineId: financeiroPipeline, etapaId: financeiroEtapa, responsavelId: 7 } });
    await db.bpmCardVinculo.create({ data: { cardOrigemId: comercial, cardDestinoId: financeiro } });
    for (const [id, chave] of [["link", C.LINK_CONTRATO], ["elaborado", C.CONTRATO_ELABORADO], ["assinado", C.ANEXO_ASSINADO]]) {
      await db.bpmCampo.create({ data: { id, chave, nome: chave, tipo: "arquivo", pipelineId: financeiroPipeline } });
    }
    await db.bpmCardAnexo.create({ data: { id: "anexo", cardId: financeiro, campoId: "link", nome: "Contrato.pdf", tipo: "application/pdf", url: `bpm-blob:bpm/${financeiro}/contrato.pdf`, enviadoPorId: 7 } });
    await db.bpmCardCampoValor.create({ data: { cardId: financeiro, campoId: "link", valor: "anexo" } });
    await db.bpmCardCampoValor.create({ data: { cardId: financeiro, campoId: "elaborado", valor: "Não" } });
    await testar(db);
  } finally { await db.$disconnect(); rmSync(dir, { recursive: true, force: true }); }
}
async function preparar(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    await tx.bpmCardCampoValor.update({ where: { cardId_campoId: { cardId: financeiro, campoId: "elaborado" } }, data: { valor: "Sim" } });
    return disponibilizarContratoComercial(tx, financeiro, 7);
  });
}
describe("retorno contratual em Prisma/SQLite privado", () => {
  it("rollback de outbox desfaz prontidão, revisão comercial, tarefa e aviso; replay posterior não renova alerta", async () => fixture(async (db) => {
    const antes = await db.bpmCard.findUniqueOrThrow({ where: { id: comercial }, select: { versao: true, updatedAt: true, statusPosFechamento: true } });
    controle.falharOutbox = true;
    await expect(preparar(db)).rejects.toThrow("Outbox indisponível");
    expect(await db.bpmCard.findUniqueOrThrow({ where: { id: comercial }, select: { versao: true, updatedAt: true, statusPosFechamento: true } })).toEqual(antes);
    expect(await db.bpmTarefa.count()).toBe(0);
    expect(await db.bpmEventoDominio.count()).toBe(0);
    expect((await db.bpmCardCampoValor.findUnique({ where: { cardId_campoId: { cardId: financeiro, campoId: "elaborado" } } }))?.valor).toBe("Não");
    controle.falharOutbox = false;
    expect(await preparar(db)).toHaveProperty("tarefaAlertaId");
    const tarefa = await db.bpmTarefa.findUniqueOrThrow({ where: { id: idTarefaContratacao("envio", comercial, financeiro) } });
    expect(tarefa.alertaEm).toBeInstanceOf(Date);
    expect(await preparar(db)).toBeNull();
    expect((await db.bpmTarefa.findUniqueOrThrow({ where: { id: tarefa.id } })).alertaEm).toEqual(tarefa.alertaEm);
    expect(await db.bpmTarefa.count()).toBe(1);
    expect(await db.bpmEventoDominio.count()).toBe(2);
    expect((await db.bpmCard.findUniqueOrThrow({ where: { id: comercial } })).versao).toBe(antes.versao + 1);
  }));
  it("concorrência converge para uma tarefa/revisão notificada; assinado posterior muda revisão sem renotificar envio", async () => fixture(async (db) => {
    const resultados = await Promise.allSettled([preparar(db), preparar(db)]);
    expect(resultados.some((item) => item.status === "fulfilled")).toBe(true);
    await preparar(db);
    expect(await db.bpmTarefa.count()).toBe(1);
    expect(await db.bpmEventoDominio.count()).toBe(2);
    const tarefa = await db.bpmTarefa.findUniqueOrThrow({ where: { id: idTarefaContratacao("envio", comercial, financeiro) } });
    const antes = await db.bpmCard.findUniqueOrThrow({ where: { id: comercial } });
    await db.$transaction(async (tx) => {
      await tx.bpmCardAnexo.create({ data: { id: "assinatura", cardId: financeiro, campoId: "assinado", nome: "Assinado.png", tipo: "image/png", url: `bpm-blob:bpm/${financeiro}/assinado.png`, enviadoPorId: 7 } });
      await tx.bpmCardCampoValor.create({ data: { cardId: financeiro, campoId: "assinado", valor: "assinatura" } });
      expect(await disponibilizarContratoComercial(tx, financeiro, 7)).not.toHaveProperty("tarefaAlertaId");
    });
    const depois = await db.bpmCard.findUniqueOrThrow({ where: { id: comercial } });
    expect(depois.versao).toBe(antes.versao + 1);
    expect(depois.updatedAt.getTime()).toBeGreaterThan(antes.updatedAt.getTime());
    expect((await db.bpmTarefa.findUniqueOrThrow({ where: { id: tarefa.id } })).alertaEm).toEqual(tarefa.alertaEm);
    expect(await db.bpmEventoDominio.count()).toBe(3);
  }));
});
