#!/usr/bin/env node
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const STAGING_ORIGIN = "https://staging.alpha-comex.com";
export const WORKER_PATH = "/api/checklist/jobs/eventos";
export const STAGING_DATABASE_SHA256 = "7fdd160737ba6f9cf84d0ac2fb1c3cf1084311e7fccea454f7bac368f9e4d42b";
const RELEASE_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const MAX_RESPONSE_BYTES = 4096;
const TIMEOUT_MS = 30000;
let inFlight = false;
const failure = (code) => ({ ok: false, code });

export function validateStagingConfig(env) {
  if (env.CHECKLIST_TARGET_ENVIRONMENT !== "staging" || env.CHECKLIST_PANEL_ORIGIN !== STAGING_ORIGIN)
    return "STAGING_TARGET_REQUIRED";
  // This runner never connects to a DB. Pin the verified deployment attestation,
  // rather than importing database credentials into the scheduler process.
  if (env.CHECKLIST_STAGING_DATABASE_SHA256 !== STAGING_DATABASE_SHA256)
    return "STAGING_FINGERPRINT_MISMATCH";
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(env.CHECKLIST_WORKER_SECRET ?? "") || /REPLACE|CHANGE_ME|EXAMPLE/.test(env.CHECKLIST_WORKER_SECRET))
    return "WORKER_SECRET_INVALID";
  if (env.CHECKLIST_VERCEL_PROTECTION_BYPASS && !/^[A-Za-z0-9._~-]{16,512}$/.test(env.CHECKLIST_VERCEL_PROTECTION_BYPASS))
    return "BYPASS_SECRET_INVALID";
  return null;
}

export async function loadStagingConfig(envPath) {
  if (!path.isAbsolute(envPath ?? "") || path.basename(envPath) !== ".env.staging.local")
    throw new Error("STAGING_ENV_FILE_REQUIRED");
  const absolute = path.resolve(envPath);
  if (absolute.startsWith(RELEASE_ROOT)) throw new Error("ENV_MUST_BE_OUTSIDE_RELEASE");
  const file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || (info.mode & 0o777) !== 0o600 || info.size > 65536)
      throw new Error("ENV_FILE_MUST_BE_REGULAR_0600");
    const env = parse(await file.readFile("utf8"));
    const error = validateStagingConfig(env);
    if (error) throw new Error(error);
    return env;
  } finally { await file.close(); }
}

async function readProcessed(response) {
  if (response.headers.get("content-type")?.split(";")[0].trim() !== "application/json" || !response.body)
    throw new Error("WORKER_RESPONSE_INVALID");
  const reader = response.body.getReader();
  let total = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error("WORKER_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!Number.isSafeInteger(result.processed) || result.processed < 0 || result.processed > 50)
      throw new Error("WORKER_RESPONSE_INVALID");
    return result.processed;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function runStagingWorker(env, { dryRun = false, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const invalid = validateStagingConfig(env);
  if (invalid) return failure(invalid);
  if (dryRun) return { ok: true, mode: "dry-run", origin: STAGING_ORIGIN, path: WORKER_PATH, method: "POST", networkRequests: 0 };
  if (inFlight) return failure("WORKER_ALREADY_RUNNING");
  inFlight = true;
  const controller = new AbortController();
  let timer;
  try {
    const headers = { authorization: `Bearer ${env.CHECKLIST_WORKER_SECRET}` };
    if (env.CHECKLIST_VERCEL_PROTECTION_BYPASS) headers["x-vercel-protection-bypass"] = env.CHECKLIST_VERCEL_PROTECTION_BYPASS;
    const request = (async () => {
      const response = await fetchImpl(STAGING_ORIGIN + WORKER_PATH, { method: "POST", headers, redirect: "error", signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        return { ...failure("WORKER_HTTP_FAILED"), status: response.status };
      }
      return { ok: true, mode: "once", processed: await readProcessed(response) };
    })();
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("WORKER_TIMEOUT")); }, Math.min(TIMEOUT_MS, Math.max(1, timeoutMs)));
    });
    return await Promise.race([request, deadline]);
  } catch (error) {
    const safe = ["WORKER_TIMEOUT", "WORKER_RESPONSE_INVALID", "WORKER_RESPONSE_TOO_LARGE"];
    return failure(safe.includes(error?.message) ? error.message : "WORKER_REQUEST_FAILED");
  } finally { clearTimeout(timer); controller.abort(); inFlight = false; }
}

export async function main(args) {
  // Default is dry-run. Actual publishing requires the explicit --once flag.
  if (args.length !== 3 || !["--once", "--dry-run", "--check"].includes(args[0]) || args[1] !== "--env-file")
    return failure("USAGE_ONCE_OR_DRY_RUN_ENV_FILE");
  try {
    return await runStagingWorker(await loadStagingConfig(args[2]), { dryRun: args[0] !== "--once" });
  } catch (error) {
    const safe = ["STAGING_ENV_FILE_REQUIRED", "ENV_MUST_BE_OUTSIDE_RELEASE", "ENV_FILE_MUST_BE_REGULAR_0600", "STAGING_TARGET_REQUIRED", "STAGING_FINGERPRINT_MISMATCH", "WORKER_SECRET_INVALID", "BYPASS_SECRET_INVALID"];
    return failure(safe.includes(error?.message) ? error.message : "STAGING_CONFIG_UNREADABLE");
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await main(process.argv.slice(2));
  console.info(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
