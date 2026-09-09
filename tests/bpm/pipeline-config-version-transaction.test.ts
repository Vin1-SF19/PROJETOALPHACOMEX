import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Node 24 fornece node:sqlite; os tipos do tsconfig do projeto ainda não o declaram.
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

const temporarios: string[] = [];

function banco() {
  const diretorio = mkdtempSync(join(tmpdir(), "bpm-config-version-"));
  temporarios.push(diretorio);
  const caminho = join(diretorio, "config.db");
  const db = new DatabaseSync(caminho);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE BpmPipeline (
      id TEXT NOT NULL PRIMARY KEY,
      nome TEXT NOT NULL,
      ativo INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0,
      chave TEXT
    );
    CREATE TABLE BpmEtapa (
      id TEXT NOT NULL PRIMARY KEY,
      pipelineId TEXT NOT NULL,
      nome TEXT NOT NULL,
      ordem INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (pipelineId) REFERENCES BpmPipeline(id)
    );
    INSERT INTO BpmPipeline (id,nome,createdAt,updatedAt) VALUES ('p1','Pipeline','2026-01-01','2026-01-01');
    INSERT INTO BpmEtapa (id,pipelineId,nome) VALUES ('e1','p1','Inicial');
  `);
  const migration = readFileSync(
    "prisma/migrations/20260909211000_bpm_pipeline_config_version/migration.sql",
    "utf8",
  );
  db.exec(migration);
  return { db, caminho };
}

afterEach(() => {
  for (const diretorio of temporarios.splice(0)) {
    rmSync(diretorio, { recursive: true, force: true });
  }
});

describe("configVersion e atomicidade da publicação", () => {
  it("migra pipelines existentes sem perder registros", () => {
    const { db } = banco();
    expect(db.prepare("SELECT count(*) AS n FROM BpmPipeline").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT configVersion FROM BpmPipeline WHERE id='p1'").get()).toEqual({ configVersion: 1 });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    db.close();
  });

  it("publica filho e contador no mesmo commit", () => {
    const { db } = banco();
    db.exec("BEGIN IMMEDIATE");
    const cas = db.prepare("UPDATE BpmPipeline SET configVersion=configVersion+1 WHERE id=? AND configVersion=?").run("p1", 1);
    expect(cas.changes).toBe(1);
    db.prepare("UPDATE BpmEtapa SET nome=? WHERE id=?").run("Publicado", "e1");
    db.exec("COMMIT");
    expect(db.prepare("SELECT configVersion FROM BpmPipeline WHERE id='p1'").get()).toEqual({ configVersion: 2 });
    expect(db.prepare("SELECT nome FROM BpmEtapa WHERE id='e1'").get()).toEqual({ nome: "Publicado" });
    db.close();
  });

  it("reverte contador e filhos quando a publicação falha no meio", () => {
    const { db } = banco();
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE BpmPipeline SET configVersion=configVersion+1 WHERE id=? AND configVersion=?").run("p1", 1);
      db.prepare("UPDATE BpmEtapa SET nome=? WHERE id=?").run("Parcial", "e1");
      throw new Error("FALHA_INTERMEDIARIA_TESTE");
    } catch {
      db.exec("ROLLBACK");
    }
    expect(db.prepare("SELECT configVersion FROM BpmPipeline WHERE id='p1'").get()).toEqual({ configVersion: 1 });
    expect(db.prepare("SELECT nome FROM BpmEtapa WHERE id='e1'").get()).toEqual({ nome: "Inicial" });
    db.close();
  });

  it("uma sessão com baseVersion antiga não sobrescreve a vencedora", () => {
    const { db, caminho } = banco();
    const outraSessao = new DatabaseSync(caminho);
    const vencedor = db.prepare("UPDATE BpmPipeline SET configVersion=configVersion+1 WHERE id=? AND configVersion=?").run("p1", 1);
    expect(vencedor.changes).toBe(1);
    const perdedor = outraSessao.prepare("UPDATE BpmPipeline SET configVersion=configVersion+1 WHERE id=? AND configVersion=?").run("p1", 1);
    expect(perdedor.changes).toBe(0);
    expect(outraSessao.prepare("SELECT configVersion FROM BpmPipeline WHERE id='p1'").get()).toEqual({ configVersion: 2 });
    outraSessao.close();
    db.close();
  });
});
