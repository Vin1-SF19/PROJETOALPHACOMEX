import "dotenv/config";
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const tursoUrl = (process.env.TURSO_DATABASE_URL ?? "").replace(/^libsql:\/\//, "https://");
const client = createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });

const tablesRes = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations' ORDER BY name"
);
const tables = tablesRes.rows.map((r) => String(r.name));

let sql = "-- PainelAlpha Turso backup (pre-change: roadmap-completion-report)\n";
sql += `-- Gerado em ${new Date().toISOString()}\n`;
sql += "PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n\n";

let totalRows = 0;
for (const table of tables) {
  const schemaRes = await client.execute(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [table]);
  const createSql = schemaRes.rows[0]?.sql;
  if (!createSql) continue;
  sql += `DROP TABLE IF EXISTS "${table}";\n${createSql};\n`;

  const dataRes = await client.execute(`SELECT * FROM "${table}"`);
  for (const row of dataRes.rows) {
    const cols = Object.keys(row);
    const vals = cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number" || typeof v === "bigint") return String(v);
      if (v instanceof ArrayBuffer || v instanceof Uint8Array) return "X'" + Buffer.from(v).toString("hex") + "'";
      return "'" + String(v).replace(/'/g, "''") + "'";
    });
    sql += `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${vals.join(",")});\n`;
    totalRows++;
  }
  sql += "\n";
}

sql += "COMMIT;\nPRAGMA foreign_keys=ON;\n";

const ts = new Date().toISOString().replace(/[:.]/g, "-");
const base = `painelalpha_turso_pre_change_roadmap-completion-report_${ts}`;
const sqlPath = `database-backups/pre-change/${base}.sql`;
writeFileSync(sqlPath, sql, "utf8");

const hash = createHash("sha256").update(sql).digest("hex");
const manifest = {
  generatedAt: new Date().toISOString(),
  reason: "pre-change: RoadmapObjective.completionReportMarkdown/completionReportGeneratedAt",
  tables: tables.length,
  totalRows,
  sha256: hash,
  sizeBytes: Buffer.byteLength(sql, "utf8"),
};
writeFileSync(`database-backups/pre-change/${base}.manifest.json`, JSON.stringify(manifest, null, 2), "utf8");

console.log("BACKUP OK");
console.log(JSON.stringify(manifest, null, 2));
console.log("Arquivo:", sqlPath);

await client.close();
