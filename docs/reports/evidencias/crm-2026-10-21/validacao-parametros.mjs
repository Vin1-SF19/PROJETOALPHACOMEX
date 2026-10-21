import { readFile } from "node:fs/promises";
import { validarParametrosAutomacaoBpm } from "../../../../src/lib/bpm/automacoes/schemas.ts";

// Evidência pura: não lê .env, não conecta banco, não executa workers.
const report = JSON.parse(await readFile(new URL("../../auditoria-fluxo-crm-2026-10-21.json", import.meta.url), "utf8"));
let reproduced = 0;
for (const test of report.schemaChecks) {
  const result = { automationId: test.automationId, actionType: test.actionType };
  try {
    validarParametrosAutomacaoBpm(test.actionType, test.parameters);
    result.acceptedByCurrentLegacySchema = true;
  } catch (error) {
    result.acceptedByCurrentLegacySchema = false;
    result.issues = (error.issues ?? []).map(({path, code}) => ({path: path.join("."), code}));
    reproduced += 1;
  }
  console.log(JSON.stringify(result));
}
console.log(JSON.stringify({checked: report.schemaChecks.length, rejected: reproduced, databaseWrites: 0}));
if (reproduced !== report.schemaChecks.length) process.exitCode = 1;
