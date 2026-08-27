import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { readFile } from "node:fs/promises";

config({ path: ".env.local" });

const migrationPath = process.argv[2];
if (!migrationPath) throw new Error("Informe o caminho da migration SQL.");

const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!rawUrl || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const sql = await readFile(migrationPath, "utf8");
const statements = sql
  .replace(/^--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean)
  .map((statement) => ({ sql: statement }));

const client = createClient({
  url: rawUrl.replace(/^libsql:\/\//, "https://"),
  authToken,
});

await client.batch(statements, "write");
console.info(JSON.stringify({ applied: migrationPath, statements: statements.length }));
await client.close();
