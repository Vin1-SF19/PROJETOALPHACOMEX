import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const dumpPath = process.argv[2] ?? join(root, "database-backups/pre-change/painelalpha_turso_pre_change_2026-09-16T21-55-58-514Z.sql");
const files = {
  dump: dumpPath,
  baseline: join(root, "prisma/manual-migrations/20260918_inventory_legacy_baseline.sql"),
  migration: join(root, "prisma/migrations/20260918193000_inventory_general_foundation/migration.sql"),
  backfill: join(root, "prisma/manual-migrations/20260918_inventory_legacy_backfill_v3.sql"),
};
const contents = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path)])));
const sql = Object.fromEntries(Object.entries(contents).map(([key, value]) => [key, value.toString("utf8")]));
const executable = sql.migration.split("\n").filter((line) => !line.trimStart().startsWith("--")).join("\n");
if (/\b(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql.backfill)) throw new Error("V3 must not own transaction boundaries");
if (/\b(BEGIN|COMMIT|ROLLBACK)\b/i.test(executable)) throw new Error("V1/V2 must not own transaction boundaries");
const forbidden = [/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i, /\bALTER\s+TABLE\b[^;]*\bRENAME\b/i, /\bRESET\b/i, /\bCREATE\s+TRIGGER\b/i, /\bALTER\s+TABLE\s+["`]ListaCompra["`]/i, /\bnew_(Categoria|ProdutoEstoque|ListaCompra)\b/i]
  .filter((pattern) => pattern.test(executable)).map(String);
if (forbidden.length) throw new Error(`Forbidden V4/V5/V6 statements: ${forbidden.join(", ")}`);

const dir = await mkdtemp(join(tmpdir(), "inventory-foundation-full-"));
const clonePath = join(dir, "clone.db");
let db = new DatabaseSync(clonePath);
const executeAtomic = (database, batchSql) => {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(batchSql);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};
try {
  db.exec(sql.dump);
  const before = db.prepare(`SELECT (SELECT COUNT(*) FROM Categoria) categories, COUNT(*) products, COALESCE(SUM(quantidade),0) quantity FROM ProdutoEstoque`).get();
  if (Number(before.categories) !== 3 || Number(before.products) !== 3 || Number(before.quantity) !== 18) throw new Error(`Legacy preflight mismatch: ${JSON.stringify(before)}`);
  db.exec(sql.baseline);
  executeAtomic(db, sql.migration);
  executeAtomic(db, sql.backfill);
  const afterFirst = db.prepare(`SELECT (SELECT COUNT(*) FROM InventoryStockBalance) balances, (SELECT COUNT(*) FROM InventoryOperation) operations, (SELECT COUNT(*) FROM InventoryMovement) movements, (SELECT COUNT(*) FROM InventoryAuditLog) audits`).get();
  executeAtomic(db, sql.backfill);
  const afterSecond = db.prepare(`SELECT (SELECT COUNT(*) FROM InventoryStockBalance) balances, (SELECT COUNT(*) FROM InventoryOperation) operations, (SELECT COUNT(*) FROM InventoryMovement) movements, (SELECT COUNT(*) FROM InventoryAuditLog) audits`).get();
  const assignmentTargetProbes = {};
  const domainProbes = {};
  const accept = (target, name, statement, args = []) => {
    db.prepare(statement).run(...args);
    target[name] = "accepted";
  };
  const rejectCheck = (target, name, statement, args = []) => {
    try {
      db.prepare(statement).run(...args);
      throw new Error(`Probe ${name} unexpectedly accepted`);
    } catch (error) {
      if (!/CHECK constraint failed/i.test(String(error?.message))) throw error;
      target[name] = "rejected-by-check";
    }
  };
  db.exec("SAVEPOINT inventory_constraint_probes");
  try {
    const productId = String(db.prepare(`SELECT id FROM ProdutoEstoque ORDER BY id LIMIT 1`).get().id);
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO InventoryAsset (id,produtoId,status,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`).run("probe-asset", productId, "DISPONIVEL", 1, now, now);
    db.prepare(`INSERT INTO InventoryTag (id,kind,nome,normalizedName,cor,ativo,version,createdById,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`).run("probe-tag", "KIT_MODELO", "Probe Kit", "probe-kit", "#000000", 1, 1, 1, now, now);
    db.prepare(`INSERT INTO InventoryTagRequirement (id,tagId,produtoId,quantityRequired,required,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)`).run("probe-req", "probe-tag", productId, 1, 1, 0, now, now);
    db.prepare(`INSERT INTO InventoryKitInstance (id,tagId,code,status,assembledById,requiredQuantityCache,fulfilledQuantityCache,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`).run("probe-kit", "probe-tag", "PROBE-KIT", "RASCUNHO", 1, 1, 0, 1, now, now);
    for (const suffix of ["product", "product-asset", "kit", "asset-only", "product-kit", "none", "assignment-status", "return-batch", "movement", "maintenance"]) {
      db.prepare(`INSERT INTO InventoryOperation (id,idempotencyKey,requestHash,type,actorType,actorNameSnapshot,occurredAt,createdAt) VALUES (?,?,?,?,?,?,?,?)`).run(`probe-op-${suffix}`, `probe-key-${suffix}`, `probe-hash-${suffix}`, "AJUSTE", "SYSTEM", "Constraint probe", now, now);
    }
    const assignmentSql = `INSERT INTO InventoryAssignment (id,produtoId,assetId,kitInstanceId,responsibleUserId,quantity,deliveredAt,handedById,operationId,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
    accept(assignmentTargetProbes, "product_without_asset", assignmentSql, ["probe-a-product", productId, null, null, 1, 1, now, 1, "probe-op-product", 1, now, now]);
    accept(assignmentTargetProbes, "product_with_existing_asset", assignmentSql, ["probe-a-product-asset", productId, "probe-asset", null, 1, 1, now, 1, "probe-op-product-asset", 1, now, now]);
    accept(assignmentTargetProbes, "kit_only", assignmentSql, ["probe-a-kit", null, null, "probe-kit", 1, 1, now, 1, "probe-op-kit", 1, now, now]);
    rejectCheck(assignmentTargetProbes, "asset_without_product", assignmentSql, ["probe-a-asset-only", null, "probe-asset", null, 1, 1, now, 1, "probe-op-asset-only", 1, now, now]);
    rejectCheck(assignmentTargetProbes, "product_and_kit", assignmentSql, ["probe-a-product-kit", productId, null, "probe-kit", 1, 1, now, 1, "probe-op-product-kit", 1, now, now]);
    rejectCheck(assignmentTargetProbes, "no_target", assignmentSql, ["probe-a-none", null, null, null, 1, 1, now, 1, "probe-op-none", 1, now, now]);
    rejectCheck(domainProbes, "asset_status", `INSERT INTO InventoryAsset (id,produtoId,status,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`, ["probe-invalid-asset", productId, "INVALID", 1, now, now]);
    rejectCheck(domainProbes, "stock_bucket", `INSERT INTO InventoryStockBalance (id,produtoId,bucket,quantity,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)`, ["probe-invalid-balance", productId, "INVALID", 0, 1, now, now]);
    rejectCheck(domainProbes, "operation_type", `INSERT INTO InventoryOperation (id,idempotencyKey,requestHash,type,actorType,actorNameSnapshot,occurredAt,createdAt) VALUES (?,?,?,?,?,?,?,?)`, ["probe-invalid-op-type", "probe-invalid-op-type", "hash", "INVALID", "SYSTEM", "Probe", now, now]);
    rejectCheck(domainProbes, "operation_actor", `INSERT INTO InventoryOperation (id,idempotencyKey,requestHash,type,actorType,actorNameSnapshot,occurredAt,createdAt) VALUES (?,?,?,?,?,?,?,?)`, ["probe-invalid-op-actor", "probe-invalid-op-actor", "hash", "AJUSTE", "INVALID", "Probe", now, now]);
    rejectCheck(domainProbes, "movement_bucket", `INSERT INTO InventoryMovement (id,operationId,produtoId,quantity,fromBucket,toBucket,availableBefore,availableAfter,totalBefore,totalAfter,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, ["probe-invalid-movement", "probe-op-movement", productId, 1, "INVALID", "DISPONIVEL", 1, 1, 1, 1, now]);
    rejectCheck(domainProbes, "assignment_status", `INSERT INTO InventoryAssignment (id,produtoId,responsibleUserId,quantity,deliveredAt,status,handedById,operationId,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, ["probe-invalid-assignment-status", productId, 1, 1, now, "INVALID", 1, "probe-op-assignment-status", 1, now, now]);
    db.prepare(`INSERT INTO InventoryReturnBatch (id,assignmentId,operationId,receivedById,returnedAt,createdAt) VALUES (?,?,?,?,?,?)`).run("probe-return-batch", "probe-a-product", "probe-op-return-batch", 1, now, now);
    rejectCheck(domainProbes, "return_condition", `INSERT INTO InventoryReturnLine (id,batchId,produtoId,quantity,condition,createdAt) VALUES (?,?,?,?,?,?)`, ["probe-invalid-return", "probe-return-batch", productId, 1, "INVALID", now]);
    rejectCheck(domainProbes, "maintenance_status", `INSERT INTO InventoryMaintenance (id,produtoId,quantity,reason,sentAt,status,openedById,sendOperationId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`, ["probe-invalid-maintenance", productId, 1, "Probe", now, "INVALID", 1, "probe-op-maintenance", now, now]);
    rejectCheck(domainProbes, "tag_kind", `INSERT INTO InventoryTag (id,kind,nome,normalizedName,cor,ativo,version,createdById,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`, ["probe-invalid-tag", "INVALID", "Invalid", "invalid-tag", "#000000", 1, 1, 1, now, now]);
    rejectCheck(domainProbes, "kit_status", `INSERT INTO InventoryKitInstance (id,tagId,code,status,assembledById,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)`, ["probe-invalid-kit", "probe-tag", "INVALID-KIT", "INVALID", 1, 1, now, now]);
    rejectCheck(domainProbes, "kit_component_status", `INSERT INTO InventoryKitComponent (id,kitInstanceId,requirementId,produtoId,quantity,returnedQuantity,status,addedById,addedAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)`, ["probe-invalid-component", "probe-kit", "probe-req", productId, 1, 0, "INVALID", 1, now, now]);
    rejectCheck(domainProbes, "audit_actor", `INSERT INTO InventoryAuditLog (id,entityType,entityId,action,actorType,actorNameSnapshot,createdAt) VALUES (?,?,?,?,?,?,?)`, ["probe-invalid-audit", "Probe", "1", "INVALID", "INVALID", "Probe", now]);
  } finally {
    db.exec("ROLLBACK TO inventory_constraint_probes");
    db.exec("RELEASE inventory_constraint_probes");
  }
  const checks = {
    products: Number(db.prepare(`SELECT COUNT(*) value FROM ProdutoEstoque`).get().value),
    categories: Number(db.prepare(`SELECT COUNT(*) value FROM Categoria`).get().value),
    legacyQuantity: Number(db.prepare(`SELECT SUM(quantidade) value FROM ProdutoEstoque`).get().value),
    availableBalance: Number(db.prepare(`SELECT SUM(quantity) value FROM InventoryStockBalance WHERE bucket='DISPONIVEL'`).get().value),
    divergence: Number(db.prepare(`SELECT COUNT(*) value FROM (SELECT p.id FROM ProdutoEstoque p LEFT JOIN InventoryStockBalance b ON b.produtoId=p.id AND b.bucket='DISPONIVEL' GROUP BY p.id HAVING p.quantidade<>COALESCE(SUM(b.quantity),0))`).get().value),
  };
  const quickCheck = String(db.prepare(`PRAGMA quick_check`).get().quick_check);
  const foreignKeyViolations = db.prepare(`PRAGMA foreign_key_check`).all().length;
  const checkConstraints = Number(db.prepare(`SELECT COUNT(*) value FROM sqlite_master WHERE type='table' AND name LIKE 'Inventory%' AND sql LIKE '%_check%'`).get().value);
  const idempotent = JSON.stringify(afterFirst) === JSON.stringify(afterSecond);
  const assignmentProbesOk = Object.values(assignmentTargetProbes).filter((value) => value === "accepted").length === 3 && Object.values(assignmentTargetProbes).filter((value) => value === "rejected-by-check").length === 3;
  const domainProbesOk = Object.keys(domainProbes).length === 12 && Object.values(domainProbes).every((value) => value === "rejected-by-check");
  const ok = quickCheck === "ok" && foreignKeyViolations === 0 && checkConstraints === 13 && assignmentProbesOk && domainProbesOk && idempotent && checks.products === 3 && checks.categories === 3 && checks.legacyQuantity === 18 && checks.availableBalance === 18 && checks.divergence === 0;
  db.close(); db = null;
  const prismaDiff = execFileSync("npx", ["prisma", "migrate", "diff", "--from-url", `file:${clonePath}`, "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { cwd: root, encoding: "utf8" });
  const prismaDiffStatements = prismaDiff.split(";\n").map((value) => value.trim()).filter(Boolean);
  const prismaDiffInventoryStatements = prismaDiffStatements.filter((value) => /Inventory|Categoria|ProdutoEstoque|ListaCompra/.test(value));
  const prismaDiffDestructiveStatements = prismaDiffStatements.filter((value) => /\bDROP\s+(TABLE|COLUMN|INDEX)\b|\bRENAME\b/i.test(value));
  const hashes = Object.fromEntries(Object.entries(contents).filter(([key]) => key !== "dump").map(([key, value]) => [key, createHash("sha256").update(value).digest("hex")]));
  console.log(JSON.stringify({ ok, clone: "full-backup-ephemeral-local", executor: "external-BEGIN-IMMEDIATE-per-batch", before, afterFirst, afterSecond, idempotent, assignmentTargetProbes, domainProbes, checks, quickCheck, foreignKeyViolations, checkConstraints, forbiddenStatements: forbidden, prismaDiffAfterApply: { totalStatements: prismaDiffStatements.length, inventoryStatements: prismaDiffInventoryStatements.length, inventoryStatementHeaders: prismaDiffInventoryStatements.map((value) => value.split("\n").find((line) => line.trim() && !line.trim().startsWith("--"))?.trim()).filter(Boolean), destructiveStatementsFromPreExistingGlobalDrift: prismaDiffDestructiveStatements.length }, hashes }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  if (db) db.close();
  await rm(dir, { recursive: true, force: true });
}
