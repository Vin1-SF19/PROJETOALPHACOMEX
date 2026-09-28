import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const client = createClient({ url, authToken });

const sql = `
UPDATE "BpmPipeline"
SET "chave" = 'financeiro',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'cmuih4i54000209gmmyqrg557'
  AND ("chave" IS NULL OR "chave" = 'financeiro');
`;

const result = await client.execute(sql);
console.info(JSON.stringify({ changes: result.rowsAffected }));

const check = await client.execute(
  `SELECT id, nome, chave, ativo, configVersion, updatedAt FROM "BpmPipeline" WHERE id = 'cmuih4i54000209gmmyqrg557'`
);
console.info(JSON.stringify(check.rows[0] ?? null));

await client.close();
