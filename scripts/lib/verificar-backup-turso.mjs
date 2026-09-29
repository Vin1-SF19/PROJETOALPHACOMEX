import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export async function verificarBackupTurso(dumpPathArg, manifestPathArg) {
  const restoreDirectory = await mkdtemp(path.join(os.tmpdir(), "painelalpha-vault-check."));
  const db = new DatabaseSync(path.join(restoreDirectory, "restore.db"));
  try {
    const dump = await readFile(path.resolve(dumpPathArg));
    const manifest = JSON.parse(await readFile(path.resolve(manifestPathArg), "utf8"));
    const sha256 = createHash("sha256").update(dump).digest("hex");
    if (sha256 !== manifest.sha256 || dump.length !== manifest.sizeBytes) throw new Error("Backup e manifesto divergentes");
    db.exec(dump.toString("utf8"));
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Integridade do backup inválida");
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Backup contém violações de chave estrangeira");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    let totalRows = 0;
    for (const { name } of tables) {
      const quoted = `"${String(name).replaceAll('"', '""')}"`;
      totalRows += Number(db.prepare(`SELECT count(*) AS n FROM ${quoted}`).get().n);
    }
    if (tables.length !== manifest.tables || totalRows !== manifest.totalRows) throw new Error("Contagens do backup divergentes");
    return { verified: true, sha256, sizeBytes: dump.length, tables: tables.length, totalRows };
  } finally {
    db.close();
    await rm(restoreDirectory, { recursive: true, force: true });
  }
}
