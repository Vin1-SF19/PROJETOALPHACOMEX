import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => { exec(sql: string): void; close(): void; prepare(sql: string): { get(): Record<string, unknown> | undefined } };
};

const dirs: string[] = [];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function fixture(eventCount = 1) {
  const dir = mkdtempSync(join(tmpdir(), "rd-recovery-test-")); dirs.push(dir);
  const url = `file:${join(dir, "test.db")}`;
  let sql = `
    CREATE TABLE BpmCard (id TEXT PRIMARY KEY,empresaId INTEGER,pipelineId TEXT,etapaId TEXT,servico TEXT,updatedAt TEXT);
    CREATE TABLE BpmCardOrigemExterna (id TEXT PRIMARY KEY,cardId TEXT,provider TEXT,rawJson TEXT);
    CREATE TABLE BpmEventoExternoCard (id TEXT PRIMARY KEY,origemId TEXT,rawJson TEXT,projectedJson TEXT,updatedAt TEXT);
    CREATE TABLE BpmEventoExternoCorrecao (id TEXT PRIMARY KEY,eventoId TEXT,versao INTEGER,camposAlteradosJson TEXT,projecaoAnteriorJson TEXT,projecaoNovaJson TEXT,autorId INTEGER,UNIQUE(eventoId,versao));
    CREATE TABLE BpmCardServicoContexto (cardId TEXT PRIMARY KEY,clienteServicoId INTEGER,nomeLegado TEXT,createdAt TEXT,updatedAt TEXT);
    CREATE TABLE ClienteServico (id INTEGER PRIMARY KEY,clienteId INTEGER,servico TEXT);
    CREATE TABLE BpmCardHistorico (id TEXT PRIMARY KEY,cardId TEXT,acao TEXT,valorAnteriorJson TEXT,valorNovoJson TEXT,automacaoOrigem TEXT);
    INSERT INTO BpmCard VALUES ('card',1,'pipeline','stage',NULL,NULL);
    INSERT INTO BpmCardOrigemExterna VALUES ('origin','card','RD_STATION_CRM_V1','{}');
    INSERT INTO BpmEventoExternoCard VALUES ('event','origin','{"id":"rd-event"}','{"title":"Mudança de etapa RD"}',NULL);
    INSERT INTO ClienteServico VALUES (1,1,'Revisão RADAR - ILIMITADO');
  `;
  for (let i = 2; i <= eventCount; i++) sql += `INSERT INTO BpmEventoExternoCard VALUES ('event-${i}','origin','{"id":"rd-event"}','{"title":"Mudança de etapa RD"}',NULL);`;
  const db = new DatabaseSync(join(dir, "test.db")); db.exec(sql); db.close();
  const backup = join(dir, "backup.sql"); writeFileSync(backup, sql);
  writeFileSync(join(dir, "backup.manifest.json"), JSON.stringify({ generatedAt: new Date().toISOString(), databaseHash: sha(url), sha256: sha(sql), sizeBytes: Buffer.byteLength(sql), tables: 7, totalRows: 3 + eventCount }));
  const plan = { version: 1, databaseHash: sha(url), eventChanges: [{ id: "event", origemId: "origin", rawHash: sha('{"id":"rd-event"}'), before: '{"title":"Mudança de etapa RD"}', after: '{"title":"Revisão","sourceStageName":"Revisão"}', version: 1 }], serviceChanges: [{ cardId: "card", origemId: "origin", empresaId: 1, pipelineId: "pipeline", etapaId: "stage", rawHash: sha("{}"), before: null, after: "Revisão RADAR - ILIMITADO", clienteServicoId: 1, evidence: ["Modalidade sintética"] }] };
  for (let i = 2; i <= eventCount; i++) plan.eventChanges.push({ ...plan.eventChanges[0], id: `event-${i}` });
  const fingerprint = sha(JSON.stringify(plan));
  const planPath = join(dir, "plan.json"); writeFileSync(planPath, JSON.stringify({ ...plan, fingerprint }));
  const run = (confirm = fingerprint, includeBackup = true, mode = "apply") => spawnSync(process.execPath, ["--import", "tsx", "scripts/recuperar-rd-alpha.mjs", mode, `--plan=${planPath}`, `--confirm=${confirm}`, ...(includeBackup ? [`--backup=${backup}`] : [])], { cwd: process.cwd(), env: { ...process.env, TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: "" }, encoding: "utf8", timeout: 15000 });
  return { dir, run, backup, rollback: () => run(`rollback:${fingerprint}`, true, "rollback"), verify: () => run(undefined, false, "verify") };
}

describe("CLI de recuperação — banco sintético isolado", () => {
  it("aplica com auditoria, preserva payload e não duplica na retomada", () => {
    const f = fixture();
    const first = f.run(); expect(first.stderr + first.stdout).not.toContain("Error:"); expect(first.status).toBe(0);
    const second = f.run(); expect(second.status).toBe(0); expect(second.stdout).toContain('"alreadyApplied":2');
    const db = new DatabaseSync(join(f.dir, "test.db"));
    expect(db.prepare("SELECT rawJson FROM BpmEventoExternoCard").get()?.rawJson).toBe('{"id":"rd-event"}');
    expect(db.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(1);
    expect(db.prepare("SELECT COUNT(*) n FROM BpmCardHistorico").get()?.n).toBe(1);
    expect(db.prepare("SELECT servico FROM BpmCard").get()?.servico).toBe("Revisão RADAR - ILIMITADO");
    db.close();
  });
  it("conflito no lote desfaz todos os itens desse lote", () => {
    const f = fixture(2); const db = new DatabaseSync(join(f.dir, "test.db"));
    db.exec(`UPDATE BpmEventoExternoCard SET projectedJson='{"title":"Edição humana"}' WHERE id='event-2'`); db.close();
    const result = f.run(); expect(result.status).not.toBe(0); expect(result.stderr).toContain("Evento mudou");
    const check = new DatabaseSync(join(f.dir, "test.db"));
    expect(check.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(0);
    expect(check.prepare("SELECT projectedJson FROM BpmEventoExternoCard WHERE id='event'").get()?.projectedJson).toBe('{"title":"Mudança de etapa RD"}');
    check.close();
  });
  it("retoma após lote confirmado sem duplicar auditoria", () => {
    const f = fixture(26); const db = new DatabaseSync(join(f.dir, "test.db"));
    db.exec(`UPDATE BpmEventoExternoCard SET projectedJson='{"title":"Edição humana"}' WHERE id='event-26'`); db.close();
    expect(f.run().status).not.toBe(0);
    const check = new DatabaseSync(join(f.dir, "test.db"));
    expect(check.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(25);
    check.exec(`UPDATE BpmEventoExternoCard SET projectedJson='{"title":"Mudança de etapa RD"}' WHERE id='event-26'`); check.close();
    const resumed = f.run(); expect(resumed.status).toBe(0); expect(resumed.stdout).toContain('"alreadyApplied":25');
    const final = new DatabaseSync(join(f.dir, "test.db"));
    expect(final.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(26);
    expect(final.prepare("SELECT COUNT(*) n FROM BpmCardHistorico").get()?.n).toBe(1); final.close();
    expect(f.rollback().status).toBe(0);
  });
  it("bloqueia confirmação incorreta e ausência de backup sem escrever", () => {
    const f = fixture();
    expect(f.run("wrong").status).not.toBe(0);
    expect(f.run(undefined, false).status).not.toBe(0);
    const db = new DatabaseSync(join(f.dir, "test.db"));
    expect(db.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(0);
    db.close();
  });
  it("bloqueia backup adulterado", () => {
    const f = fixture(); writeFileSync(f.backup, "corrompido");
    const result = f.run(); expect(result.status).not.toBe(0); expect(result.stderr).toContain("divergentes");
  });
  it("não sobrescreve correção feita após a prévia", () => {
    const f = fixture(); const db = new DatabaseSync(join(f.dir, "test.db"));
    db.exec(`UPDATE BpmEventoExternoCard SET projectedJson='{"title":"Editado pelo usuário"}'`); db.close();
    const result = f.run(); expect(result.status).not.toBe(0); expect(result.stderr).toContain("Evento mudou");
    const check = new DatabaseSync(join(f.dir, "test.db"));
    expect(check.prepare("SELECT servico FROM BpmCard").get()?.servico).toBeNull(); check.close();
  });
  it("reverte seletivamente mantendo auditoria e sem duplicar a compensação", () => {
    const f = fixture(); expect(f.run().status).toBe(0);
    const result = f.rollback(); expect(result.stderr + result.stdout).not.toContain("Error:"); expect(result.status).toBe(0);
    expect(f.rollback().status).toBe(0);
    const db = new DatabaseSync(join(f.dir, "test.db"));
    expect(db.prepare("SELECT servico FROM BpmCard").get()?.servico).toBeNull();
    expect(db.prepare("SELECT COUNT(*) n FROM BpmCardServicoContexto").get()?.n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(2);
    expect(db.prepare("SELECT rawJson FROM BpmEventoExternoCard").get()?.rawJson).toBe('{"id":"rd-event"}');
    db.close();
    expect(f.run().status).not.toBe(0);
  });
  it("rollback não apaga edição posterior feita por pessoa", () => {
    const f = fixture(); expect(f.run().status).toBe(0);
    const db = new DatabaseSync(join(f.dir, "test.db")); db.exec(`UPDATE BpmEventoExternoCard SET projectedJson='{"title":"Ajuste posterior"}'`); db.close();
    const result = f.rollback(); expect(result.status).not.toBe(0); expect(result.stderr).toContain("alterações posteriores");
  });
  it("reconciliação distingue execução anterior de estado atual", () => {
    const f = fixture(); expect(f.run().status).toBe(0);
    const db = new DatabaseSync(join(f.dir, "test.db")); db.exec(`UPDATE BpmEventoExternoCard SET projectedJson='{"title":"Ajuste posterior"}'`); db.close();
    const result = f.verify(); expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout.trim()).report;
    expect(report).toMatchObject({ eventsApplied: 1, eventsMatchingPlan: 0, servicesApplied: 1, servicesMatchingPlan: 1, contextsMatchingPlan: 1, changedOriginals: 0 });
  });
});
