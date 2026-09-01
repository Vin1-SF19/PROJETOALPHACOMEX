import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [dumpPathArg, manifestPathArg] = process.argv.slice(2);
if (!dumpPathArg || !manifestPathArg) {
  throw new Error("Uso: node scripts/verify-turso-backup.mjs <dump.sql> <manifest.json>");
}

const dumpPath = path.resolve(dumpPathArg);
const manifestPath = path.resolve(manifestPathArg);
const restoreDirectory = await mkdtemp(path.join(os.tmpdir(), "painelalpha-vault-check."));
const restorePath = path.join(restoreDirectory, "restore.db");
const db = new DatabaseSync(restorePath);

try {
  const dump = await readFile(dumpPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sha256 = createHash("sha256").update(dump).digest("hex");
  if (sha256 !== manifest.sha256) throw new Error("SHA-256 divergente");
  if (dump.length !== manifest.sizeBytes) throw new Error("Tamanho divergente");

  db.exec(dump.toString("utf8"));
  const integrity = db.prepare("PRAGMA integrity_check").get();
  const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
  const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  let totalRows = 0;
  for (const { name } of tables) {
    const quoted = `"${String(name).replaceAll('"', '""')}"`;
    const count = db.prepare(`SELECT count(*) AS n FROM ${quoted}`).get();
    totalRows += Number(count.n);
  }

  if (integrity.integrity_check !== "ok") {
    throw new Error("PRAGMA integrity_check falhou");
  }
  if (foreignKeys.length !== 0) {
    throw new Error("PRAGMA foreign_key_check encontrou violações");
  }
  if (tables.length !== manifest.tables) {
    throw new Error("Quantidade de tabelas divergente");
  }
  if (totalRows !== manifest.totalRows) {
    throw new Error("Quantidade de linhas divergente");
  }

  console.info(JSON.stringify({
    verified: true,
    sha256,
    sizeBytes: dump.length,
    tables: tables.length,
    totalRows,
  }));
} finally {
  db.close();
  await rm(restoreDirectory, { recursive: true, force: true });
}
