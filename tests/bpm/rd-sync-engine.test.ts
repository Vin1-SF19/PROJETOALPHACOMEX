import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applySyncChange, guard, hash, stableId, statement, stateHash, verifySyncChange } from "../../scripts/lib/rd-sync-engine.mjs";

let db: Client;
let dir: string;
const fingerprint = hash("synthetic-approved-preview");
const select = "SELECT id,cardId,valor FROM CampoValor WHERE id=?";
const change = (id = "value-a") => ({
  key: `field:${id}`, cardId: "card", label: "Campo preenchido por origem verificada",
  before: [guard(select, [id], [])],
  after: [guard(select, [id], [{ id, cardId: "card", valor: "Valor recuperado" }])],
  writes: [statement("INSERT INTO CampoValor (id,cardId,valor) VALUES (?,?,?)", [id, "card", "Valor recuperado"])],
  undo: [statement("DELETE FROM CampoValor WHERE id=?", [id])],
});
const count = async (table: "CampoValor" | "BpmCardHistorico" | "BpmCard") => Number((await db.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n);

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "rd-sync-qa-"));
  db = createClient({ url: `file:${join(dir, "db.sqlite")}` });
  await db.execute("PRAGMA foreign_keys=ON");
  await db.execute("CREATE TABLE BpmCard (id TEXT PRIMARY KEY, status TEXT NOT NULL)");
  await db.execute("CREATE TABLE CampoValor (id TEXT PRIMARY KEY, cardId TEXT NOT NULL REFERENCES BpmCard(id), valor TEXT NOT NULL)");
  await db.execute("CREATE TABLE BpmCardHistorico (id TEXT PRIMARY KEY, cardId TEXT NOT NULL REFERENCES BpmCard(id), acao TEXT NOT NULL, valorAnteriorJson TEXT, valorNovoJson TEXT, automacaoOrigem TEXT NOT NULL, createdAt TEXT NOT NULL)");
  await db.execute("INSERT INTO BpmCard VALUES ('card','ATIVO')");
});
afterEach(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

describe("sincronização guardada em SQLite real", () => {
  it("aplica estado e auditoria atomicamente, repete sem duplicar e reverte com histórico preservado", async () => {
    const c = change();
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: false, rolledBack: false, stateMatches: true });
    expect(await applySyncChange(db, c, fingerprint)).toEqual({ applied: 1, skipped: 0 });
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: true, rolledBack: false, stateMatches: true });
    const audit = (await db.execute(statement("SELECT * FROM BpmCardHistorico WHERE id=?", [stableId("rdsync", fingerprint, c.key)]))).rows[0];
    expect(audit).toMatchObject({ cardId: "card", acao: "RD_DADOS_PREENCHIDOS", automacaoOrigem: "RD_STATION_FIELDS_SYNC" });
    expect(JSON.parse(String(audit.valorAnteriorJson))).toEqual({ operacao: c.key, descricao: c.label, plano: fingerprint, estado: c.before.map(check => check.hash) });
    expect(JSON.parse(String(audit.valorNovoJson))).toEqual({ operacao: c.key, descricao: c.label, plano: fingerprint, estado: c.after.map(check => check.hash) });
    expect(String(audit.valorAnteriorJson)).not.toContain("SELECT");
    expect(String(audit.valorNovoJson)).not.toContain("SELECT");
    expect(String(audit.valorNovoJson)).not.toContain('"args"');
    expect(await applySyncChange(db, c, fingerprint)).toEqual({ applied: 0, skipped: 1 });
    expect(await count("CampoValor")).toBe(1);
    expect(await count("BpmCardHistorico")).toBe(1);
    expect(await applySyncChange(db, c, fingerprint, { rollback: true })).toEqual({ applied: 1, skipped: 0 });
    expect(await count("CampoValor")).toBe(0);
    expect(await count("BpmCardHistorico")).toBe(2);
    expect((await db.execute(statement("SELECT acao,automacaoOrigem FROM BpmCardHistorico WHERE id=?", [stableId("rdsyncundo", fingerprint, c.key)]))).rows[0]).toEqual({ acao: "RD_DADOS_REVERTIDOS", automacaoOrigem: "RD_STATION_FIELDS_ROLLBACK" });
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: true, rolledBack: true, stateMatches: true });
    expect(await applySyncChange(db, c, fingerprint, { rollback: true })).toEqual({ applied: 0, skipped: 1 });
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow("Plano já revertido");
  });

  it("protege pré-condições humanas antes de qualquer escrita e não marca falsa aplicação", async () => {
    await db.execute("INSERT INTO CampoValor VALUES ('value-a','card','Edição humana')");
    const c = change();
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow("Estado mudou desde a prévia");
    expect((await db.execute(statement(select, ["value-a"]))).rows[0].valor).toBe("Edição humana");
    expect(await count("BpmCardHistorico")).toBe(0);
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: false, rolledBack: false, stateMatches: false });
  });

  it("auditoria inclui evidência por campo sem persistir SQL ou argumentos de guards", async () => {
    const c = { ...change(), evidence: [{ entity: "CLIENTE", attribute: "uf", source: "Estado", before: null, after: "SP" }] };
    await applySyncChange(db, c, fingerprint);
    const applied = (await db.execute("SELECT valorNovoJson FROM BpmCardHistorico")).rows[0];
    expect(JSON.parse(String(applied.valorNovoJson))).toMatchObject({ campos: c.evidence, estado: c.after.map(check => check.hash) });
    await applySyncChange(db, c, fingerprint, { rollback: true });
    const undone = (await db.execute(statement("SELECT valorAnteriorJson,valorNovoJson FROM BpmCardHistorico WHERE id=?", [stableId("rdsyncundo", fingerprint, c.key)]))).rows[0];
    expect(JSON.parse(String(undone.valorAnteriorJson))).toMatchObject({ estado: c.after.map(check => check.hash) });
    expect(JSON.parse(String(undone.valorNovoJson))).toMatchObject({ estado: c.before.map(check => check.hash), campos: c.evidence });
    expect(JSON.stringify(undone)).not.toContain("SELECT");
    expect(JSON.stringify(undone)).not.toContain('\\"args\\"');
  });

  it("valida pós-condição antes do commit e desfaz todas as escritas se o resultado divergir", async () => {
    const c = change();
    c.writes.push(statement("UPDATE CampoValor SET valor=? WHERE id=?", ["Valor inesperado", "value-a"]));
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow("Estado após escrita diverge");
    expect(await count("CampoValor")).toBe(0);
    expect(await count("BpmCardHistorico")).toBe(0);
  });

  it("falha SQL ou FK no fim reverte valores anteriores e auditoria", async () => {
    const c = change();
    c.writes.push(statement("INSERT INTO CampoValor VALUES (?,?,?)", ["invalid", "missing-card", "x"]));
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow();
    expect(await count("CampoValor")).toBe(0);
    expect(await count("BpmCardHistorico")).toBe(0);
    const badAudit = { ...change(), cardId: "missing-card" };
    await expect(applySyncChange(db, badAudit, fingerprint)).rejects.toThrow();
    expect(await count("CampoValor")).toBe(0);
  });

  it("retentativa e rollback não confiam apenas no marcador quando há edição posterior", async () => {
    const c = change();
    await applySyncChange(db, c, fingerprint);
    await db.execute("UPDATE CampoValor SET valor='Valor humano' WHERE id='value-a'");
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: true, rolledBack: false, stateMatches: false });
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow("Estado mudou após operação auditada");
    await expect(applySyncChange(db, c, fingerprint, { rollback: true })).rejects.toThrow("Estado mudou desde a prévia");
    expect((await db.execute(statement(select, ["value-a"]))).rows[0].valor).toBe("Valor humano");
    expect(await count("BpmCardHistorico")).toBe(1);
  });

  it("retoma operações independentes sem repetir a primeira e ignora undo nunca aplicado", async () => {
    const first = change("a"), second = change("b");
    expect(await applySyncChange(db, second, fingerprint, { rollback: true })).toEqual({ applied: 0, skipped: 1 });
    await applySyncChange(db, first, fingerprint);
    expect(await applySyncChange(db, first, fingerprint)).toEqual({ applied: 0, skipped: 1 });
    expect(await applySyncChange(db, second, fingerprint)).toEqual({ applied: 1, skipped: 0 });
    expect(await count("CampoValor")).toBe(2);
    expect(await count("BpmCardHistorico")).toBe(2);
  });

  it("rollback compensa card novo arquivando e mantém auditoria com FK real", async () => {
    const sql = "SELECT id,status FROM BpmCard WHERE id=?";
    const c = {
      key: "newcard:rd-new", cardId: "new-card", label: "Novo card RD",
      before: [guard(sql, ["new-card"], [])],
      after: [guard(sql, ["new-card"], [{ id: "new-card", status: "ATIVO" }])],
      rollbackAfter: [guard(sql, ["new-card"], [{ id: "new-card", status: "ARQUIVADO" }])],
      writes: [statement("INSERT INTO BpmCard VALUES (?,?)", ["new-card", "ATIVO"])],
      undo: [statement("UPDATE BpmCard SET status=? WHERE id=?", ["ARQUIVADO", "new-card"])],
    };
    await applySyncChange(db, c, fingerprint);
    await applySyncChange(db, c, fingerprint, { rollback: true });
    expect((await db.execute(statement(sql, ["new-card"]))).rows[0].status).toBe("ARQUIVADO");
    expect(await count("BpmCardHistorico")).toBe(2);
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: true, rolledBack: true, stateMatches: true });
    expect(await applySyncChange(db, c, fingerprint, { rollback: true })).toEqual({ applied: 0, skipped: 1 });
    await db.execute("UPDATE BpmCard SET status='ATIVO' WHERE id='new-card'");
    await expect(applySyncChange(db, c, fingerprint, { rollback: true })).rejects.toThrow("Estado mudou");
  });

  it("não desfaz dependência nova nem registra reversão quando undo falha", async () => {
    await db.execute("CREATE TABLE Dependencia (id TEXT PRIMARY KEY, valorId TEXT REFERENCES CampoValor(id))");
    const c = change();
    c.after.push(guard("SELECT id FROM Dependencia WHERE valorId=? ORDER BY id", ["value-a"], []));
    await applySyncChange(db, c, fingerprint);
    await db.execute("INSERT INTO Dependencia VALUES ('new','value-a')");
    await expect(applySyncChange(db, c, fingerprint, { rollback: true })).rejects.toThrow("Estado mudou");
    await db.execute("DELETE FROM Dependencia");
    c.undo.push(statement("DELETE FROM TabelaInexistente", []));
    await expect(applySyncChange(db, c, fingerprint, { rollback: true })).rejects.toThrow();
    expect(await count("CampoValor")).toBe(1);
    expect(await count("BpmCardHistorico")).toBe(1);
  });

  it("undo com resultado diferente desfaz a própria compensação", async () => {
    const c = change();
    await applySyncChange(db, c, fingerprint);
    c.undo = [statement("UPDATE CampoValor SET valor='undo errado' WHERE id=?", ["value-a"])];
    await expect(applySyncChange(db, c, fingerprint, { rollback: true })).rejects.toThrow("Estado após escrita diverge");
    expect((await db.execute(statement(select, ["value-a"]))).rows[0].valor).toBe("Valor recuperado");
    expect(await count("BpmCardHistorico")).toBe(1);
  });

  it("rejeita marker incompatível em vez de ignorar a operação", async () => {
    const c = change();
    await db.execute(statement("INSERT INTO BpmCardHistorico VALUES (?,?,?,NULL,NULL,?,CURRENT_TIMESTAMP)", [stableId("rdsync", fingerprint, c.key), "card", "ACAO_ERRADA", "RD_STATION_FIELDS_SYNC"]));
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow("Auditoria existente incompatível");
    expect(await count("CampoValor")).toBe(0);
  });

  it.each(["", "preview-confirmada", "a".repeat(63), "g".repeat(64)])("recusa fingerprint inválido %j", async (invalid) => {
    await expect(applySyncChange(db, change(), invalid)).rejects.toThrow("Fingerprint");
    await expect(verifySyncChange(db, change(), invalid)).rejects.toThrow("Fingerprint");
    expect(await count("CampoValor")).toBe(0);
  });

  it.each([
    "DELETE FROM CampoValor", "UPDATE CampoValor SET valor='x'", "REPLACE INTO CampoValor VALUES ('x','card','x')",
    "SELECT 1 REPLACE INTO CampoValor VALUES ('x','card','x')", "SELECT 1; DELETE FROM CampoValor",
    "SELECT 1 -- comment", "SELECT /* comment */ 1", "PRAGMA foreign_keys=OFF", "PRAGMA foreign_keys(OFF)",
    "PRAGMA user_version(123)", "PRAGMA schema_version=3", "PRAGMA writable_schema=ON", "PRAGMA journal_mode(WAL)",
    "SELECT load_extension('x')", "SELECT writefile('x','y')", "WITH x AS (SELECT 1) DELETE FROM CampoValor",
  ])("recusa guard de leitura inseguro: %s", async (sql) => {
    expect(() => guard(sql, [], [])).toThrow();
    const c = change();
    c.before = [{ sql, args: [], hash: stateHash([]) }];
    await expect(applySyncChange(db, c, fingerprint)).rejects.toThrow();
    expect(await count("CampoValor")).toBe(0);
  });

  it("recusa argumentos extras, ausentes, nomeados e inválidos antes de execução", () => {
    expect(() => guard("SELECT 1", ["extra"], [])).toThrow("Argumentos SQL inesperados");
    expect(() => guard("SELECT ?", [], [])).toThrow("Argumentos SQL inesperados");
    expect(() => guard("SELECT ?1", ["x"], [])).toThrow("Argumentos SQL inesperados");
    expect(() => guard("SELECT :value", ["x"], [])).toThrow("Argumentos SQL inesperados");
    for (const value of [undefined, {}, NaN, Infinity]) expect(() => guard("SELECT ?", [value], [])).toThrow("Argumento SQL inválido");
    expect(() => guard("SELECT '?' literal, ? value", [1], [])).not.toThrow();
  });

  it("aceita PRAGMA de inspeção e verify permanece sem efeitos", async () => {
    const c = change();
    const rows = (await db.execute("PRAGMA table_info('BpmCard')")).rows.map(row => ({ ...row }));
    c.before.push(guard("PRAGMA table_info('BpmCard')", [], rows));
    expect(await verifySyncChange(db, c, fingerprint)).toMatchObject({ stateMatches: true, applied: false });
    expect(await count("BpmCardHistorico")).toBe(0);
    expect(await count("CampoValor")).toBe(0);
    await applySyncChange(db, c, fingerprint);
    expect(await db.execute("PRAGMA foreign_key_check")).toMatchObject({ rows: [] });
  });

  it("aceita replace aninhado para identificar telefone por SELECT real sem efeitos", async () => {
    const c = change();
    const sql = "SELECT replace(replace(?, '(', ''), ')', '') AS telefone";
    c.before.push(guard(sql, ["(11999999999)"], [{ telefone: "11999999999" }]));
    expect(await verifySyncChange(db, c, fingerprint)).toEqual({ applied: false, rolledBack: false, stateMatches: true });
    expect(await applySyncChange(db, c, fingerprint)).toEqual({ applied: 1, skipped: 0 });
    expect(await count("CampoValor")).toBe(1);
    expect(await count("BpmCardHistorico")).toBe(1);
  });
});

describe("hash de estado do sync", () => {
  it.each(["createdAt", "updatedAt", "criadoEm", "dataReuniao", "proximoContatoEm", "iniciadoEm", "concluidoEm"])("compara instante UTC de %s", (field) => {
    const iso = "2026-10-16T14:00:00.123Z";
    const expected = stateHash([{ [field]: iso }]);
    for (const value of ["2026-10-16 14:00:00.123", "2026-10-16T14:00:00.123", "2026-10-16T11:00:00.123-03:00", Date.parse(iso), BigInt(Date.parse(iso))]) {
      expect(stateHash([{ [field]: value }])).toBe(expected);
    }
    expect(stateHash([{ [field]: "2026-10-16T14:00:00.124Z" }])).not.toBe(expected);
  });
  it("preserva JSON textual, ordem de linhas, null e datas sem coluna conhecida", () => {
    expect(stateHash([{ rawJson: '{"createdAt":"2026-10-16 14:00:00"}' }])).not.toBe(stateHash([{ rawJson: '{"createdAt":"2026-10-16T14:00:00.000Z"}' }]));
    expect(stateHash([{ rawJson: '{"a":1,"b":2}' }])).not.toBe(stateHash([{ rawJson: '{"b":2,"a":1}' }]));
    expect(stateHash([{ rdDate: "2026-10-16 14:00:00" }])).not.toBe(stateHash([{ rdDate: "2026-10-16T14:00:00.000Z" }]));
    expect(stateHash([{ updatedAt: null }])).not.toBe(stateHash([{ updatedAt: 0 }]));
    expect(stateHash([{ id: "a" }, { id: "b" }])).not.toBe(stateHash([{ id: "b" }, { id: "a" }]));
    expect(hash([{ a: 1, b: { y: 2, x: 3 } }])).toBe(hash([{ b: { x: 3, y: 2 }, a: 1 }]));
  });
});
