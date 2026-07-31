import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

function verificarEmailServiceAccount(env) {
  const value = env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  return Boolean(
    value && /^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/.test(value),
  );
}

function verificarChavePrivada(env) {
  const value = env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY;
  return Boolean(value?.replace(/\\n/g, "\n").includes("BEGIN PRIVATE KEY"));
}

async function main() {
  const { lerAgendaAlphaRuntimeConfig } = await import(
    "../src/lib/google-calendar/runtime-config.ts"
  );
  const runtime = lerAgendaAlphaRuntimeConfig(process.env);
  const dwd = {
    serviceAccountEmailConfigured: verificarEmailServiceAccount(process.env),
    privateKeyConfigured: verificarChavePrivada(process.env),
  };
  const report = {
    ok:
      runtime.valid &&
      dwd.serviceAccountEmailConfigured &&
      dwd.privateKeyConfigured,
    runtime: {
      valid: runtime.valid,
      distributedLockEnabled: runtime.distributedLockEnabled,
      queueEnabled: runtime.queueEnabled,
      pushEnabled: runtime.pushEnabled,
      publicWebhookConfigured: Boolean(runtime.webhookBaseUrl),
      errors: runtime.errors,
    },
    dwd,
    secretsPrinted: false,
  };
  console.info(JSON.stringify(report, null, 2));
  process.exitCode = runtime.valid ? (report.ok ? 0 : 1) : 2;
}

await main();
