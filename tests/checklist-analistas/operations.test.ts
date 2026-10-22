import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "./node-sqlite";
import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { compare, getRounds, hash as bcryptHash } from "bcryptjs";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { applyPrepared, assertApplyGates, buildPlan, hash } from "../../scripts/checklist-analistas/lib.mjs";
import { assertPortalReader, commitLeaderAccess, commitLegacyHashes, effectiveLeaderModules, LEADER_ROLE, planLeaderAccess, planLegacyAccounts, prepareLegacyHashes, TARGET_MODULES } from "../../scripts/checklist-analistas/operations.mjs";

const resolverContext = vi.hoisted(() => ({ prisma: undefined as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ default: new Proxy({}, { get: (_target, property) => Reflect.get(resolverContext.prisma, property) }) }));
import { readEffectiveModulePermissions } from "@/lib/permissions/effective";

const root = path.resolve();
const baseSql = readFileSync(path.join(root, "tests/checklist-analistas/fixtures/base-checklist.sql"), "utf8");
const permissionSql = readFileSync(path.join(root, "tests/checklist-analistas/fixtures/permissions.sql"), "utf8");
const migrationSql = readFileSync(path.join(root, "prisma/migrations/20261022143000_checklist_analistas_crm/migration.sql"), "utf8");
type Fixture = { dir: string; file: string; url: string; db: DatabaseSync; client: ReturnType<typeof createClient>; prisma: PrismaClient };
const fixtures: Fixture[] = [];
const legacy = "chamados,Documentos,UpDocumentos,Extratos";
const passwords = ["synthetic-legacy-one", "synthetic-legacy-two"];
function fixture(withMigration = true): Fixture {
  const dir = mkdtempSync(path.join("/tmp", "checklist-data-operations-"));
  const file = path.join(dir, "fixture.db");
  const url = `file:${file}`;
  const db = new DatabaseSync(file);
  db.exec(baseSql + permissionSql + (withMigration ? migrationSql : ""));
  db.prepare("INSERT INTO usuarios(id,nome,usuario,email,senha,role,permissoes,status) VALUES(?,?,?,?,?,?,?,?)").run(10, "Synthetic Leader", "leader", "leader@example.invalid", "fixture", LEADER_ROLE, legacy, "ATIVO");
  db.prepare("INSERT INTO usuarios(id,nome,usuario,email,senha,role,permissoes,status) VALUES(?,?,?,?,?,?,?,?)").run(11, "Inactive Leader", "inactive", "inactive@example.invalid", "fixture", LEADER_ROLE, legacy, "INATIVO");
  db.prepare("INSERT INTO usuarios(id,nome,usuario,email,senha,role,permissoes,status) VALUES(?,?,?,?,?,?,?,?)").run(12, "Other role", "other", "other@example.invalid", "fixture", "Lider Comercial", "AlphaCRM", "ATIVO");
  db.prepare("INSERT INTO setor(nome) VALUES(?)").run(LEADER_ROLE);
  db.prepare("INSERT INTO ClienteOperacional(id,nome,email,senha) VALUES(?,?,?,?)").run("opaque-a", "Synthetic A", "a@example.invalid", passwords[0]);
  db.prepare("INSERT INTO ClienteOperacional(id,nome,email,senha) VALUES(?,?,?,?)").run("opaque-b", "Synthetic B", "b@example.invalid", passwords[1]);
  db.prepare("INSERT INTO Cliente(id,razaoSocial,updatedAt) VALUES(?,?,CURRENT_TIMESTAMP)").run(20, "Synthetic Company");
  db.prepare("INSERT INTO operacional_clientes(id,embasamento,clienteId,clienteOperacionalId,updatedAt) VALUES(?,?,?,?,CURRENT_TIMESTAMP)").run("opaque-record", "RECEITA_BRUTA_DAS", 20, "opaque-a");
  if (withMigration) db.exec("UPDATE operacional_clientes SET analistaId=10,revision=4 WHERE id='opaque-record'");
  const client = createClient({ url });
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  const result = { dir, file, url, db, client, prisma };
  fixtures.push(result);
  return result;
}
afterEach(async () => { for (const f of fixtures.splice(0)) { await f.prisma.$disconnect(); f.client.close(); f.db.close(); rmSync(f.dir, { recursive: true, force: true }); } });

function q(value: unknown): string { return value === null ? "NULL" : typeof value === "number" || typeof value === "bigint" ? String(value) : `'${String(value).replaceAll("'", "''")}'`; }
async function evidence(f: Fixture, operation: string) {
  const plan = await buildPlan(operation, f.client);
  // All evidence here belongs ONLY to the synthetic /tmp fixture, never an operational approval.
  const schemaRows = f.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type='table' DESC,type,name").all();
  const tables = schemaRows.filter((row) => row.type === "table");
  let rows = 0;
  const sql = ["PRAGMA foreign_keys=OFF;", ...tables.map((row) => row.sql + ";")];
  for (const table of tables) {
    const tableName = `"${String(table.name).replaceAll('"', '""')}"`;
    for (const row of f.db.prepare(`SELECT * FROM ${tableName}`).all()) {
      const names = Object.keys(row).map((key) => `"${key}"`).join(",");
      sql.push(`INSERT INTO ${tableName}(${names}) VALUES(${Object.values(row).map(q).join(",")});`); rows++;
    }
  }
  sql.push(...schemaRows.filter((row) => row.type !== "table").map((row) => row.sql + ";"), "PRAGMA foreign_keys=ON;");
  const dump = sql.join("\n");
  const backupPath = path.join(f.dir, "synthetic-backup.sql");
  const manifestPath = path.join(f.dir, "synthetic-manifest.json");
  const consentPath = path.join(f.dir, "synthetic-consent.json");
  const vaultPath = path.join(f.dir, "synthetic-vault.json");
  const readerEvidencePath = path.join(f.dir, "synthetic-reader.json");
  const fingerprint = hash(f.url);
  const now = new Date().toISOString();
  const binding = { environment: "staging", databaseFingerprint: fingerprint, operation, planSha256: plan.planSha256, backupSha256: hash(dump) };
  const manifest = { generatedAt: now, databaseHash: fingerprint, sha256: hash(dump), sizeBytes: Buffer.byteLength(dump), tables: tables.length, totalRows: rows };
  const consent = { ...binding, confirmed: true, confirmedBy: "user", confirmedAt: now };
  const vault = { ...binding, approved: true };
  const reader = { environment: "staging", databaseFingerprint: fingerprint, origin: "https://portal-staging.example.invalid", readyState: "READY", validated: true, checkedAt: now, deploymentId: "dpl_syntheticFixture", commitSha: "a".repeat(40), checks: { hashLogin: true, legacyUpgrade: true, sessionVersion: true } };
  writeFileSync(backupPath, dump);
  for (const [file, value] of [[manifestPath, manifest], [consentPath, consent], [vaultPath, vault], [readerEvidencePath, reader]] as const) writeFileSync(file, JSON.stringify(value));
  const args = { environment: "staging", panelOrigin: "https://staging.alpha-comex.com", databaseUrl: f.url, stagingFingerprint: fingerprint, operation, planSha256: plan.planSha256, backupPath, manifestPath, consentPath, vaultPath, readerEvidencePath, portalOrigin: reader.origin };
  return { plan, args, manifest, consent, vault, reader, binding };
}
async function transaction<T>(f: Fixture, run: (tx: Awaited<ReturnType<Fixture["client"]["transaction"]>>) => Promise<T>) {
  const tx = await f.client.transaction("write");
  try { const result = await run(tx); await tx.commit(); return result; } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
}

describe("CLI data operations — real disposable SQLite", () => {
  it("hash plan is read-only, secret-free and identical before/after additive DDL", async () => {
    const f = fixture(false);
    const before = readFileSync(f.file);
    const pre = await buildPlan("hash-contas", f.client);
    expect(pre.operationPlan).toMatchObject({ cost: 12, convertCount: 2, skipCount: 0, blockers: [], mutations: 0 });
    expect(readFileSync(f.file)).toEqual(before);
    const serialized = JSON.stringify(pre);
    for (const secret of [...passwords, ...passwords.map(hash), "senhaHash", "a@example.invalid", "Synthetic A"]) expect(serialized).not.toContain(secret);
    f.db.exec(migrationSql);
    expect((await buildPlan("hash-contas", f.client)).planSha256).toBe(pre.planSha256);
  });

  it("requires real gate proofs; rejects manually constructed verified flags", async () => {
    const f = fixture();
    const plan = await buildPlan("hash-contas", f.client);
    await expect(applyPrepared(f.client, "hash-contas", plan.planSha256, { verified: true })).rejects.toThrow("GATES_OBRIGATORIOS");
    const e = await evidence(f, "hash-contas");
    await expect(assertApplyGates({ ...e.args, consentPath: undefined })).rejects.toThrow("EVIDENCIAS_VAULT_BACKUP_CONSENTIMENTO_OBRIGATORIAS");
    await expect(assertApplyGates({ ...e.args, environment: "production" })).rejects.toThrow("AMBIENTE_STAGING_NAO_COMPROVADO");
    await expect(assertApplyGates({ ...e.args, stagingFingerprint: "wrong" })).rejects.toThrow("FINGERPRINT_STAGING_DIVERGENTE");
    writeFileSync(e.args.manifestPath, JSON.stringify({ ...e.manifest, generatedAt: new Date(Date.now() - 49 * 3600_000).toISOString() }));
    await expect(assertApplyGates(e.args)).rejects.toThrow("BACKUP_VENCIDO_VAZIO_OU_BANCO_DIVERGENTE");
    writeFileSync(e.args.manifestPath, JSON.stringify(e.manifest));
    writeFileSync(e.args.consentPath, JSON.stringify({ ...e.consent, confirmed: false }));
    await expect(assertApplyGates(e.args)).rejects.toThrow("CONSENTIMENTO_ESPECIFICO_AUSENTE");
    writeFileSync(e.args.consentPath, JSON.stringify(e.consent));
    writeFileSync(e.args.backupPath, "corrupted synthetic backup");
    await expect(assertApplyGates(e.args)).rejects.toThrow("Backup e manifesto divergentes");
  });

  it("hash operation refuses unvalidated/wrong-database/production Portal reader", async () => {
    const f = fixture(); const e = await evidence(f, "hash-contas");
    await expect(assertApplyGates({ ...e.args, readerEvidencePath: undefined })).rejects.toThrow("LEITOR_PORTAL_STAGING_OBRIGATORIO");
    await expect(assertApplyGates({ ...e.args, portalOrigin: "https://alphaclientes.vercel.app" })).rejects.toThrow("ORIGIN_PORTAL_STAGING_INVALIDO");
    writeFileSync(e.args.readerEvidencePath, JSON.stringify({ ...e.reader, validated: false }));
    await expect(assertApplyGates(e.args)).rejects.toThrow("LEITOR_PORTAL_NAO_COMPROVADO");
    writeFileSync(e.args.readerEvidencePath, JSON.stringify({ ...e.reader, databaseFingerprint: "other" }));
    await expect(assertApplyGates(e.args)).rejects.toThrow("LEITOR_PORTAL_NAO_COMPROVADO");
    await expect(assertPortalReader({ readerEvidencePath: e.args.readerEvidencePath, portalOrigin: e.args.portalOrigin, databaseFingerprint: hash(f.url) })).rejects.toThrow("LEITOR_PORTAL_NAO_COMPROVADO");
  });

  it("atomically converts two accounts to bcrypt12, clears plaintext and preserves session versions", async () => {
    const f = fixture(); f.db.exec("UPDATE ClienteOperacional SET authSessionVersion=7");
    const e = await evidence(f, "hash-contas"); const gates = await assertApplyGates(e.args);
    const result = await applyPrepared(f.client, "hash-contas", e.plan.planSha256, gates);
    expect(result).toMatchObject({ converted: 2, skipped: 0, conflicts: 0, code: "CONTAS_CONVERTIDAS" });
    const rows = f.db.prepare("SELECT id,senha,senhaHash,authSessionVersion FROM ClienteOperacional ORDER BY id").all();
    for (const [index, row] of rows.entries()) { expect(row.senha).toBe(""); expect(row.authSessionVersion).toBe(7); expect(getRounds(String(row.senhaHash))).toBe(12); expect(await compare(passwords[index], String(row.senhaHash))).toBe(true); }
    for (const row of rows) expect(JSON.stringify(result)).not.toContain(String(row.senhaHash));
    const replay = await evidence(f, "hash-contas");
    expect(await applyPrepared(f.client, "hash-contas", replay.plan.planSha256, await assertApplyGates(replay.args))).toMatchObject({ converted: 0, skipped: 2, conflicts: 0, code: "CONTAS_JA_COMPATIVEIS" });
  });

  it("hash-first skips a current hash and does not reset its password/session version", async () => {
    const f = fixture(); const current = await bcryptHash("synthetic-current-password", 12);
    f.db.prepare("UPDATE ClienteOperacional SET senhaHash=?,authSessionVersion=9 WHERE id='opaque-a'").run(current);
    const duplicatedSecret = await planLegacyAccounts(f.client);
    expect(duplicatedSecret.blockers).toEqual(["HASH_COM_COPIA_LEGADA_EXIGE_REVISAO"]);
    await expect(prepareLegacyHashes(f.client, duplicatedSecret)).rejects.toThrow("HASH_COM_COPIA_LEGADA_EXIGE_REVISAO");
    f.db.exec("UPDATE ClienteOperacional SET senha='' WHERE id='opaque-a'");
    const plan = await planLegacyAccounts(f.client); expect(plan).toMatchObject({ convertCount: 1, skipCount: 1 });
    const prepared = await prepareLegacyHashes(f.client, plan);
    expect(await transaction(f, (tx) => commitLegacyHashes(tx, prepared))).toMatchObject({ converted: 1, skipped: 1 });
    expect(f.db.prepare("SELECT senhaHash,authSessionVersion FROM ClienteOperacional WHERE id='opaque-a'").get()).toMatchObject({ senhaHash: current, authSessionVersion: 9 });
  });

  it("blank/invalid/truncating legacy secrets are blocked without conversion", async () => {
    const f = fixture();
    for (const value of ["", "á".repeat(37)]) {
      f.db.prepare("UPDATE ClienteOperacional SET senha=? WHERE id='opaque-a'").run(value);
      const plan = await planLegacyAccounts(f.client); expect(plan.blockers).toEqual(["CREDENCIAL_INVALIDA_EXIGE_REVISAO"]);
      await expect(prepareLegacyHashes(f.client, plan)).rejects.toThrow("CREDENCIAL_INVALIDA_EXIGE_REVISAO");
    }
    f.db.exec("UPDATE ClienteOperacional SET senhaHash='invalid-hash' WHERE id='opaque-a'");
    expect((await planLegacyAccounts(f.client)).invalidCount).toBe(1);
    expect(f.db.prepare("SELECT senhaHash FROM ClienteOperacional WHERE id='opaque-b'").get()!.senhaHash).toBe(null);
  });

  it("CAS rejects concurrent password reset and rolls back all previous conversions", async () => {
    const f = fixture(); const prepared = await prepareLegacyHashes(f.client, await planLegacyAccounts(f.client));
    f.db.exec("UPDATE ClienteOperacional SET senha='synthetic-reset',authSessionVersion=authSessionVersion+1 WHERE id='opaque-b'");
    await expect(transaction(f, (tx) => commitLegacyHashes(tx, prepared))).rejects.toThrow("CONTA_ALTERADA_CONCORRENTEMENTE");
    expect(f.db.prepare("SELECT senha,senhaHash FROM ClienteOperacional WHERE id='opaque-a'").get()).toMatchObject({ senha: passwords[0], senhaHash: null });
    expect(f.db.prepare("SELECT senha,authSessionVersion FROM ClienteOperacional WHERE id='opaque-b'").get()).toMatchObject({ senha: "synthetic-reset", authSessionVersion: 1 });
  });

  it("CAS preserves concurrent login upgrade instead of overwriting its hash", async () => {
    const f = fixture(); const prepared = await prepareLegacyHashes(f.client, await planLegacyAccounts(f.client));
    const loginHash = await bcryptHash(passwords[1], 12);
    f.db.prepare("UPDATE ClienteOperacional SET senhaHash=?,senha='' WHERE id='opaque-b'").run(loginHash);
    await expect(transaction(f, (tx) => commitLegacyHashes(tx, prepared))).rejects.toThrow("CONTA_ALTERADA_CONCORRENTEMENTE");
    expect(f.db.prepare("SELECT senhaHash FROM ClienteOperacional WHERE id='opaque-b'").get()!.senhaHash).toBe(loginHash);
    expect(f.db.prepare("SELECT senhaHash FROM ClienteOperacional WHERE id='opaque-a'").get()!.senhaHash).toBe(null);
  });

  it("failure on the second update rolls back the entire guarded hash batch", async () => {
    const f = fixture(); f.db.exec("CREATE TRIGGER reject_second BEFORE UPDATE OF senhaHash ON ClienteOperacional WHEN NEW.id='opaque-b' BEGIN SELECT RAISE(ABORT,'synthetic-trigger-failure'); END");
    const e = await evidence(f, "hash-contas");
    await expect(applyPrepared(f.client, "hash-contas", e.plan.planSha256, await assertApplyGates(e.args))).rejects.toThrow();
    expect(f.db.prepare("SELECT count(*) n FROM ClienteOperacional WHERE senhaHash IS NULL AND senha<>''").get()!.n).toBe(2);
  });

  it("sector plan snapshots inactive members and is mutation-free", async () => {
    const f = fixture(); const before = readFileSync(f.file);
    const plan = await buildPlan("habilitar-lider-checklist", f.client);
    expect(plan.operationPlan).toMatchObject({ role: LEADER_ROLE, insertCount: 5, state: "UNCONFIGURED", blockers: [], mutations: 0 });
    expect((plan.operationPlan as Awaited<ReturnType<typeof planLeaderAccess>>).users.map((user) => user.id)).toEqual([10, 11]);
    expect(readFileSync(f.file)).toEqual(before);
    for (const secret of [...passwords, "leader@example.invalid", "Synthetic Leader"]) expect(JSON.stringify(plan)).not.toContain(secret);
  });

  it("five sector links preserve four accesses; real resolver matches equivalent contract and excludes other role", async () => {
    const f = fixture(); resolverContext.prisma = f.prisma;
    expect((await readEffectiveModulePermissions(10)).sort()).toEqual(legacy.split(",").sort());
    const ownersBefore = f.db.prepare("SELECT id,role,permissoes FROM usuarios ORDER BY id").all();
    const recordsBefore = f.db.prepare("SELECT id,analistaId,revision FROM operacional_clientes ORDER BY id").all();
    const e = await evidence(f, "habilitar-lider-checklist");
    expect(await applyPrepared(f.client, "habilitar-lider-checklist", e.plan.planSha256, await assertApplyGates(e.args))).toMatchObject({ inserted: 5, users: 2 });
    expect((await readEffectiveModulePermissions(10)).sort()).toEqual(TARGET_MODULES);
    expect((await readEffectiveModulePermissions(11)).sort()).toEqual(TARGET_MODULES);
    expect(await readEffectiveModulePermissions(12)).toEqual(["AlphaCRM"]);
    expect(effectiveLeaderModules(legacy, TARGET_MODULES, [])).toEqual((await readEffectiveModulePermissions(10)).sort());
    expect(f.db.prepare("SELECT id,role,permissoes FROM usuarios ORDER BY id").all()).toEqual(ownersBefore);
    expect(f.db.prepare("SELECT id,analistaId,revision FROM operacional_clientes ORDER BY id").all()).toEqual(recordsBefore);
    const replay = await evidence(f, "habilitar-lider-checklist");
    expect(await applyPrepared(f.client, "habilitar-lider-checklist", replay.plan.planSha256, await assertApplyGates(replay.args))).toMatchObject({ inserted: 0, code: "SETOR_JA_CONFIGURADO" });
  });

  it("preserves unrelated overrides; removal of any required access blocks instead of overwriting override", async () => {
    const f = fixture(); resolverContext.prisma = f.prisma;
    f.db.exec("INSERT INTO UsuarioPermissaoOverride(usuarioId,modulo,acao,criadoPor) VALUES(10,'AlphaCRM','ADD',10)");
    const plan = await planLeaderAccess(f.client); expect(plan.blockers).toEqual([]);
    expect(plan.users[0].after).toContain("AlphaCRM");
    await transaction(f, (tx) => commitLeaderAccess(tx, plan));
    expect((await readEffectiveModulePermissions(10)).sort()).toEqual([...TARGET_MODULES, "AlphaCRM"].sort());
    expect(f.db.prepare("SELECT count(*) n FROM UsuarioPermissaoOverride").get()!.n).toBe(1);
    f.db.exec("INSERT INTO UsuarioPermissaoOverride(usuarioId,modulo,acao,criadoPor) VALUES(11,'checkList','REMOVE',10)");
    expect((await planLeaderAccess(f.client)).blockers).toContain("ACESSO_EFETIVO_NAO_PRESERVADO");
  });

  it("blocks incompatible fallbacks including inactive members; no automatic union expansion", async () => {
    const f = fixture(); f.db.exec("UPDATE usuarios SET permissoes='chamados,Documentos,UpDocumentos,Extratos,AlphaCRM' WHERE id=11");
    const plan = await planLeaderAccess(f.client); expect(plan.blockers).toContain("FALLBACKS_INCOMPATIVEIS");
    await expect(transaction(f, (tx) => commitLeaderAccess(tx, plan))).rejects.toThrow("PLANO_PERMISSAO_BLOQUEADO");
    expect(f.db.prepare("SELECT count(*) n FROM SetorPermissao").get()!.n).toBe(0);
  });

  it("a partial sector configuration and a role alias block rather than widening silently", async () => {
    const f = fixture(); f.db.prepare("INSERT INTO SetorPermissao(setor,modulo,updatedAt) VALUES(?,?,CURRENT_TIMESTAMP)").run(LEADER_ROLE, "checkList");
    expect((await planLeaderAccess(f.client)).blockers).toContain("CONFIGURACAO_SETORIAL_PARCIAL_OU_DIVERGENTE");
    f.db.exec("DELETE FROM SetorPermissao; UPDATE usuarios SET role='Líder Operacional' WHERE id=11");
    expect((await planLeaderAccess(f.client)).blockers).toContain("ROLE_VARIANTE_EXIGE_REVISAO");
  });

  it("prestate CAS rejects membership/status/legacy/overrides/sector drifts", async () => {
    for (const change of ["UPDATE usuarios SET role='Operacional' WHERE id=11", "UPDATE usuarios SET status='ATIVO' WHERE id=11", "UPDATE usuarios SET permissoes='chamados' WHERE id=11", "INSERT INTO UsuarioPermissaoOverride(usuarioId,modulo,acao,criadoPor) VALUES(10,'AlphaCRM','ADD',10)", "UPDATE setor SET protegido=1", "INSERT INTO SetorPermissao(setor,modulo,updatedAt) VALUES('Lider Operacional','checkList',CURRENT_TIMESTAMP)"]) {
      const f = fixture(); const plan = await planLeaderAccess(f.client); f.db.exec(change);
      await expect(transaction(f, (tx) => commitLeaderAccess(tx, plan))).rejects.toThrow("PRESTATE_PERMISSAO_ALTERADO");
      expect(f.db.prepare("SELECT count(*) n FROM SetorPermissao").get()!.n).toBe(change.startsWith("INSERT INTO SetorPermissao") ? 1 : 0);
    }
  });

  it("failed sector relation insertion rolls back all five links", async () => {
    const f = fixture(); f.db.exec("CREATE TRIGGER reject_module BEFORE INSERT ON SetorPermissao WHEN NEW.modulo='checkList' BEGIN SELECT RAISE(ABORT,'synthetic-sector-failure'); END");
    const e = await evidence(f, "habilitar-lider-checklist");
    await expect(applyPrepared(f.client, "habilitar-lider-checklist", e.plan.planSha256, await assertApplyGates(e.args))).rejects.toThrow();
    expect(f.db.prepare("SELECT count(*) n FROM SetorPermissao").get()!.n).toBe(0);
    expect(f.db.prepare("SELECT role,permissoes FROM usuarios WHERE id=10").get()).toMatchObject({ role: LEADER_ROLE, permissoes: legacy });
  });

  it("CLI supports both secret-free dry-runs and still refuses apply without explicit staging gates", async () => {
    const f = fixture(); const cli = path.join(root, "scripts/checklist-analistas/cli.mjs");
    for (const operation of ["hash-contas", "habilitar-lider-checklist"]) {
      const output = JSON.parse(execFileSync(process.execPath, [cli, "plan", "--operation", operation, "--database-url", f.url], { encoding: "utf8" }));
      expect(output).toMatchObject({ mode: "dry-run", mutations: 0 });
      for (const secret of passwords) expect(JSON.stringify(output)).not.toContain(secret);
      expect(() => execFileSync(process.execPath, [cli, "plan", "--operation", operation, "--apply", "--database-url", f.url], { stdio: "pipe" })).toThrow();
    }
  });
});
