/** Auditoria somente leitura das FKs diretas dos nove cards da limpeza. */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
const ids = [
  "cmthgb9xr00000akouoqf1cey", "cmtiw4i8o00000ai3b5ib7qfi", "cmtt3rnb900000agmstpk8mnm",
  "cmubkyq3200060agmc41pmoo3", "cmubmxtxh000009gmu5h8pml7", "cmud35kxa00000bgmm139fygr",
  "cmue7xwye000004jqa9dnzq5h", "cmue8390400000agmyg0p2qbu", "cmueb4uv100000agmu1z37b9d",
];
const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";
if (!url || !authToken) throw new Error("Turso não configurado.");
const client = createClient({ url: url.replace(/^libsql:\/\//, "https://"), authToken });
const quote = (name) => `"${String(name).replaceAll('"', '""')}"`;
const tx = await client.transaction("read");
try {
  const tables = await tx.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
  const found = [];
  for (const table of tables.rows) {
    const name = String(table.name);
    const fks = await tx.execute(`PRAGMA foreign_key_list(${quote(name)})`);
    for (const fk of fks.rows) {
      if (String(fk.table) !== "BpmCard") continue;
      const column = String(fk.from);
      const result = await tx.execute({ sql: `SELECT COUNT(*) AS total FROM ${quote(name)} WHERE ${quote(column)} IN (${ids.map(() => "?").join(",")})`, args: ids });
      found.push({ table: name, column, onDelete: String(fk.on_delete), count: Number(result.rows[0].total) });
    }
  }
  console.info(JSON.stringify(found.filter((item) => item.count > 0)));
  await tx.commit();
} finally {
  tx.close();
  await client.close();
}
