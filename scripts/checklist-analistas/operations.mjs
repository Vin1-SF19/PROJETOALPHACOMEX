// Operational mutations: invoked only by lib.mjs AFTER verified Vault/backup/consent gates.
// No environment loading, logging, deployment or connection creation in this module.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { hash as bcryptHash } from "bcryptjs";

export const LEADER_ROLE = "Lider Operacional";
export const PRESERVED_MODULES = ["chamados", "Documentos", "UpDocumentos", "Extratos"];
export const TARGET_MODULES = [...PRESERVED_MODULES, "checkList"].sort();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const normalizeRole = (role) => String(role ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").toUpperCase();
const equalSets = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const bcryptPattern = /^\$2[aby]\$(?:0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/;

export function operationError(code, conflicts = 0) {
  const error = new Error(code);
  error.publicResult = { converted: 0, skipped: 0, conflicts, code };
  return error;
}

async function accountFields(db) {
  const fields = (await db.execute('PRAGMA table_info("ClienteOperacional")')).rows.map((row) => String(row.name));
  const hashField = fields.includes("senhaHash");
  const versionField = fields.includes("authSessionVersion");
  if (hashField !== versionField) throw operationError("SCHEMA_CREDENCIAIS_PARCIAL");
  return { hashField, versionField };
}

async function readAccounts(db) {
  const { hashField } = await accountFields(db);
  const rows = [];
  let after = "";
  for (;;) {
    const page = await db.execute({ sql: `SELECT id,senha,${hashField ? "senhaHash,authSessionVersion" : "NULL AS senhaHash,0 AS authSessionVersion"} FROM ClienteOperacional WHERE id>? ORDER BY id LIMIT 250`, args: [after] });
    if (!page.rows.length) break;
    for (const row of page.rows) { after = String(row.id); rows.push(row); }
  }
  return rows;
}

function accountState(row) {
  // Hash always wins. An already hashed account is never overwritten or downgraded.
  if (row.senhaHash !== null) return bcryptPattern.test(String(row.senhaHash)) ? "HASHED" : "HASH_INVALID";
  if (typeof row.senha !== "string" || row.senha.length === 0 || Buffer.byteLength(row.senha, "utf8") > 72) return "LEGACY_INVALID";
  return "LEGACY";
}

export async function planLegacyAccounts(db) {
  const rows = await readAccounts(db);
  const accounts = rows.map((row) => ({ id: String(row.id), state: accountState(row), sessionVersion: Number(row.authSessionVersion), legacyCopy: row.senhaHash !== null && row.senha !== "" }));
  const invalid = accounts.filter((account) => ["LEGACY_INVALID", "HASH_INVALID"].includes(account.state));
  return {
    projection: "POST_ADDITIVE_SCHEMA_NULL_HASH_VERSION_ZERO_FOR_PRE_DDL",
    phase: "AFTER_SCHEMA_BOOTSTRAP_GRANT_AND_VALIDATED_PORTAL_READER_AND_READY_PANEL_HASH_WRITER_AND_LEGACY_WRITER_CESSATION",
    algorithm: "bcrypt",
    cost: 12,
    sessionPolicy: "PRESERVE_AUTH_SESSION_VERSION_NO_PASSWORD_CHANGE",
    accounts,
    convertCount: accounts.filter((account) => account.state === "LEGACY").length,
    skipCount: accounts.filter((account) => account.state === "HASHED").length,
    invalidCount: invalid.length,
    hashedLegacyCopies: accounts.filter((account) => account.legacyCopy).length,
    blockers: [...(invalid.length ? ["CREDENCIAL_INVALIDA_EXIGE_REVISAO"] : []), ...(accounts.some((account) => account.legacyCopy) ? ["HASH_COM_COPIA_LEGADA_EXIGE_REVISAO"] : [])],
    mutations: 0,
  };
}

/** Secrets remain only in this in-memory structure; it must NEVER be serialized/logged. */
export async function prepareLegacyHashes(db, plan) {
  const { hashField } = await accountFields(db);
  if (!hashField) throw operationError("SCHEMA_NOVO_OBRIGATORIO");
  const rows = await readAccounts(db);
  const current = await planLegacyAccounts(db);
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw operationError("PLANO_MUDOU_REFAZER_APROVACAO", 1);
  if (current.blockers.length) throw operationError(current.blockers[0]);
  const prepared = [];
  for (const row of rows) {
    if (accountState(row) === "HASHED") continue;
    if (accountState(row) !== "LEGACY") throw operationError("CREDENCIAL_INVALIDA_EXIGE_REVISAO");
    prepared.push({ id: String(row.id), originalPassword: String(row.senha), originalHash: row.senhaHash, sessionVersion: Number(row.authSessionVersion), hash: await bcryptHash(String(row.senha), 12) });
  }
  return { prepared, skipped: current.skipCount };
}

export async function commitLegacyHashes(tx, batch) {
  let converted = 0;
  for (const entry of batch.prepared) {
    const result = await tx.execute({
      sql: "UPDATE ClienteOperacional SET senhaHash=?,senha='' WHERE id=? AND senhaHash IS ? AND senha=? AND authSessionVersion=?",
      args: [entry.hash, entry.id, entry.originalHash, entry.originalPassword, entry.sessionVersion],
    });
    if (result.rowsAffected !== 1) throw operationError("CONTA_ALTERADA_CONCORRENTEMENTE", 1);
    converted++;
  }
  return { converted, skipped: batch.skipped, conflicts: 0, code: converted ? "CONTAS_CONVERTIDAS" : "CONTAS_JA_COMPATIVEIS" };
}

export async function assertPortalReader({ readerEvidencePath, portalOrigin, databaseFingerprint, now = Date.now() }) {
  if (!readerEvidencePath || !portalOrigin) throw operationError("LEITOR_PORTAL_STAGING_OBRIGATORIO");
  let origin;
  try { origin = new URL(portalOrigin); } catch { throw operationError("ORIGIN_PORTAL_STAGING_INVALIDO"); }
  if (origin.protocol !== "https:" || origin.origin !== portalOrigin || !/(^|[.-])stag(?:e|ing)([.-]|$)/i.test(origin.hostname)) throw operationError("ORIGIN_PORTAL_STAGING_INVALIDO");
  const proof = JSON.parse(await readFile(readerEvidencePath, "utf8"));
  const checkedAt = Date.parse(proof.checkedAt);
  if (proof.environment !== "staging" || proof.origin !== portalOrigin || proof.databaseFingerprint !== databaseFingerprint || proof.readyState !== "READY" || proof.validated !== true || !/^dpl_[A-Za-z0-9]+$/.test(proof.deploymentId ?? "") || !/^[a-f0-9]{40}$/.test(proof.commitSha ?? "") || !Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > 24 * 3600_000 || proof.checks?.hashLogin !== true || proof.checks?.legacyUpgrade !== true || proof.checks?.sessionVersion !== true) throw operationError("LEITOR_PORTAL_NAO_COMPROVADO");
  return { deploymentId: proof.deploymentId, commitSha: proof.commitSha, checkedAt: proof.checkedAt };
}

/** Equivalent to readEffectiveModulePermissions for the fixed non-admin role; tested against the real resolver. */
export function effectiveLeaderModules(legacy, sectorModules, overrides) {
  const result = sectorModules.length ? new Set(sectorModules) : new Set((legacy ?? "").split(",").filter(Boolean));
  for (const override of overrides) {
    if (override.acao === "ADD") result.add(override.modulo);
    else if (override.acao === "REMOVE") result.delete(override.modulo);
  }
  return [...result].sort();
}

export async function readModuleCatalog() {
  const registry = await readFile(new URL("../../src/lib/modulos-registry.ts", import.meta.url), "utf8");
  const resolver = await readFile(new URL("../../src/lib/permissions/effective.ts", import.meta.url), "utf8");
  const roles = await readFile(new URL("../../src/lib/roles.ts", import.meta.url), "utf8");
  const permissions = [...new Set([...registry.matchAll(/\bpermission:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))].sort();
  if (!TARGET_MODULES.filter((module) => module !== "UpDocumentos").every((module) => permissions.includes(module))) throw operationError("CATALOGO_MODULOS_DIVERGENTE");
  return { sourceSha256: digest(registry + resolver + roles), permissions, preservedOpaqueLegacyPermissions: permissions.includes("UpDocumentos") ? [] : ["UpDocumentos"] };
}

export async function planLeaderAccess(db) {
  const catalog = await readModuleCatalog();
  // Entire role membership includes inactive users; no names/e-mails/secrets are selected.
  const allUsers = [];
  let after = 0;
  for (;;) {
    const rows = (await db.execute({ sql: "SELECT id,role,status,permissoes FROM usuarios WHERE id>? ORDER BY id LIMIT 250", args: [after] })).rows;
    if (!rows.length) break;
    for (const row of rows) { after = Number(row.id); allUsers.push(row); }
  }
  const members = allUsers.filter((row) => normalizeRole(row.role) === "LIDEROPERACIONAL");
  const sectors = (await db.execute("SELECT id,nome,ativo,isBase,protegido,createdAt FROM setor ORDER BY id")).rows.filter((row) => normalizeRole(row.nome) === "LIDEROPERACIONAL");
  const sectorRows = (await db.execute({ sql: "SELECT id,setor,modulo,createdAt,updatedAt FROM SetorPermissao WHERE setor=? ORDER BY id", args: [LEADER_ROLE] })).rows;
  const overrides = [];
  for (const member of members) overrides.push(...(await db.execute({ sql: "SELECT id,usuarioId,modulo,acao,motivo,criadoPor,createdAt FROM UsuarioPermissaoOverride WHERE usuarioId=? ORDER BY id", args: [member.id] })).rows);
  const blockers = [];
  if (!members.length) blockers.push("SETOR_SEM_USUARIOS");
  if (members.some((row) => row.role !== LEADER_ROLE)) blockers.push("ROLE_VARIANTE_EXIGE_REVISAO");
  if (sectors.length !== 1 || !sectors[0].ativo) blockers.push("SETOR_CADASTRAL_DIVERGENTE");
  const modules = sectorRows.map((row) => String(row.modulo)).sort();
  const alreadyConfigured = equalSets(modules, TARGET_MODULES);
  if (modules.length && !alreadyConfigured) blockers.push("CONFIGURACAO_SETORIAL_PARCIAL_OU_DIVERGENTE");
  const users = members.map((member) => {
    const perUser = overrides.filter((row) => row.usuarioId === member.id);
    const before = effectiveLeaderModules(member.permissoes, modules, perUser);
    const after = effectiveLeaderModules(member.permissoes, TARGET_MODULES, perUser);
    if (!modules.length && !equalSets(new Set(String(member.permissoes ?? "").split(",").filter(Boolean)), PRESERVED_MODULES)) blockers.push("FALLBACKS_INCOMPATIVEIS");
    if (!TARGET_MODULES.every((module) => after.includes(module)) || before.some((module) => !after.includes(module))) blockers.push("ACESSO_EFETIVO_NAO_PRESERVADO");
    return { id: Number(member.id), active: member.status === "ATIVO", before, after };
  });
  const snapshotSha256 = digest(JSON.stringify({ members, sectors, sectorRows, overrides, catalog }));
  return { role: LEADER_ROLE, scope: "ALL_CURRENT_AND_FUTURE_EXACT_ROLE_MEMBERS", preservedModules: [...PRESERVED_MODULES], targetModules: TARGET_MODULES, users, currentSectorRows: sectorRows.length, insertCount: alreadyConfigured ? 0 : 5, state: alreadyConfigured ? "ALREADY_CONFIGURED" : modules.length ? "DIVERGENT" : "UNCONFIGURED", snapshotSha256, catalogSha256: catalog.sourceSha256, blockers: [...new Set(blockers)].sort(), mutations: 0 };
}

export async function commitLeaderAccess(tx, plan) {
  if (plan.blockers.length) throw operationError("PLANO_PERMISSAO_BLOQUEADO");
  const current = await planLeaderAccess(tx);
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw operationError("PRESTATE_PERMISSAO_ALTERADO", 1);
  if (current.state === "ALREADY_CONFIGURED") return { inserted: 0, users: current.users.length, code: "SETOR_JA_CONFIGURADO" };
  for (const permission of TARGET_MODULES) await tx.execute({ sql: "INSERT INTO SetorPermissao(setor,modulo,createdAt,updatedAt) VALUES(?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", args: [LEADER_ROLE, permission] });
  const after = await planLeaderAccess(tx);
  if (after.blockers.length || after.state !== "ALREADY_CONFIGURED" || after.users.some((user) => !TARGET_MODULES.every((module) => user.after.includes(module)))) throw operationError("VALIDACAO_PERMISSAO_FALHOU");
  return { inserted: 5, users: after.users.length, code: "SETOR_HABILITADO_PRESERVANDO_ACESSOS" };
}
