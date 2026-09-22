import { createClient } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const APPLY_CONFIRMATION = "RM-2026-MERGED-4";
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const rawUrl = process.env.TURSO_DATABASE_URL ?? "";
const authToken = process.env.TURSO_AUTH_TOKEN ?? "";

if (!rawUrl || !authToken) throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios.");
const host = new URL(rawUrl.replace(/^libsql:\/\//, "https://")).hostname;
if (!host.endsWith(".turso.io")) throw new Error(`Host remoto não autorizado: ${host}`);
if (apply && confirmation !== APPLY_CONFIRMATION) {
  throw new Error(`Aplicação bloqueada. Use --apply --confirm=${APPLY_CONFIRMATION} após aprovação Vault.`);
}

const client = createClient({ url: rawUrl.replace(/^libsql:\/\//, "https://"), authToken });

const approvedEmptyCatalogs = [
  { pipeline: "Financeiro", field: "Status da assinatura", options: ["Pendente", "Enviada", "Assinada", "Recusada"] },
  { pipeline: "Financeiro", field: "Status do contrato", options: ["Em elaboração", "Aguardando aprovação", "Aguardando assinatura", "Assinado", "Cancelado"] },
  { pipeline: "Financeiro", field: "Status financeiro", options: ["Pendente", "Faturado", "Pago", "Inadimplente", "Cancelado"] },
  { pipeline: "Operacional", field: "Andamento/status atual", options: ["Não iniciado", "Em andamento", "Aguardando cliente", "Aguardando órgão", "Concluído", "Bloqueado"] },
  { pipeline: "Operacional", field: "Classificação do motivo", options: ["Documental", "Cadastral", "Fiscal", "Operacional", "Outro"] },
  { pipeline: "Operacional", field: "Motivo do indeferimento/exigência", options: ["Documentação incompleta", "Divergência cadastral", "Pendência fiscal", "Exigência do órgão", "Outro"] },
  { pipeline: "Operacional", field: "Solução adotada", options: ["Complementação documental", "Correção cadastral", "Regularização fiscal", "Recurso/manifestação", "Reprotocolo", "Outro"] },
];

function slug(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "") || "item";
}

function suffix(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 10);
}

function parseOptions(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => typeof item === "string" ? item : item?.rotulo ?? item?.label ?? item?.nome ?? item?.valor)
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim());
  } catch {
    return [];
  }
}

const [fieldsResult, permissionsResult, transitionsResult, oldCardsResult, overdueResult] = await Promise.all([
  client.execute(`
    SELECT c.id, c.nome, c.chave, c.opcoesJson, p.chave AS pipelineChave, p.nome AS pipelineNome,
           (SELECT COUNT(*) FROM BpmCampoOpcao o WHERE o.campoId = c.id) AS structuredCount
    FROM BpmCampo c
    JOIN BpmPipeline p ON p.id = c.pipelineId
    WHERE c.ativo = 1
    ORDER BY p.nome, c.nome, c.id
  `),
  client.execute({
    sql: `SELECT setor, modulo FROM SetorPermissao WHERE modulo = ? AND setor IN (?, ?)`,
    args: ["crm", "COMERCIAL", "OPERACIONAL"],
  }),
  client.execute(`
    SELECT t.id, t.etapaOrigemId, t.etapaDestinoId, t.permitida,
           origem.nome AS origemNome, destino.nome AS destinoNome, p.nome AS pipelineNome
    FROM BpmTransicaoEtapa t
    JOIN BpmEtapa origem ON origem.id = t.etapaOrigemId
    JOIN BpmEtapa destino ON destino.id = t.etapaDestinoId
    JOIN BpmPipeline p ON p.id = t.pipelineId
    WHERE origem.ativo = 0 OR destino.ativo = 0
    ORDER BY p.nome, origem.nome, destino.nome
  `),
  client.execute(`SELECT COUNT(*) AS total FROM BpmCard_old_fixfk`),
  client.execute(`
    SELECT COUNT(*) AS total
    FROM BpmTarefa
    WHERE status = 'PENDENTE' AND prazo IS NOT NULL AND prazo < CURRENT_TIMESTAMP
  `),
]);

const missingKeys = fieldsResult.rows.filter((row) => !row.chave);
const legacyOptions = fieldsResult.rows.flatMap((row) => {
  if (Number(row.structuredCount) > 0) return [];
  const options = parseOptions(row.opcoesJson);
  return options.length ? [{ ...row, options }] : [];
});
const existingPermissions = new Set(permissionsResult.rows.map((row) => row.setor));
const missingPermissions = ["COMERCIAL", "OPERACIONAL"].filter((setor) => !existingPermissions.has(setor));
const approvedCatalogTargets = approvedEmptyCatalogs.map((catalog) => {
  const field = fieldsResult.rows.find((row) => row.pipelineNome === catalog.pipeline && row.nome === catalog.field);
  if (!field) throw new Error(`Campo aprovado não encontrado: ${catalog.pipeline} / ${catalog.field}`);
  if (Number(field.structuredCount) > 0) return { ...catalog, id: field.id, alreadyConfigured: true };
  return { ...catalog, id: field.id, alreadyConfigured: false };
});

const plan = {
  environment: "production",
  host,
  mode: apply ? "apply" : "dry-run",
  fieldKeysToBackfill: missingKeys.map((row) => ({
    id: row.id,
    name: row.nome,
    key: `custom.${slug(row.pipelineChave ?? row.pipelineNome)}.${slug(row.nome)}.${suffix(row.id)}`,
  })),
  legacyOptionCatalogsToMigrate: legacyOptions.map((row) => ({ id: row.id, name: row.nome, count: row.options.length })),
  approvedEmptyCatalogsToPopulate: approvedCatalogTargets.map((row) => ({ id: row.id, pipeline: row.pipeline, name: row.field, count: row.options.length, alreadyConfigured: row.alreadyConfigured })),
  modulePermissionsToGrant: missingPermissions.map((setor) => ({ setor, modulo: "crm" })),
  inactiveStageTransitionsToRemove: transitionsResult.rows.map((row) => ({
    id: row.id,
    pipeline: row.pipelineNome,
    from: row.origemNome,
    to: row.destinoNome,
    permitted: Boolean(row.permitida),
  })),
  oldCardsPreserved: Number(oldCardsResult.rows[0]?.total ?? 0),
  overduePendingTasksAtSnapshot: Number(overdueResult.rows[0]?.total ?? 0),
};

console.info(JSON.stringify(plan, null, 2));

if (!apply) {
  console.info(`DRY-RUN: nenhuma escrita executada. Após backup e aprovação: --apply --confirm=${APPLY_CONFIRMATION}`);
  await client.close();
  process.exit(0);
}

const statements = [];
for (const row of plan.fieldKeysToBackfill) {
  statements.push({ sql: `UPDATE BpmCampo SET chave = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND chave IS NULL`, args: [row.key, row.id] });
}
for (const row of legacyOptions) {
  for (const [index, label] of row.options.entries()) {
    const key = `${slug(label)}.${suffix(`${row.id}:${label}`)}`;
    statements.push({
      sql: `INSERT OR IGNORE INTO BpmCampoOpcao (id, campoId, chave, rotulo, ordem, ativo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [randomUUID(), row.id, key, label, index],
    });
  }
}
for (const row of approvedCatalogTargets.filter((item) => !item.alreadyConfigured)) {
  statements.push({
    sql: `UPDATE BpmCampo SET opcoesJson = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [JSON.stringify(row.options), row.id],
  });
  for (const [index, label] of row.options.entries()) {
    const key = `${slug(label)}.${suffix(`${row.id}:${label}`)}`;
    statements.push({
      sql: `INSERT OR IGNORE INTO BpmCampoOpcao (id, campoId, chave, rotulo, ordem, ativo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [randomUUID(), row.id, key, label, index],
    });
  }
}
for (const setor of missingPermissions) {
  statements.push({
    sql: `INSERT OR IGNORE INTO SetorPermissao (setor, modulo, createdAt, updatedAt) VALUES (?, 'crm', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [setor],
  });
}
for (const row of transitionsResult.rows) {
  statements.push({ sql: `DELETE FROM BpmTransicaoEtapa WHERE id = ?`, args: [row.id] });
}

const transaction = await client.transaction("write");
try {
  for (let offset = 0; offset < statements.length; offset += 50) {
    await transaction.batch(statements.slice(offset, offset + 50));
  }
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
} finally {
  transaction.close();
}

console.info(JSON.stringify({ applied: true, statements: statements.length, confirmation: APPLY_CONFIRMATION }));
await client.close();
