import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const client = createClient({ url, authToken });

const etapas = await client.execute(
  `SELECT id, nome, chave, ativo, ordem
   FROM "BpmEtapa"
   WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557'
   ORDER BY ordem, id`
);

console.info(JSON.stringify(etapas.rows, null, 2));
await client.close();
