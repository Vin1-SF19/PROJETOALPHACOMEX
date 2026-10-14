import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyRecoveryBatch, guard, hash, projectTask, stableId, statement, stateHash } from "../../scripts/lib/rd-complement-recovery.mjs";

let db: Client;
let dir: string;
const fingerprint = "preview-confirmada";
const select = "SELECT id,titulo,status FROM BpmTarefa WHERE id=?";
const change = (id: string) => {
  const data = { id, titulo: `Tarefa ${id}`, status: "PENDENTE" };
  return {
    key: `task:${id}`, cardId: "card", label: "Tarefa recuperada",
    before: [guard(select, [id], [])], after: [guard(select, [id], [data])],
    writes: [statement("INSERT INTO BpmTarefa (id,titulo,status) VALUES (?,?,?)", [id, data.titulo, data.status])],
    undo: [statement("DELETE FROM BpmTarefa WHERE id=?", [id])],
  };
};
const count = async (table: "BpmTarefa" | "BpmCardHistorico") => Number((await db.execute(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n);
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "rd-complement-qa-"));
  db = createClient({ url: `file:${join(dir, "db.sqlite")}` });
  await db.execute("CREATE TABLE BpmTarefa (id TEXT PRIMARY KEY, titulo TEXT NOT NULL, status TEXT NOT NULL)");
  await db.execute("CREATE TABLE BpmCardHistorico (id TEXT PRIMARY KEY, cardId TEXT NOT NULL, acao TEXT NOT NULL, valorNovoJson TEXT, automacaoOrigem TEXT, createdAt TEXT)");
});
afterEach(() => { db.close(); rmSync(dir, { recursive: true, force: true }); });

describe("recuperação complementar em SQLite real", () => {
  it("aplica tarefa e auditoria juntas, repete sem duplicar e reverte idempotentemente", async () => {
    const changes = [change("a"), change("b")];
    expect(await applyRecoveryBatch(db, changes, fingerprint)).toEqual({ applied: 2, skipped: 0 });
    expect(await count("BpmTarefa")).toBe(2);
    const audit = await db.execute(statement("SELECT acao,automacaoOrigem,valorNovoJson FROM BpmCardHistorico WHERE id=?", [stableId("rdcomp", fingerprint, "task:a")]));
    expect(audit.rows[0]).toMatchObject({ acao: "RD_COMPLEMENTO_IMPORTADO", automacaoOrigem: "RD_STATION_COMPLEMENT_RECOVERY" });
    expect(JSON.parse(String(audit.rows[0].valorNovoJson))).toEqual({ descricao: "Tarefa recuperada", plano: fingerprint });
    expect(await applyRecoveryBatch(db, changes, fingerprint)).toEqual({ applied: 0, skipped: 2 });
    expect(await count("BpmCardHistorico")).toBe(2);
    expect(await applyRecoveryBatch(db, [...changes].reverse(), fingerprint, true)).toEqual({ applied: 2, skipped: 0 });
    expect(await count("BpmTarefa")).toBe(0);
    expect(await count("BpmCardHistorico")).toBe(4);
    expect((await db.execute("SELECT COUNT(*) n FROM BpmCardHistorico WHERE acao='RD_COMPLEMENTO_REVERTIDO'")).rows[0].n).toBe(2);
    await expect(applyRecoveryBatch(db, changes, fingerprint)).rejects.toThrow("Plano já revertido");
    expect(await applyRecoveryBatch(db, changes, fingerprint, true)).toEqual({ applied: 0, skipped: 2 });
  });
  it("guarda divergente bloqueia o lote inteiro antes da primeira escrita", async () => {
    await db.execute("INSERT INTO BpmTarefa VALUES ('b','Edição posterior','PENDENTE')");
    await expect(applyRecoveryBatch(db, [change("a"), change("b")], fingerprint)).rejects.toThrow("Estado mudou");
    expect(await count("BpmTarefa")).toBe(1);
    expect((await db.execute(statement(select, ["b"]))).rows[0].titulo).toBe("Edição posterior");
    expect(await count("BpmCardHistorico")).toBe(0);
  });
  it("erro SQL no fim desfaz escritas e marcadores anteriores do mesmo lote", async () => {
    const invalid = change("b");
    invalid.writes.push(statement("INSERT INTO TabelaInexistente VALUES (1)"));
    await expect(applyRecoveryBatch(db, [change("a"), invalid], fingerprint)).rejects.toThrow();
    expect(await count("BpmTarefa")).toBe(0);
    expect(await count("BpmCardHistorico")).toBe(0);
  });
  it("rollback recusa qualquer edição posterior sem desfazer parte do lote", async () => {
    const changes = [change("a"), change("b")];
    await applyRecoveryBatch(db, changes, fingerprint);
    await db.execute("UPDATE BpmTarefa SET status='CONCLUIDA' WHERE id='b'");
    await expect(applyRecoveryBatch(db, changes, fingerprint, true)).rejects.toThrow("Estado mudou");
    expect(await count("BpmTarefa")).toBe(2);
    expect(await count("BpmCardHistorico")).toBe(2);
    expect((await db.execute(statement(select, ["b"]))).rows[0].status).toBe("CONCLUIDA");
  });
  it("retoma lote parcialmente aplicado sem repetir os itens já auditados", async () => {
    await applyRecoveryBatch(db, [change("a")], fingerprint);
    expect(await applyRecoveryBatch(db, [change("a"), change("b")], fingerprint)).toEqual({ applied: 1, skipped: 1 });
    expect(await count("BpmTarefa")).toBe(2);
    expect(await count("BpmCardHistorico")).toBe(2);
  });
  it("protege relações novas no rollback mesmo quando a tarefa original não mudou", async () => {
    await db.execute("CREATE TABLE Correcao (id TEXT PRIMARY KEY, tarefaId TEXT NOT NULL)");
    const c = change("a");
    c.after.push(guard("SELECT id FROM Correcao WHERE tarefaId=? ORDER BY id", ["a"], []));
    await applyRecoveryBatch(db, [c], fingerprint);
    await db.execute("INSERT INTO Correcao VALUES ('humana','a')");
    await expect(applyRecoveryBatch(db, [c], fingerprint, true)).rejects.toThrow("Estado mudou");
    expect(await count("BpmTarefa")).toBe(1);
    expect(await count("BpmCardHistorico")).toBe(1);
    expect((await db.execute("SELECT id FROM Correcao")).rows[0].id).toBe("humana");
  });
  it("falha durante undo reverte exclusões e não registra auditoria falsa de rollback", async () => {
    const changes = [change("a"), change("b")];
    await applyRecoveryBatch(db, changes, fingerprint);
    changes[1].undo.push(statement("DELETE FROM TabelaInexistente"));
    await expect(applyRecoveryBatch(db, changes, fingerprint, true)).rejects.toThrow();
    expect(await count("BpmTarefa")).toBe(2);
    expect(await count("BpmCardHistorico")).toBe(2);
    expect((await db.execute("SELECT COUNT(*) n FROM BpmCardHistorico WHERE acao='RD_COMPLEMENTO_REVERTIDO'")).rows[0].n).toBe(0);
  });
  it("guard compara DATETIME pelo instante UTC e bloqueia edição temporal posterior", async () => {
    await db.execute("ALTER TABLE BpmTarefa ADD COLUMN updatedAt TEXT");
    await db.execute("INSERT INTO BpmTarefa VALUES ('a','Tarefa a','PENDENTE','2025-09-28 11:45:35')");
    const sql = "SELECT id,titulo,status,updatedAt FROM BpmTarefa WHERE id=?";
    const before = { id: "a", titulo: "Tarefa a", status: "PENDENTE", updatedAt: "2025-09-28T11:45:35.000Z" };
    const c = {
      ...change("a"), before: [guard(sql, ["a"], [before])],
      after: [guard(sql, ["a"], [{ ...before, status: "CONCLUIDA" }])],
      writes: [statement("UPDATE BpmTarefa SET status='CONCLUIDA' WHERE id='a'")],
      undo: [statement("UPDATE BpmTarefa SET status='PENDENTE' WHERE id='a'")],
    };
    expect(await applyRecoveryBatch(db, [c], fingerprint)).toEqual({ applied: 1, skipped: 0 });
    await db.execute("UPDATE BpmTarefa SET updatedAt='2025-09-28 11:45:36' WHERE id='a'");
    await expect(applyRecoveryBatch(db, [c], fingerprint, true)).rejects.toThrow("Estado mudou");
    expect((await db.execute(sql.replace("?", "'a'"))).rows[0].status).toBe("CONCLUIDA");
    expect(await count("BpmCardHistorico")).toBe(1);
  });
  it("hash ignora ordem de propriedades, preserva ordem das linhas e roda guard real", async () => {
    expect(hash([{ a: 1, b: { x: 2, y: 3 } }])).toBe(hash([{ b: { y: 3, x: 2 }, a: 1 }]));
    expect(hash([{ id: "a" }, { id: "b" }])).not.toBe(hash([{ id: "b" }, { id: "a" }]));
    const c = change("a");
    c.after = [guard(select, ["a"], [{ status: "PENDENTE", titulo: "Tarefa a", id: "a" }])];
    await applyRecoveryBatch(db, [c], fingerprint);
    expect(await applyRecoveryBatch(db, [c], fingerprint, true)).toEqual({ applied: 1, skipped: 0 });
    expect(stableId("task", "ab", "c")).not.toBe(stableId("task", "a", "bc"));
  });
});

describe("projeção de tarefas RD", () => {
  const raw = { id: "rd-task", subject: "Retornar ligação", notes: "Observação", type: "call", done: false, created_at: "2025-09-28T08:45:35.880-03:00", date: "2025-09-29T14:16:01.472-03:00", user_ids: ["rd-a"] };
  const users = new Map([["rd-a", 12], ["rd-b", 16]]);
  const names = new Map([["rd-a", "Ana"], ["rd-b", "Bia"]]);
  it("preserva prazo, criação, estado pendente e responsável único sem inventar conclusão", () => {
    const projected = projectTask(raw, users, names);
    expect(projected).toMatchObject({ responsavelId: 12, status: "PENDENTE", tipo: "LIGACAO", createdAt: "2025-09-28T11:45:35.880Z", prazo: "2025-09-29T17:16:01.472Z", concluidaEm: null });
    expect(projected.descricao).toContain("Ana");
  });
  it("preserva conclusão existente e mantém nula a data ausente sem reabrir tarefa", () => {
    expect(projectTask({ ...raw, done: true, done_date: "2025-09-30T10:00:00-03:00" }, users, names)).toMatchObject({ status: "CONCLUIDA", concluidaEm: "2025-09-30T13:00:00.000Z" });
    expect(projectTask({ ...raw, done: true }, users, names)).toMatchObject({ status: "CONCLUIDA", concluidaEm: null });
  });
  it("não escolhe arbitrariamente entre múltiplos responsáveis e preserva nomes na descrição", () => {
    const projected = projectTask({ ...raw, user_ids: ["rd-a", "rd-b"] }, users, names);
    expect(projected.responsavelId).toBeNull();
    expect(projected.descricao).toContain("Ana, Bia");
    expect(projectTask({ ...raw, user_ids: ["rd-a", "rd-a"] }, users, names).responsavelId).toBe(12);
    expect(projectTask({ ...raw, user_ids: ["desconhecido"] }, users, names).responsavelId).toBeNull();
  });
  it("suporta identidade legada e users quando user_ids não existe", () => {
    const legacy = { ...raw, id: undefined, _id: "legado", user_ids: undefined, users: [{ _id: "rd-b" }] };
    expect(projectTask(legacy, users, names).responsavelId).toBe(16);
  });
  it.each([{ id: null }, { created_at: "inválida" }, { date: null }, { done: "false" }])("recusa identidade/data/estado inválidos: %j", (invalid) => {
    expect(() => projectTask({ ...raw, ...invalid }, users, names)).toThrow();
  });
});


describe("hash de estado com datas", () => {
  it.each(["createdAt", "updatedAt", "prazo", "concluidaEm", "alertaEm", "alertaDisparadoEm"])("normaliza somente o instante de %s", (field) => {
    const iso = "2025-09-28T11:45:35.000Z";
    const expected = stateHash([{ [field]: iso }]);
    for (const value of ["2025-09-28 11:45:35", "2025-09-28T08:45:35.000-03:00", Date.parse(iso)]) {
      expect(stateHash([{ [field]: value }])).toBe(expected);
    }
    expect(stateHash([{ [field]: "2025-09-28T11:45:35.001Z" }])).not.toBe(expected);
    expect(stateHash([{ [field]: null }])).not.toBe(expected);
  });
  it("não normaliza payload JSON nem datas textuais de origem fora dos campos DATETIME", () => {
    const original = '{"createdAt":"2025-09-28 11:45:35"}';
    const converted = '{"createdAt":"2025-09-28T11:45:35.000Z"}';
    expect(stateHash([{ rawJson: original }])).not.toBe(stateHash([{ rawJson: converted }]));
    expect(stateHash([{ rawJson: '{"a":1,"b":2}' }])).not.toBe(stateHash([{ rawJson: '{"b":2,"a":1}' }]));
    expect(stateHash([{ occurredAt: "2025-09-28 11:45:35" }])).not.toBe(stateHash([{ occurredAt: "2025-09-28T11:45:35.000Z" }]));
  });
});

it("normaliza a fração de segundo de timestamps SQL como UTC", () => {
  expect(stateHash([{ updatedAt: "2026-10-14 14:00:00.123" }])).toBe(stateHash([{ updatedAt: "2026-10-14T14:00:00.123Z" }]));
});


it("fingerprint do importador original vincula responsável aprovado sem chamar API ou banco", () => {
  const source = readFileSync("scripts/migrar-rd-alpha.mjs", "utf8");
  const expression = source.match(/const fingerprint = (sha\(full\.map[^\n]+);/)?.[1];
  expect(expression).toBeTruthy();
  const deal = { deal: { id: "rd-1" }, detail: { updated_at: "2025-09-28" }, resolvedOwner: 12, events: [{ id: "event" }] };
  const fingerprintFor = (full: unknown[]) => runInNewContext(expression!, { full, sha: hash, json: JSON.stringify }, { timeout: 1000 });
  expect(fingerprintFor([deal])).not.toBe(fingerprintFor([{ ...deal, resolvedOwner: 16 }]));
  expect(fingerprintFor([deal])).not.toBe(fingerprintFor([{ ...deal, resolvedOwner: undefined }]));
  const second = { ...deal, deal: { id: "rd-2" }, resolvedOwner: 22 };
  expect(fingerprintFor([deal, second])).toBe(fingerprintFor([second, deal]));
});
