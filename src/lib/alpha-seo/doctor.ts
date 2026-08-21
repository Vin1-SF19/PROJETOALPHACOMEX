import { createClient } from "@libsql/client";
import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { buildAlphaSeoSourceManifest } from "./inventory";
import { makeCliResult, type AlphaSeoCheck, type AlphaSeoCliResult } from "./contracts";

type Env = Readonly<Record<string, string | undefined>>;
type MutableEnv = Record<string, string | undefined>;

export function loadAlphaSeoEnvironment(input: {
  cwd?: string;
  processEnv?: MutableEnv;
} = {}): MutableEnv {
  const cwd = input.cwd ?? process.cwd();
  const processEnv = input.processEnv ?? process.env;
  loadDotenv({ path: path.join(cwd, ".env"), processEnv, quiet: true });
  loadDotenv({ path: path.join(cwd, ".env.local"), processEnv, override: true, quiet: true });
  return processEnv;
}

function present(env: Env, key: string): boolean {
  return Boolean(env[key]?.trim());
}

function configCheck(id: string, keys: string[], env: Env, message: string): AlphaSeoCheck {
  const missing = keys.filter((key) => !present(env, key));
  return {
    id,
    ok: missing.length === 0,
    kind: "config",
    message: missing.length === 0 ? message : `Missing required configuration: ${missing.join(", ")}`,
    details: { configured: keys.filter((key) => !missing.includes(key)), missing },
  };
}

function dataForSeoConfigCheck(env: Env): AlphaSeoCheck {
  const apiKey = present(env, "DATAFORSEO_API_KEY");
  const credentials = present(env, "DATAFORSEO_LOGIN") && present(env, "DATAFORSEO_PASSWORD");
  return { id: "config.dataforseo", ok: apiKey || credentials, kind: "config", message: apiKey || credentials ? "DataForSEO is configured" : "Missing required configuration: DATAFORSEO_API_KEY or DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD", details: { configuredMode: apiKey ? "api-key" : credentials ? "login-password" : "none" } };
}

async function probeTurso(env: Env): Promise<AlphaSeoCheck> {
  if (!present(env, "TURSO_DATABASE_URL") || !present(env, "TURSO_AUTH_TOKEN")) {
    return { id: "dependency.turso", ok: false, kind: "config", message: "Turso probe skipped because its configuration is incomplete" };
  }
  const client = createClient({ url: env.TURSO_DATABASE_URL ?? "", authToken: env.TURSO_AUTH_TOKEN });
  try {
    await client.execute("SELECT 1 AS alpha_seo_doctor_read_only");
    return { id: "dependency.turso", ok: true, kind: "dependency", message: "Turso accepted a read-only SELECT 1 probe" };
  } catch {
    return { id: "dependency.turso", ok: false, kind: "dependency", message: "Turso is configured but unavailable to the read-only probe" };
  } finally {
    client.close();
  }
}

export async function runAlphaSeoDoctor(input: {
  sourceRoot: string;
  env?: Env;
  skipNetwork?: boolean;
  timestamp?: string;
}): Promise<AlphaSeoCliResult> {
  const env = input.env ?? process.env;
  const checks: AlphaSeoCheck[] = [
    configCheck("config.turso", ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"], env, "Turso credentials are configured"),
    dataForSeoConfigCheck(env),
    configCheck("config.openrouter", ["OPENROUTER_API_KEY"], env, "OpenRouter is configured"),
    configCheck("config.google-oauth", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY"], env, "Google OAuth and token encryption are configured"),
  ];

  const queueMode = env.ALPHA_SEO_QUEUE_MODE ?? "persistent-db";
  const lockMode = env.ALPHA_SEO_LOCK_MODE ?? "persistent-db";
  const supportedModes = new Set(["fixture-memory", "persistent-db"]);
  checks.push({
    id: "config.queue-locks",
    ok: supportedModes.has(queueMode) && supportedModes.has(lockMode) && queueMode === lockMode,
    kind: "config",
    message: supportedModes.has(queueMode) && queueMode === lockMode ? `${queueMode} queue and locks are selected` : "Queue and lock modes must match a supported implementation",
    details: { queueMode, lockMode },
  });

  try {
    const manifest = await buildAlphaSeoSourceManifest(input.sourceRoot);
    const reconciliation = manifest.mcp.reconciliation;
    checks.push({
      id: "contract.source-manifest",
      ok: true,
      kind: "contract",
      message: `Source manifest parsed (${manifest.source.hash.slice(0, 12)}…, ${manifest.source.hashedFiles} files)`,
      details: { sourceHash: manifest.source.hash, counts: manifest.counts },
    });
    checks.push({
      id: "contract.mcp-source-parity",
      ok: reconciliation.status === "source-authoritative-pass",
      kind: "contract",
      message: reconciliation.note,
      details: {
        source: reconciliation.source,
        ported: reconciliation.ported,
        missing: reconciliation.missing.length,
        unexpected: reconciliation.unexpected.length,
        historicalClaim: reconciliation.historicalClaim,
        historicalUnnamedGap: reconciliation.historicalUnnamedGap,
        historicalGapBlocking: reconciliation.historicalGapBlocking,
      },
    });
  } catch {
    checks.push({ id: "contract.source-manifest", ok: false, kind: "contract", message: "OpenSEO source manifest could not be generated" });
  }

  checks.push(input.skipNetwork
    ? { id: "dependency.turso", ok: true, kind: "dependency", message: "Read-only network probe explicitly skipped" }
    : await probeTurso(env));

  checks.push({ id: "safety.read-only", ok: true, kind: "safety", message: "Doctor performs no writes and returns only presence metadata, never credential values" });
  return makeCliResult({ command: "doctor", checks, timestamp: input.timestamp });
}
