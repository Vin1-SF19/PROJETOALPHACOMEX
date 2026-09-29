/** Backup lógico completo pelo mesmo transporte HTTP do Prisma. Somente leitura. */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
(process.env as Record<string, string>).NODE_ENV = "production";
const { default: db } = await import("../src/lib/prisma");
if (!process.env.TURSO_DATABASE_URL?.startsWith("libsql://")) throw new Error("Turso remoto obrigatório");
const reason = process.argv.slice(2).join(" ").trim();
if (!reason) throw new Error("Informe o motivo do backup");

type SchemaRow = { type: string; name: string; sql: string };
const qi = (value: string) => `"${value.replaceAll('"', '""')}"`;
const qv = (value: unknown, blob = false): string => {
  if (value === null || value === undefined) return "NULL";
  if (blob) return `X'${String(value)}'`;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) return `X'${Buffer.from(value).toString("hex")}'`;
  if (value instanceof Date) return `'${value.toISOString().replaceAll("'", "''")}'`;
  return `'${String(value).replaceAll("'", "''")}'`;
};

const dump = await db.$transaction(async (tx) => {
  const schema = await tx.$queryRawUnsafe<SchemaRow[]>(`SELECT type, name, sql FROM sqlite_master
    WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index','trigger','view')
    ORDER BY CASE type WHEN 'table' THEN 1 WHEN 'view' THEN 2 WHEN 'index' THEN 3 ELSE 4 END, name`);
  const tables = schema.filter((row) => row.type === "table");
  const chunks = ["-- PainelAlpha Turso backup via Prisma HTTP (read-only).", `-- Reason: ${reason}`,
    `-- Generated at: ${new Date().toISOString()}`, "PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
  for (const row of tables) chunks.push(`${row.sql};`);
  let totalRows = 0;
  for (const [index, table] of tables.entries()) {
    const colunas = await tx.$queryRawUnsafe<Array<{ name: string; type: string }>>(`PRAGMA table_info(${qi(table.name)})`);
    const blobs = new Set(colunas.filter((coluna) => /BLOB/i.test(coluna.type)).map((coluna) => coluna.name));
    const select = colunas.map((coluna) => blobs.has(coluna.name)
      ? `CASE WHEN ${qi(coluna.name)} IS NULL THEN NULL ELSE hex(${qi(coluna.name)}) END AS ${qi(coluna.name)}`
      : qi(coluna.name)).join(", ");
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT ${select} FROM ${qi(table.name)}`);
    totalRows += rows.length;
    for (const row of rows) {
      const columns = Object.keys(row);
      if (columns.length) chunks.push(`INSERT INTO ${qi(table.name)} (${columns.map(qi).join(", ")}) VALUES (${columns.map((column) => qv(row[column], blobs.has(column))).join(", ")});`);
    }
    if ((index + 1) % 50 === 0) console.info(`backup: ${index + 1}/${tables.length} tabelas`);
  }
  for (const row of schema.filter((row) => row.type !== "table")) chunks.push(`${row.sql};`);
  chunks.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");
  return { content: chunks.join("\n"), tables: tables.length, totalRows };
}, { maxWait: 20_000, timeout: 600_000 });

const timestamp = new Date().toISOString().replaceAll(":", "-").replace(".", "-");
const directory = path.resolve("database-backups/pre-change");
await mkdir(directory, { recursive: true });
const base = path.join(directory, `painelalpha_turso_pre_change_${timestamp}`);
const sha256 = createHash("sha256").update(dump.content).digest("hex");
const sizeBytes = Buffer.byteLength(dump.content);
const generatedAt = new Date().toISOString();
await writeFile(`${base}.sql`, dump.content, { flag: "wx", mode: 0o600 });
await writeFile(`${base}.manifest.json`, `${JSON.stringify({ generatedAt, reason, tables: dump.tables,
  totalRows: dump.totalRows, sha256, sizeBytes }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.info(JSON.stringify({ dumpPath: `${base}.sql`, manifestPath: `${base}.manifest.json`,
  tables: dump.tables, totalRows: dump.totalRows, sha256, sizeBytes }));
await db.$disconnect();
