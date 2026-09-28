import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios em .env.local.");
}

const client = createClient({ url, authToken });

const statements = [
  `UPDATE "BpmEtapa" SET "chave" = 'solicitacao_contrato', "updatedAt" = CURRENT_TIMESTAMP WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' AND "id" = 'draft-stage-92d707af-9b90-4f71-a9be-58ec7fbe98f8' AND ("chave" IS NULL OR "chave" = 'solicitacao_contrato')`,
  `UPDATE "BpmEtapa" SET "chave" = 'elaboracao_contrato', "updatedAt" = CURRENT_TIMESTAMP WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' AND "id" = 'draft-stage-945a9c43-8226-48bd-b3c6-65dd5fa79396' AND ("chave" IS NULL OR "chave" = 'elaboracao_contrato')`,
  `UPDATE "BpmEtapa" SET "chave" = 'formalizacao_contratacao', "updatedAt" = CURRENT_TIMESTAMP WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' AND "id" = 'draft-stage-9a44c118-2739-42d3-a4f2-4e8ab7428381' AND ("chave" IS NULL OR "chave" = 'formalizacao_contratacao')`,
  `UPDATE "BpmEtapa" SET "chave" = 'confirmacao_pagamento', "updatedAt" = CURRENT_TIMESTAMP WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' AND "id" = 'draft-stage-ab724cf1-fd9b-4ddb-a0ba-9fbd132df5ea' AND ("chave" IS NULL OR "chave" = 'confirmacao_pagamento')`,
  `UPDATE "BpmEtapa" SET "chave" = 'emissao_nota_fiscal', "updatedAt" = CURRENT_TIMESTAMP WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' AND "id" = 'draft-stage-66b7d19c-b953-4687-baff-0e529e082d4c' AND ("chave" IS NULL OR "chave" = 'emissao_nota_fiscal')`,
  `UPDATE "BpmEtapa" SET "chave" = 'contratacao_finalizada', "updatedAt" = CURRENT_TIMESTAMP WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' AND "id" = 'draft-stage-61b69302-cf10-4be3-a537-93fc253e246e' AND ("chave" IS NULL OR "chave" = 'contratacao_finalizada')`,
];

const results = [];
for (const sql of statements) {
  const result = await client.execute(sql);
  results.push({ rowsAffected: result.rowsAffected });
}
console.info(JSON.stringify({ changes: results }));

const check = await client.execute(
  `SELECT id, nome, chave, ativo, ordem FROM "BpmEtapa" WHERE "pipelineId" = 'cmuih4i54000209gmmyqrg557' ORDER BY ordem, id`
);
console.info(JSON.stringify(check.rows, null, 2));

await client.close();
