import { it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
// @ts-expect-error Node 24 fornece node:sqlite; os tipos atuais do projeto ainda não o declaram.
import { DatabaseSync } from "node:sqlite";
it("adiciona somente a coluna autorizada, preserva dados e reexecuta sem duplicar", () => {
  const dir = mkdtempSync(join(tmpdir(), "crm-equipe-")); const url = `file:${join(dir, "db.sqlite")}`;
  const hash = (v: string) => createHash("sha256").update(v).digest("hex");
  const dump = "CREATE TABLE BpmPipeline (id TEXT PRIMARY KEY, configVersion INTEGER); INSERT INTO BpmPipeline VALUES ('p', 1);";
  const db = new DatabaseSync(join(dir, "db.sqlite"));
  try {
    db.exec(dump); const backup = join(dir, "backup.sql"); writeFileSync(backup, dump);
    writeFileSync(backup.replace(".sql", ".manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), databaseHash: hash(url), sha256: hash(dump), sizeBytes: Buffer.byteLength(dump), tables: 1, totalRows: 1 }));
    const run = (...args: string[]) => execFileSync(process.execPath, [resolve("scripts/crm-pipeline-visao-equipe.mjs"), ...args], { env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "" }, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    const preview = JSON.parse(run("preview")); expect(preview.exists).toBe(false);
    expect(() => run("apply", `--backup=${backup}`)).toThrow();
    const args = ["apply", `--backup=${backup}`, `--confirm=${preview.fingerprint}`, `--receipt=${join(dir, "receipt.json")}`];
    expect(JSON.parse(run(...args))).toMatchObject({ created: true, before: 1, after: 1 });
    expect(JSON.parse(run(...args)).created).toBe(false);
    expect(db.prepare('SELECT * FROM BpmPipeline').get()).toEqual({ id: 'p', configVersion: 1, visualizacaoConfigJson: null });
    expect(JSON.parse(run("verify")).exists).toBe(true);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
