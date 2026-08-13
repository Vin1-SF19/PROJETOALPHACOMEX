// Script pontual de LEITURA PURA — diagnóstico urgente: BpmCard.empresaId
// órfão (Cliente inexistente) causando erro em produção/dev do painel.
// Deletado após uso.

import { createClient } from "@libsql/client/web";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = { ...loadEnv(join(__dirname, ".env")), ...loadEnv(join(__dirname, ".env.local")) };
const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

if (!env.TURSO_DATABASE_URL.includes("basetestes")) {
  console.error("ABORTADO: TURSO_DATABASE_URL não aponta para o banco de testes!");
  process.exit(1);
}

async function main() {
  console.log(`Banco: ${env.TURSO_DATABASE_URL}\n`);

  const totalCards = await client.execute("SELECT COUNT(*) as n FROM BpmCard");
  console.log(`Total de BpmCard: ${totalCards.rows[0].n}`);

  const orfaos = await client.execute(`
    SELECT bc.id, bc.empresaId, bc.pipelineId, bc.createdAt
    FROM BpmCard bc
    LEFT JOIN Cliente c ON c.id = bc.empresaId
    WHERE c.id IS NULL
    ORDER BY bc.createdAt DESC
  `);
  console.log(`\nBpmCard com empresaId órfão (sem Cliente correspondente): ${orfaos.rows.length}`);
  for (const row of orfaos.rows.slice(0, 20)) {
    console.log(`  card=${row.id} empresaId=${row.empresaId} pipelineId=${row.pipelineId} createdAt=${row.createdAt}`);
  }

  if (orfaos.rows.length > 0) {
    const empresaIdsOrfaos = [...new Set(orfaos.rows.map((r) => r.empresaId))];
    console.log(`\nempresaId distintos órfãos: ${empresaIdsOrfaos.join(", ")}`);

    // Confere se esses IDs existem em `clientes` (legado) — pode ser resquício
    // de um backfill que não rodou, ou um card criado DEPOIS do backfill.
    for (const id of empresaIdsOrfaos) {
      const emClientes = await client.execute({ sql: "SELECT id, cnpj, razaoSocial FROM clientes WHERE id = ?", args: [id] });
      console.log(`  empresaId=${id} existe em 'clientes' (legado)? ${emClientes.rows.length > 0 ? JSON.stringify(emClientes.rows[0]) : "NÃO"}`);
    }
  }

  const maxClienteId = await client.execute("SELECT MAX(id) as maxId FROM Cliente");
  console.log(`\nMaior id em Cliente: ${maxClienteId.rows[0].maxId}`);
}

main().catch((err) => {
  console.error("Falha:", err);
  process.exit(1);
});
