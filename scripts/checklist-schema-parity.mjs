#!/usr/bin/env node
// Static contract verification only; no environment, datasource or Prisma connection is loaded.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function verifyChecklistSchema(schemaPath, contractPath, panelSchemaPath) {
  const schema = await readFile(schemaPath, "utf8");
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const sha256 = createHash("sha256").update(schema).digest("hex");
  if (sha256 !== contract.schemaSha256) throw new Error("CHECKLIST_SCHEMA_CONTRACT_DIVERGED");
  if (panelSchemaPath && schema !== await readFile(panelSchemaPath, "utf8")) throw new Error("CHECKLIST_PANEL_PORTAL_SCHEMA_DIVERGED");
  return { valid: true, schemaSha256: sha256, statusCount: contract.statuses.length, legacyStatuses: contract.legacyStatuses, mode: "static-no-database" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== "--panel-schema")) throw new Error("INVALID_ARGUMENTS");
    console.info(JSON.stringify(await verifyChecklistSchema(fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url)), fileURLToPath(new URL("../prisma/checklist-schema.contract.json", import.meta.url)), args[1]), null, 2));
  } catch { console.error(JSON.stringify({ valid: false, code: "CHECKLIST_SCHEMA_PARITY_FAILED" })); process.exitCode = 1; }
}
