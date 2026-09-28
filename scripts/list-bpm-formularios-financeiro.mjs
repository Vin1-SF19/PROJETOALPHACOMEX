import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const client = createClient({ url, authToken });

const formularios = await client.execute(
  `SELECT "BpmEtapaFormulario".id, "BpmEtapaFormulario".etapaId, "BpmEtapaFormulario".versao, "BpmEtapaFormulario".ativo, "BpmEtapa".nome as etapa_nome
   FROM "BpmEtapaFormulario"
   JOIN "BpmEtapa" ON "BpmEtapa".id = "BpmEtapaFormulario".etapaId
   WHERE "BpmEtapa".pipelineId = 'cmuih4i54000209gmmyqrg557'
   ORDER BY "BpmEtapa".ordem, "BpmEtapaFormulario".versao`
);

console.info(JSON.stringify(formularios.rows, null, 2));
await client.close();
