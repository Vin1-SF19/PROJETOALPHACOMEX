#!/usr/bin/env node
import { createClient } from "@libsql/client";
import { parse } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { artifacts, assertApplyGates, applyPrepared, buildPlan, diagnose, hash, migrationShape } from "./lib.mjs";

const HELP = `Uso: node scripts/checklist-analistas/cli.mjs [plan|diagnose|validate|rollback] [opções]
  --operation schema|bootstrap-modelos|limpar-teste|storage-legado (default: schema)
  --env-file /caminho/.env.staging.local  (única fonte remota permitida, explícita)
  --database-url file:/tmp/fixture.db    (somente leitura de fixture local)
  --apply --consent arquivo.json --vault arquivo.json --backup dump.sql --manifest manifesto.json
Sem --apply: somente leitura/planejamento, nunca carrega .env.local automaticamente.
Aplicar exige staging/fingerprint comprovados, Vault, consentimento específico e restauração de backup válido <=48h.
storage-legado e rollback não possuem execução automática.`;

function parseArgs(args) {
  const result = { command: "plan", operation: "schema", apply: false };
  if (args[0] && !args[0].startsWith("--")) result.command = args.shift();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help") return { help: true };
    if (arg === "--apply") { result.apply = true; continue; }
    if (!["--operation", "--env-file", "--database-url", "--consent", "--vault", "--backup", "--manifest"].includes(arg) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error("ARGUMENTO_INVALIDO");
    result[arg.slice(2)] = args[++index];
  }
  if (!["plan", "diagnose", "validate", "rollback"].includes(result.command)) throw new Error("COMANDO_INVALIDO");
  if (result.apply && result.command !== "plan") throw new Error("APPLY_SOMENTE_COM_PLANO");
  return result;
}

let client;
try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.info(HELP); process.exitCode = 0; }
  else if (options.command === "rollback") {
    if (options.apply) throw new Error("ROLLBACK_MANUAL_VAULT_OBRIGATORIO");
    console.info(JSON.stringify({ operation: "rollback", executed: false, strategy: "Manter schema aditivo; reverter somente código compatível com hash/snapshots/eventos. Restauração de backup exige novo plano Vault/consentimento e janela de manutenção. Nunca DROP automático.", requiresBackup: true, mutations: 0 }, null, 2));
  } else {
    let env = {};
    let url = options["database-url"];
    if (options["env-file"]) {
      if (url || path.basename(options["env-file"]) !== ".env.staging.local") throw new Error("FONTE_AMBIENTE_INVALIDA");
      env = parse(await readFile(path.resolve(options["env-file"])));
      url = env.TURSO_DATABASE_URL;
      if (env.CHECKLIST_TARGET_ENVIRONMENT !== "staging" || env.CHECKLIST_PANEL_ORIGIN !== "https://staging.alpha-comex.com" || !url || env.CHECKLIST_STAGING_DATABASE_SHA256 !== hash(url)) throw new Error("AMBIENTE_STAGING_NAO_COMPROVADO");
    } else if (url && !/^file:\/tmp\//.test(url)) throw new Error("URL_EXPLICITA_SOMENTE_FIXTURE_TMP");
    if (options.apply && !options["env-file"]) throw new Error("APPLY_EXIGE_ENV_STAGING_EXPLICITO");
    if (!url && options.command === "plan" && options.operation === "schema" && !options.apply) {
      const art = await artifacts();
      console.info(JSON.stringify({ ...(await buildPlan("schema")), mode: "dry-run", connected: false, shape: migrationShape(art.migration), gates: ["diagnóstico staging", "Vault", "backup completo restaurado <=48h", "consentimento específico"], mutations: 0 }, null, 2));
    } else {
      if (!url) throw new Error("BANCO_EXPLICITO_OBRIGATORIO");
      client = createClient({ url, authToken: env.TURSO_AUTH_TOKEN });
      const diagnostic = await diagnose(client);
      if (options.command === "diagnose" || options.command === "validate") {
        console.info(JSON.stringify({ ...diagnostic, databaseFingerprint: hash(url), mode: "read-only" }, null, 2));
        if (diagnostic.blockers.length || (options.command === "validate" && diagnostic.state !== "APPLIED")) process.exitCode = 2;
      } else {
        if (!diagnostic.canonical) throw new Error("LAYOUT_MASTER_INCOMPATIVEL");
        const plan = await buildPlan(options.operation, client);
        if (!options.apply) console.info(JSON.stringify({ ...plan, databaseFingerprint: hash(url), diagnostic, mode: "dry-run", mutations: 0 }, null, 2));
        else {
          const verified = await assertApplyGates({ environment: env.CHECKLIST_TARGET_ENVIRONMENT, panelOrigin: env.CHECKLIST_PANEL_ORIGIN, databaseUrl: url, stagingFingerprint: env.CHECKLIST_STAGING_DATABASE_SHA256, operation: options.operation, planSha256: plan.planSha256, consentPath: options.consent, vaultPath: options.vault, backupPath: options.backup, manifestPath: options.manifest });
          console.info(JSON.stringify(await applyPrepared(client, options.operation, plan.planSha256, verified), null, 2));
        }
      }
    }
  }
} catch (error) {
  // Library errors may embed SQL, credentials or payloads. Only fixed local codes escape.
  const message = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : "OPERACAO_FALHOU_CONSULTE_EVIDENCIA_LOCAL_SEGURA";
  console.error(JSON.stringify({ ok: false, code: message, mutationsConfirmed: false }));
  process.exitCode = 1;
} finally { client?.close(); }
