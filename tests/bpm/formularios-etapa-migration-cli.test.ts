import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createClient } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let directory = "";
let databaseUrl = "";

const schema = `
PRAGMA foreign_keys=ON;
CREATE TABLE BpmPipeline (id TEXT PRIMARY KEY, nome TEXT NOT NULL);
CREATE TABLE BpmEtapa (
  id TEXT PRIMARY KEY, pipelineId TEXT NOT NULL, nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0, capabilitiesJson TEXT
);
CREATE TABLE BpmEtapaFormulario (
  id TEXT PRIMARY KEY, etapaId TEXT NOT NULL UNIQUE, versao INTEGER NOT NULL DEFAULT 1,
  ativo INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE BpmFormularioSecao (
  id TEXT PRIMARY KEY, formularioId TEXT NOT NULL, chave TEXT NOT NULL, titulo TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE BpmCampo (
  id TEXT PRIMARY KEY, etapaId TEXT, pipelineId TEXT NOT NULL, nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1, escopo TEXT NOT NULL DEFAULT 'CARD',
  visivel INTEGER NOT NULL DEFAULT 1, editavel INTEGER NOT NULL DEFAULT 1,
  somenteLeitura INTEGER NOT NULL DEFAULT 0, ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE BpmFormularioComponente (
  id TEXT PRIMARY KEY, secaoId TEXT NOT NULL, chave TEXT NOT NULL, tipo TEXT NOT NULL,
  campoId TEXT, capability TEXT, configJson TEXT, ordem INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE BpmCampoPipeline (id TEXT PRIMARY KEY, campoId TEXT NOT NULL, pipelineId TEXT NOT NULL);
CREATE TABLE BpmCampoEtapaConfig (
  id TEXT PRIMARY KEY, campoId TEXT NOT NULL, etapaId TEXT NOT NULL,
  visivel INTEGER NOT NULL DEFAULT 1, editavel INTEGER NOT NULL DEFAULT 1,
  somenteLeitura INTEGER NOT NULL DEFAULT 0, obrigatorio INTEGER NOT NULL DEFAULT 0,
  obrigatorioEntrada INTEGER NOT NULL DEFAULT 0, obrigatorioSaida INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  UNIQUE(campoId, etapaId)
);
CREATE TABLE BpmCampoObrigatorioEtapa (id TEXT PRIMARY KEY, campoId TEXT NOT NULL, etapaId TEXT NOT NULL);
CREATE TABLE BpmCampoOcultoEtapa (id TEXT PRIMARY KEY, campoId TEXT NOT NULL, etapaId TEXT NOT NULL);
CREATE TABLE BpmCampoMapeamento (
  id TEXT PRIMARY KEY, campoOrigemId TEXT NOT NULL, campoDestinoId TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE BpmCard (id TEXT PRIMARY KEY);
CREATE TABLE BpmCardCampoValor (id TEXT PRIMARY KEY, campoId TEXT NOT NULL);
CREATE TABLE BpmCardChecklist (id TEXT PRIMARY KEY);
CREATE TABLE BpmCardChecklistItem (id TEXT PRIMARY KEY);
CREATE TABLE BpmCardHistorico (id TEXT PRIMARY KEY);
CREATE TABLE BpmCardAnexo (id TEXT PRIMARY KEY);
`;

const seed = `
INSERT INTO BpmPipeline VALUES ('pipeline-1','Comercial');
INSERT INTO BpmEtapa VALUES ('stage-1','pipeline-1','Entrada',0,'["FOLLOW_UP_SCHEDULER"]');
INSERT INTO BpmEtapa VALUES ('stage-2','pipeline-1','Tratativa',1,'["FOLLOW_UP_SCHEDULER"]');
INSERT INTO BpmCampo VALUES ('field-1',NULL,'pipeline-1','CNPJ',1,'CARD',1,1,0,0);
INSERT INTO BpmCampoEtapaConfig VALUES ('config-2','field-1','stage-2',1,1,0,0,0,0,0,'2026-09-09','2026-09-09');
INSERT INTO BpmEtapaFormulario VALUES ('form:stage-1','stage-1',1,1,'2026-09-09','2026-09-09');
INSERT INTO BpmEtapaFormulario VALUES ('form:stage-2','stage-2',1,1,'2026-09-09','2026-09-09');
INSERT INTO BpmFormularioSecao VALUES ('section:stage-1:fields','form:stage-1','fields','Campos',0,'2026-09-09','2026-09-09');
INSERT INTO BpmFormularioSecao VALUES ('section:stage-2:fields','form:stage-2','fields','Campos',0,'2026-09-09','2026-09-09');
INSERT INTO BpmFormularioComponente VALUES (
  'component:stage-1:field:field-1','section:stage-1:fields','field:field-1','CAMPO',
  'field-1',NULL,NULL,0,'2026-09-09','2026-09-09'
);
INSERT INTO BpmFormularioComponente VALUES (
  'component:stage-2:field:field-1','section:stage-2:fields','field:field-1','CAMPO',
  'field-1',NULL,NULL,0,'2026-09-09','2026-09-09'
);
`;

function runCli(...args: string[]) {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/bpm-stage-form-migration.mjs", ...args],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        TURSO_DATABASE_URL: "",
        TURSO_AUTH_TOKEN: "",
        DATABASE_URL: databaseUrl,
      },
      encoding: "utf8",
    },
  );
  const jsonStart = output.indexOf("{");
  return JSON.parse(output.slice(jsonStart));
}

describe("CLI de migração dos formulários", () => {
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "p0-2-stage-forms-"));
    databaseUrl = `file:${path.join(directory, "test.db")}`;
    const db = createClient({ url: databaseUrl });
    await db.executeMultiple(`${schema}\n${seed}`);
    await db.close();
  });

  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("dry-run gera snapshot sem alterar o banco", async () => {
    const outputDirectory = path.join(directory, "dry-run");
    const result = runCli("--dry-run", "--output-dir", outputDirectory);
    expect(result.environment).toBe("test");
    expect(result.fields).toMatchObject({ incompatible: 1, remove: 1 });
    expect(result.canonicalCoverage).toMatchObject({
      visibleActiveConfigurations: 1,
      representedExactlyOnce: 1,
      missing: [],
      duplicate: [],
    });

    const db = createClient({ url: databaseUrl });
    const count = await db.execute(
      "SELECT COUNT(*) total FROM BpmFormularioComponente",
    );
    await db.close();
    expect(Number(count.rows[0].total)).toBe(2);
    const snapshot = JSON.parse(await readFile(result.artifacts.snapshotPath, "utf8"));
    expect(snapshot.forms).toHaveLength(2);
  });

  it("aplica com hash/CAS e a segunda execução não produz alteração", async () => {
    const outputDirectory = path.join(directory, "apply");
    const dryRun = runCli("--dry-run", "--output-dir", outputDirectory);
    const applied = runCli(
      "--apply",
      "--environment",
      "test",
      "--confirm",
      "P0-2-STAGE-FORM-MIGRATION",
      "--plan",
      dryRun.planHash,
      "--output-dir",
      outputDirectory,
    );
    expect(applied.historicalStatePreserved).toBe(true);
    expect(applied.after.fields).toMatchObject({ incompatible: 0, remove: 0 });
    expect(applied.after.canonicalCoverage).toMatchObject({
      representedExactlyOnce: 1,
      missing: [],
      duplicate: [],
    });

    const rolledBack = runCli(
      "--rollback",
      applied.rollbackPath,
      "--environment",
      "test",
      "--confirm",
      "P0-2-STAGE-FORM-ROLLBACK",
    );
    expect(rolledBack.restored).toBe(true);

    const restored = runCli("--dry-run", "--output-dir", outputDirectory);
    expect(restored.fields).toMatchObject({ incompatible: 1, remove: 1 });
    const reappliedAfterRollback = runCli(
      "--apply",
      "--environment",
      "test",
      "--confirm",
      "P0-2-STAGE-FORM-MIGRATION",
      "--plan",
      restored.planHash,
      "--output-dir",
      outputDirectory,
    );
    expect(reappliedAfterRollback.after.fields.remove).toBe(0);

    const second = runCli("--dry-run", "--output-dir", outputDirectory);
    const reapplied = runCli(
      "--apply",
      "--environment",
      "test",
      "--confirm",
      "P0-2-STAGE-FORM-MIGRATION",
      "--plan",
      second.planHash,
      "--output-dir",
      outputDirectory,
    );
    expect(reapplied.before.fields.remove).toBe(0);
    expect(reapplied.after.fields.remove).toBe(0);
  });
});
