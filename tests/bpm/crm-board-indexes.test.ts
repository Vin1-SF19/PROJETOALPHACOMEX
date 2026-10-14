import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
// @ts-expect-error Node 24 fornece node:sqlite; os tipos atuais do projeto ainda não o declaram.
import { DatabaseSync } from "node:sqlite";

it("cria índices somente com confirmação e backup válido, preservando linhas e repetição idempotente", () => {
  const dir = mkdtempSync(join(tmpdir(), "crm-indices-"));
  const url = `file:${join(dir, "db.sqlite")}`;
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const dump = 'CREATE TABLE BpmCard (id TEXT PRIMARY KEY, empresaId INTEGER, pipelineId TEXT, etapaId TEXT, responsavelId INTEGER, status TEXT, createdAt TEXT); INSERT INTO BpmCard VALUES (\'card\',1,\'p\',\'e\',2,\'ATIVO\',\'2026-10-14\');';
  const db = new DatabaseSync(join(dir, "db.sqlite"));
  try {
    db.exec(dump);
    const backup = join(dir, "backup.sql");
    writeFileSync(backup, dump);
    writeFileSync(backup.replace(".sql", ".manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), databaseHash: hash(url), sha256: hash(dump), sizeBytes: Buffer.byteLength(dump), tables: 1, totalRows: 1 }));
    const run = (...args: string[]) => execFileSync(process.execPath, [resolve("scripts/crm-board-indexes.mjs"), ...args], { env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    const preview = JSON.parse(run("preview"));
    expect(preview.missing).toHaveLength(6);
    expect(() => run("apply", `--backup=${backup}`)).toThrow();
    const args = ["apply", `--backup=${backup}`, `--confirm=${preview.fingerprint}`, `--receipt=${join(dir, "receipt.json")}`];
    expect(JSON.parse(run(...args))).toMatchObject({ before: 1, after: 1, createdNow: preview.missing });
    expect(JSON.parse(run(...args)).createdNow).toEqual([]);
    expect(JSON.parse(run("verify")).complete).toBe(true);
    db.exec('DROP INDEX BpmCard_board_status_idx; CREATE UNIQUE INDEX BpmCard_board_status_idx ON BpmCard(status);');
    expect(() => run("preview")).toThrow();
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
