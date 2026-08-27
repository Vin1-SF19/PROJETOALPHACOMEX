import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local" });

const reason = process.argv.slice(2).join(" ").trim() || "pre-change";
const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!rawUrl || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const client = createClient({
  url: rawUrl.replace(/^libsql:\/\//, "https://"),
  authToken,
});

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

const schema = await client.execute({
  sql: `SELECT type, name, tbl_name AS tableName, sql
        FROM sqlite_master
        WHERE sql IS NOT NULL
          AND name NOT LIKE 'sqlite_%'
          AND type IN ('table', 'index', 'trigger', 'view')
        ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'view' THEN 2 WHEN 'index' THEN 3 ELSE 4 END, name`,
});

const chunks = [
  "-- PainelAlpha logical backup generated through @libsql/client (read-only).",
  `-- Reason: ${reason.replaceAll("\n", " ")}`,
  `-- Generated at: ${new Date().toISOString()}`,
  "PRAGMA foreign_keys=OFF;",
  "BEGIN TRANSACTION;",
];

const tables = schema.rows.filter((row) => row.type === "table");
for (const row of tables) {
  chunks.push(`${row.sql};`);
}

const selectStatements = tables.map((table) => ({
  sql: `SELECT * FROM ${quoteIdentifier(table.name)}`,
}));
const rowsByTable = [];
for (let offset = 0; offset < selectStatements.length; offset += 24) {
  const batch = await client.batch(selectStatements.slice(offset, offset + 24), "deferred");
  rowsByTable.push(...batch);
}

let totalRows = 0;
for (const [index, table] of tables.entries()) {
  const rowsResult = rowsByTable[index];
  const columns = rowsResult.columns.map((column) => column.name);
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
