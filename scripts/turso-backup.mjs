import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

config({ path: ".env.local" });

const reason = process.argv.slice(2).join(" ").trim() || "pre-change";
const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!rawUrl || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const replicaDirectory = await mkdtemp(path.join(os.tmpdir(), "painelalpha-vault-replica."));
process.once("exit", () => { rmSync(replicaDirectory, { recursive: true, force: true }); });
const client = createClient({
  url: `file:${path.join(replicaDirectory, "snapshot.db")}`,
  syncUrl: rawUrl,
  authToken,
});
await client.sync();

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function quoteValue(value) {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString("hex")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
}

const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const baseName = `painelalpha_turso_pre_change_${timestamp}`;
const outputDirectory = path.resolve("database-backups", "pre-change");
const dumpPath = path.join(outputDirectory, `${baseName}.sql`);
const manifestPath = path.join(outputDirectory, `${baseName}.manifest.json`);

await mkdir(outputDirectory, { recursive: true });

// A réplica local é sincronizada antes da leitura e oferece um snapshot estável
// sem manter uma transação HTTP remota aberta durante a exportação.
const transaction = await client.transaction("read");
let schema;
let tables;
const rowsByTable = [];
try {
  schema = await transaction.execute({
    sql: `SELECT type, name, tbl_name AS tableName, sql
          FROM sqlite_master
          WHERE sql IS NOT NULL
            AND name NOT LIKE 'sqlite_%'
            AND type IN ('table', 'index', 'trigger', 'view')
          ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'view' THEN 2 WHEN 'index' THEN 3 ELSE 4 END, name`,
  });
  tables = schema.rows.filter((row) => row.type === "table");
  const selectStatements = tables.map((table) => ({
    sql: `SELECT * FROM ${quoteIdentifier(table.name)}`,
  }));
  for (let offset = 0; offset < selectStatements.length; offset += 24) {
    const batch = await transaction.batch(selectStatements.slice(offset, offset + 24));
    rowsByTable.push(...batch);
  }
  await transaction.commit();
} finally {
  transaction.close();
}

const chunks = [
  "-- PainelAlpha logical backup generated through @libsql/client (read-only).",
  `-- Reason: ${reason.replaceAll("\n", " ")}`,
  `-- Generated at: ${new Date().toISOString()}`,
  "PRAGMA foreign_keys=OFF;",
  "BEGIN TRANSACTION;",
];

for (const row of tables) {
  chunks.push(`${row.sql};`);
}

let totalRows = 0;
for (const [index, table] of tables.entries()) {
  const rowsResult = rowsByTable[index];
  // @libsql/client expõe ResultSet.columns como string[]. A implementação
  // anterior lia column.name e serializava literalmente "undefined".
  const columns = rowsResult.columns;
  if (columns.length === 0) continue;

  totalRows += rowsResult.rows.length;
  const columnSql = columns.map(quoteIdentifier).join(", ");
  for (const row of rowsResult.rows) {
    const values = columns.map((column) => quoteValue(row[column])).join(", ");
    chunks.push(`INSERT INTO ${quoteIdentifier(table.name)} (${columnSql}) VALUES (${values});`);
  }
}

for (const row of schema.rows.filter((row) => row.type !== "table")) {
  chunks.push(`${row.sql};`);
}
chunks.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");

const dump = chunks.join("\n");
const sha256 = createHash("sha256").update(dump).digest("hex");
await writeFile(dumpPath, dump, "utf8");
await writeFile(
  manifestPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), reason, tables: tables.length, totalRows, sha256, sizeBytes: Buffer.byteLength(dump) }, null, 2)}\n`,
  "utf8",
);

console.info(JSON.stringify({ dumpPath, manifestPath, tables: tables.length, totalRows, sha256, sizeBytes: Buffer.byteLength(dump) }));
await client.close();
await rm(replicaDirectory, { recursive: true, force: true });
