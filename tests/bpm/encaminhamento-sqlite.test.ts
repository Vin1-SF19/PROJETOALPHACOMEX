import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ client: null as PrismaClient | null, falharOutbox: false }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: (callback: Parameters<PrismaClient["$transaction"]>[0]) => {
  if (!estado.client) throw new Error("fixture missing");
  return estado.client.$transaction(callback);
} } }));
vi.mock("@/lib/bpm/ownership", () => ({ isAdminRole: () => false, exigirAcessoBpmCard: vi.fn(), exigirAcessoBpmPipeline: vi.fn() }));
vi.mock("@/lib/bpm/copiar-campos-card-vinculado", () => ({ copiarCamposCardVinculado: vi.fn() }));
vi.mock("@/lib/bpm/requisitos-etapa-server", () => ({ carregarCamposFaltantesCardEtapa: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/bpm/sla", () => ({ criarSlaInstancia: vi.fn() }));
vi.mock("@/lib/bpm/cadencias/ativacao-automatica", () => ({ ativarCadenciasNaEntradaBpm: vi.fn() }));
vi.mock("@/lib/bpm/automacoes/eventos", async (original) => {
  const real = await original<typeof import("@/lib/bpm/automacoes/eventos")>();
  return { ...real, publicarEventoBpm: async (...args: Parameters<typeof real.publicarEventoBpm>) => {
    if (estado.falharOutbox) throw new Error("Outbox indisponível (fixture)");
    return real.publicarEventoBpm(...args);
  } };
});

import { executarEncaminhamentoBpm } from "@/lib/bpm/automacoes/encaminhamento";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => { exec(sql: string): void; prepare(sql: string): { run(...values: (string | number)[]): void }; close(): void };
};
const pipeline = "c111111111111111111111111";
const destino = "c222222222222222222222222";
const etapa = "c333333333333333333333333";
const cardId = "c444444444444444444444444";
const automacaoId = "c555555555555555555555555";
const execucaoId = "c666666666666666666666666";

/** Build a private SQLite fixture from scalar model fields, never from a remote database. */
function criarTabelas(sqlite: InstanceType<typeof DatabaseSync>) {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  for (const modelo of ["BpmCard", "BpmPipeline", "BpmEtapa", "BpmCardMembro", "BpmCardVinculo", "BpmCardHistorico", "BpmAutomacaoExecucao", "BpmAutomacao", "BpmCampo", "BpmEventoDominio"]) {
    const corpo = schema.match(new RegExp(`model ${modelo} \\{([\\s\\S]*?)\\n\\}`))?.[1];
    if (!corpo) throw new Error(`Missing model ${modelo}`);
    const colunas = corpo.split("\n").flatMap((linha) => {
      const item = linha.trim().match(/^(\w+)\s+(String|Int|Float|Boolean|DateTime|BigInt|Decimal|Bytes)(\?)?\s*(.*)$/);
      if (!item) return [];
      const [, nome, tipo, opcional, atributos] = item;
      const tipos: Record<string, string> = { String: "TEXT", Int: "INTEGER", Float: "REAL", Boolean: "BOOLEAN", DateTime: "DATETIME", BigInt: "INTEGER", Decimal: "REAL", Bytes: "BLOB" };
      const valorPadrao = atributos.match(/@default\(("[^"]*"|true|false|\d+|now\(\))\)/)?.[1];
      const padrao = valorPadrao === "now()" ? "CURRENT_TIMESTAMP" : valorPadrao === "true" ? "1" : valorPadrao === "false" ? "0" : valorPadrao;
      return [`"${nome}" ${tipos[tipo]}${atributos.includes("@id") ? " PRIMARY KEY" : ""}${!opcional ? " NOT NULL" : ""}${padrao ? ` DEFAULT ${padrao}` : ""}`];
    });
    if (modelo === "BpmCardVinculo") colunas.push("UNIQUE(cardOrigemId,cardDestinoId)");
    if (modelo === "BpmEventoDominio") colunas.push("UNIQUE(idempotencyKey)");
    sqlite.exec(`CREATE TABLE "${modelo}" (${colunas.join(",")});`);
  }
  sqlite.prepare("INSERT INTO BpmPipeline(id,nome,chave,createdAt,updatedAt) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(pipeline, "Revisão de Radar", "comercial");
  sqlite.prepare("INSERT INTO BpmPipeline(id,nome,chave,createdAt,updatedAt) VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(destino, "Financeiro", "financeiro");
  sqlite.prepare("INSERT INTO BpmEtapa(id,pipelineId,nome,ordem,createdAt,updatedAt) VALUES(?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(etapa, destino, "Novo contrato", 0);
  sqlite.prepare("INSERT INTO BpmCard(id,empresaId,pipelineId,etapaId,responsavelId,createdAt,updatedAt) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(cardId, 7, pipeline, etapa, 9);
  sqlite.prepare("INSERT INTO BpmAutomacao(id,pipelineId,etapaId,nome,gatilhoTipo,acaoTipo,parametrosJson,criadoPorId,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
    .run(automacaoId, pipeline, etapa, "Encaminhar", "ENTRAR_COLUNA", "CRIAR_CARD_OUTRO_PIPELINE", "{}", 9);
  sqlite.prepare("INSERT INTO BpmAutomacaoExecucao(id,automacaoId,cardId,eventoChave,gatilhoTipo,createdAt,updatedAt) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
    .run(execucaoId, automacaoId, cardId, "teste", "ENTRAR_COLUNA");
}

async function fixture(testar: (db: PrismaClient) => Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), "crm-handoff-atomic-"));
  const filename = join(dir, "db.sqlite");
  const sqlite = new DatabaseSync(filename);
  try { criarTabelas(sqlite); } finally { sqlite.close(); }
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) });
  estado.client = db;
  estado.falharOutbox = false;
  try { await testar(db); } finally { await db.$disconnect(); estado.client = null; rmSync(dir, { recursive: true, force: true }); }
}
const executar = () => executarEncaminhamentoBpm({ cardId, automacaoId, execucaoId,
  parametros: { pipelineId: destino, etapaId: etapa, vincularAoOriginal: true, somenteSeNaoExistirAtivo: true } });

describe("encaminhamento atômico em Prisma/SQLite privado", () => {
  it("falha de outbox desfaz destino, vínculo, histórico e CAS; retry único não altera versão novamente", async () => fixture(async (db) => {
    estado.falharOutbox = true;
    await expect(executar()).rejects.toThrow("Outbox indisponível");
    expect(await db.bpmCard.count()).toBe(1);
    expect(await db.bpmCardVinculo.count()).toBe(0);
    expect(await db.bpmCardHistorico.count()).toBe(0);
    expect((await db.bpmCard.findUnique({ where: { id: cardId }, select: { versao: true } }))?.versao).toBe(0);
    estado.falharOutbox = false;
    const primeiro = await executar();
    expect(primeiro.existente).toBe(false);
    const repetido = await executar();
    expect(repetido).toMatchObject({ cardId: primeiro.cardId, existente: true, versao: 1 });
    expect(await db.bpmCard.count()).toBe(2);
    expect(await db.bpmCardVinculo.count()).toBe(1);
    expect(await db.bpmCardHistorico.count()).toBe(1);
    expect(await db.bpmEventoDominio.count()).toBe(1);
  }));
  it("vínculo manual com card de outro cliente não é reutilizado nem recebe cópias", async () => fixture(async (db) => {
    const outro = await db.bpmCard.create({ data: { empresaId: 999, pipelineId: destino, etapaId: etapa, responsavelId: 9 } });
    await db.bpmCardVinculo.create({ data: { cardOrigemId: cardId, cardDestinoId: outro.id } });
    const enviado = await executar();
    expect(enviado.cardId).not.toBe(outro.id);
    expect((await db.bpmCard.findUnique({ where: { id: enviado.cardId }, select: { empresaId: true } }))?.empresaId).toBe(7);
    expect(await db.bpmCardVinculo.count()).toBe(2);
    expect(await db.bpmEventoDominio.count()).toBe(1);
  }));
  it("duas solicitações concorrentes não duplicam negociação nem efeitos; retry converge", async () => fixture(async (db) => {
    const resultados = await Promise.allSettled([executar(), executar()]);
    expect(resultados.some((resultado) => resultado.status === "fulfilled")).toBe(true);
    const confirmado = await executar();
    expect(confirmado.existente).toBe(true);
    expect(await db.bpmCard.count()).toBe(2);
    expect(await db.bpmCardVinculo.count()).toBe(1);
    expect(await db.bpmEventoDominio.count()).toBe(1);
  }));
});
