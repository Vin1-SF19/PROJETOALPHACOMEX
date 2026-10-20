import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { expect, it, vi } from "vitest";

// The publisher receives the real, disposable SQLite client explicitly.
vi.mock("@/lib/prisma", () => ({ default: {} }));
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (filename: string) => {
    exec(sql: string): void;
    prepare(sql: string): { run(...values: string[]): void };
    close(): void;
  };
};

it("Prisma/SQLite confirma movimento e evento RD juntos, preserva retry e desfaz falha de publicação", async () => {
  const directory = mkdtempSync(join(tmpdir(), "rd-event-runtime-"));
  const filename = join(directory, "test.db");
  const cardId = `rdcard_${"a".repeat(28)}`;
  const pipelineId = `c${"b".repeat(24)}`;
  const origem = `c${"c".repeat(24)}`;
  const destino = `c${"d".repeat(24)}`;
  const sqlite = new DatabaseSync(filename);
  sqlite.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE BpmCard(id TEXT PRIMARY KEY, etapaId TEXT NOT NULL, versao INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE BpmEventoDominio(
      id TEXT PRIMARY KEY, tipo TEXT NOT NULL, entidadeTipo TEXT NOT NULL, entidadeId TEXT NOT NULL,
      cardId TEXT REFERENCES BpmCard(id), pipelineId TEXT, valorAnteriorJson TEXT, valorNovoJson TEXT,
      atorTipo TEXT NOT NULL, atorUserId INTEGER, atorExecucaoId TEXT,
      ocorridoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, correlationId TEXT NOT NULL, causationId TEXT,
      profundidade INTEGER NOT NULL DEFAULT 0, idempotencyKey TEXT NOT NULL UNIQUE,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
  sqlite.prepare("INSERT INTO BpmCard(id,etapaId) VALUES(?,?)").run(cardId, origem);
  sqlite.close();
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url: `file:${filename}` }) });
  const input = {
    tipo: "CARD_MOVIDO", entidadeTipo: "CARD", entidadeId: cardId, cardId, pipelineId,
    atorTipo: "USUARIO", atorUserId: 7, correlationId: "rd-move-runtime", idempotencyKey: "transition:rd-move-runtime",
    valorAnterior: { etapaId: origem }, valorNovo: { etapaId: destino },
  };
  try {
    const first = await db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE BpmCard SET etapaId=${destino}, versao=versao+1 WHERE id=${cardId}`;
      return publicarEventoBpm(input, tx);
    });
    expect(first).toMatchObject({ cardId, pipelineId, tipo: "CARD_MOVIDO" });
    expect(await db.$queryRaw`SELECT etapaId,versao FROM BpmCard WHERE id=${cardId}`).toEqual([{ etapaId: destino, versao: 1 }]);
    expect((await publicarEventoBpm(input, db))?.id).toBe(first?.id);
    expect(await db.bpmEventoDominio.count()).toBe(1);
    await expect(db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE BpmCard SET etapaId=${origem}, versao=versao+1 WHERE id=${cardId}`;
      await publicarEventoBpm({ ...input, cardId: "rdcard_invalido", idempotencyKey: "invalid" }, tx);
    })).rejects.toThrow();
    expect(await db.$queryRaw`SELECT etapaId,versao FROM BpmCard WHERE id=${cardId}`).toEqual([{ etapaId: destino, versao: 1 }]);
    expect(await db.bpmEventoDominio.count()).toBe(1);
  } finally {
    await db.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
