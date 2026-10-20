import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import { hash, stateHash, applyRecoveryBatch } from "./lib/rd-complement-recovery.mjs";
import { buildHistoryPlan, verifyHistoryRollback, verifyNotesV2 } from "./lib/rd-history-reconciliation.mjs";
import { verificarBackupTurso } from "./lib/verificar-backup-turso.mjs";

config({ path: ".env.local", quiet: true });
const mode = process.argv[2] ?? "preview";
const arg = name => process.argv.find(x => x.startsWith(`--${name}=`))?.slice(name.length + 3);
const directory = path.resolve(arg("dir") ?? "database-backups/pre-change/rd-historico-autoria-2026-10-20");
if (!directory.includes("/database-backups/pre-change/")) throw Error("PRIVATE_DIRECTORY_REQUIRED");
const databaseHash = hash(process.env.TURSO_DATABASE_URL ?? "");
const read = async name => JSON.parse(await readFile(path.join(directory, name), "utf8"));
const save = async (name, data) => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, name), JSON.stringify(data, null, 2), { mode: 0o600 });
};
const runtimeHash = async () => hash(await Promise.all(["./reconciliar-historico-autoria-rd.mjs", "./lib/rd-history-reconciliation.mjs", "./lib/rd-complement-recovery.mjs"]
  .map(async file => hash(await readFile(new URL(file, import.meta.url), "utf8")))));

async function backup(file) {
  if (!file || !path.resolve(file).includes("/database-backups/pre-change/")) throw Error("PRE_CHANGE_BACKUP_REQUIRED");
  const manifestFile = file.replace(/\.sql$/, ".manifest.json");
  if (manifestFile === file) throw Error("SQL_BACKUP_REQUIRED");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const age = Date.now() - Date.parse(manifest.generatedAt);
  if (manifest.databaseHash !== databaseHash || !Number.isFinite(age) || age < 0 || age > 48 * 3600000) throw Error("BACKUP_INVALID");
  return { file: path.resolve(file), generatedAt: manifest.generatedAt, ...await verificarBackupTurso(file, manifestFile) };
}

async function restore(file) {
  const temporary = await mkdtemp(path.join(directory, "simulation-"));
  const db = new DatabaseSync(path.join(temporary, "restore.db"));
  try { db.exec(await readFile(file, "utf8")); db.exec("PRAGMA foreign_keys=ON"); }
  catch (error) { db.close(); await rm(temporary, { recursive: true, force: true }); throw error; }
  const statements = new Map();
  const execute = async ({ sql, args = [] }) => {
    let statement = statements.get(sql);
    if (!statement) { statement = db.prepare(sql); statements.set(sql, statement); }
    return statement.columns().length ? { rows: statement.all(...args).map(row => ({ ...row })) } : { rows: [], rowsAffected: Number(statement.run(...args).changes) };
  };
  const batch = async queries => { const results = []; for (const query of queries) results.push(await execute(query)); return results; };
  const adapter = {
    execute, batch,
    transaction: async () => {
      db.exec("BEGIN IMMEDIATE"); let finished = false;
      return { execute, batch, commit: async () => { db.exec("COMMIT"); finished = true; },
        rollback: async () => { if (!finished) { db.exec("ROLLBACK"); finished = true; } }, close: () => { if (!finished) { db.exec("ROLLBACK"); finished = true; } } };
    },
  };
  return { db: adapter, close: async () => { statements.clear(); db.close(); await rm(temporary, { recursive: true, force: true }); } };
}

async function check(db, changes, side) {
  const checks = changes.flatMap(c => c[side]);
  let checked = 0;
  for (let offset = 0; offset < checks.length; offset += 100) {
    const group = checks.slice(offset, offset + 100);
    const result = await db.batch(group.map(({ sql, args }) => ({ sql, args })), "read");
    for (let i = 0; i < group.length; i++) if (stateHash(result[i].rows.map(row => ({ ...row }))) !== group[i].hash) throw Error(`STATE_CHECK_FAILED_${side}_${offset + i}`);
    checked += group.length;
  }
  return { checked, matching: checked };
}

async function run(db, plan, fingerprint, rollback = false) {
  let applied = 0, skipped = 0;
  const changes = rollback ? [...plan.changes].reverse() : plan.changes;
  for (let offset = 0; offset < changes.length; offset += 20) {
    const result = await applyRecoveryBatch(db, changes.slice(offset, offset + 20), fingerprint, rollback);
    applied += result.applied; skipped += result.skipped;
    console.log(JSON.stringify({ phase: rollback ? "rollback" : "apply", processed: Math.min(offset + 20, changes.length), total: changes.length }));
  }
  return { applied, skipped };
}

async function main() {
  if (mode === "preview") {
    const alpha = await read("alpha-snapshot.json"), source = await read("source-v1.json"), usersV2 = await read("users-v2.json"), details = {};
    for (const origin of alpha.origins) details[origin.sourceDealId] = await read(`details-v1/${origin.sourceDealId}.json`);
    const crosscheck = await read("notes-v2-crosscheck.json");
    const sourceHashes = { alpha: hash(alpha), source: hash(source), usersV2: hash(usersV2), details: hash(details), notesV2: hash(crosscheck) };
    const plan = buildHistoryPlan({ alpha, source, usersV2, details, databaseHash, sourceHashes });
    Object.assign(plan.summary, verifyNotesV2({ alpha, source, crosscheck, changes: plan.changes }));
    plan.runtimeHash = await runtimeHash();
    plan.sourceCompletedAt = source.completedAt;
    const fingerprint = hash(plan);
    await save("plan.json", { ...plan, fingerprint });
    await save("preview-summary.json", { fingerprint, ...plan.summary, exceptions: plan.exceptions.reduce((a, e) => { a[e.kind] = (a[e.kind] ?? 0) + 1; return a; }, {}) });
    console.log(JSON.stringify({ fingerprint, ...plan.summary }));
    return;
  }
  if (!["simulate", "apply", "rollback", "verify"].includes(mode)) throw Error("INVALID_MODE");
  const { fingerprint, ...plan } = await read("plan.json");
  if (hash(plan) !== fingerprint || plan.databaseHash !== databaseHash || plan.runtimeHash !== await runtimeHash()) throw Error("PLAN_OR_RUNTIME_CHANGED");
  if (mode === "simulate") {
    const evidence = await backup(arg("backup"));
    const local = await restore(evidence.file);
    try {
      await check(local.db, plan.changes, "before");
      const first = await run(local.db, plan, fingerprint);
      const verified = await check(local.db, plan.changes, "after");
      const retry = await run(local.db, plan, fingerprint);
      if (retry.applied || retry.skipped !== plan.changes.length) throw Error("RETRY_NOT_IDEMPOTENT");
      const reversed = await run(local.db, plan, fingerprint, true);
      const reverted = await verifyHistoryRollback(local.db, plan.changes, fingerprint);
      const integrity = await local.db.execute({ sql: "PRAGMA integrity_check" });
      const fks = await local.db.execute({ sql: "PRAGMA foreign_key_check" });
      if (integrity.rows[0]?.integrity_check !== "ok" || fks.rows.length) throw Error("LOCAL_INTEGRITY_FAILED");
      const report = { verified: true, fingerprint, first, verifiedState: verified, retry, reversed, reverted, integrity: "ok", foreignKeyViolations: 0, backup: evidence };
      await save("simulation.json", report); console.log(JSON.stringify(report));
    } finally { await local.close(); }
    return;
  }
  if (mode !== "verify") {
    if (arg("confirm") !== `${mode}:${fingerprint}`) throw Error("SPECIFIC_CONFIRMATION_REQUIRED");
    const simulation = await read("simulation.json");
    if (!simulation.verified || simulation.fingerprint !== fingerprint) throw Error("SIMULATION_REQUIRED");
    const sourceAge = Date.now() - Date.parse(plan.sourceCompletedAt);
    if (mode === "apply" && (!Number.isFinite(sourceAge) || sourceAge < 0 || sourceAge > 24 * 3600000)) throw Error("SOURCE_TOO_OLD_REVIEW_NEW_PLAN");
    await backup(arg("backup"));
  }
  const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  try {
    if (mode === "verify") {
      const result = arg("state") === "rollback" ? await verifyHistoryRollback(db, plan.changes, fingerprint) : await check(db, plan.changes, "after");
      await save("verification.json", { fingerprint, ...result, at: new Date().toISOString() }); console.log(JSON.stringify(result)); return;
    }
    const result = await run(db, plan, fingerprint, mode === "rollback");
    const verified = mode === "rollback" ? await verifyHistoryRollback(db, plan.changes, fingerprint) : await check(db, plan.changes, "after");
    await save(`${mode}-result.json`, { fingerprint, ...result, ...verified, at: new Date().toISOString() });
    console.log(JSON.stringify({ fingerprint, ...result, ...verified }));
  } finally { db.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
