import { readFileSync } from "node:fs";
// Node 24 fornece node:sqlite no runtime; a versão de @types/node do projeto ainda não o declara.
// @ts-expect-error módulo nativo disponível no ambiente de testes
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "prisma/migrations/20260908205000_bpm_cadencia_multiplas_etapas/migration.sql",
  "utf8",
);

describe("migration de cadência multicoluna", () => {
  it("faz backfill idempotente e impõe uma cadência por coluna", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys=ON");
      db.exec(`
        CREATE TABLE "BpmEtapa" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pipelineId" TEXT NOT NULL
        );
        CREATE TABLE "BpmCadencia" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pipelineId" TEXT,
          "etapaId" TEXT,
          CONSTRAINT "BpmCadencia_etapaId_fkey"
            FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id")
        );
        INSERT INTO "BpmEtapa" ("id", "pipelineId") VALUES ('etapa-1', 'pipeline-1');
        INSERT INTO "BpmCadencia" ("id", "pipelineId", "etapaId") VALUES ('cadencia-1', 'pipeline-1', 'etapa-1');
      `);
      db.exec(migration);
      const backfill = migration.match(/INSERT OR IGNORE[\s\S]*;\s*$/)?.[0];
      expect(backfill).toBeTruthy();
      db.exec(backfill!);

      expect(db.prepare("SELECT count(*) AS total FROM BpmCadenciaEtapa").get()).toEqual({ total: 1 });
      expect(() => db.exec("INSERT INTO BpmCadenciaEtapa (id, cadenciaId, etapaId) VALUES ('outro', 'cadencia-1', 'etapa-1')"))
        .toThrow(/UNIQUE constraint failed/);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });
});
