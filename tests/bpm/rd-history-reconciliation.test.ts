import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void; close(): void;
    prepare(sql: string): { columns(): unknown[]; all(...args: unknown[]): Record<string, unknown>[]; run(...args: unknown[]): unknown; get(...args: unknown[]): Record<string, unknown> | undefined };
  };
};
import { buildHistoryPlan, verifyHistoryRollback, verifyNotesV2 } from "../../scripts/lib/rd-history-reconciliation.mjs";
import { applyRecoveryBatch, stateHash } from "../../scripts/lib/rd-complement-recovery.mjs";
import { collectPages } from "../../scripts/coletar-historico-autoria-rd.mjs";
import { autorAjusteHistoricoRd, apresentarEventoRd, periodoOriginalRd } from "@/lib/bpm/rd-station-display";

function fixture() {
  const raw = { id: "note", deal_id: "deal", user_id: "writer", text: "Original", date: "2026-10-10T12:00:00Z" };
  const original = { id: "event", origemId: "origin", sourceKey: "activity:note", sourceEventId: "note", eventType: "ACTIVITY_NOTE", occurredAt: raw.date,
    rawJson: JSON.stringify(raw), projectedJson: JSON.stringify({ title: "Anotação", type: "ANOTACAO", content: "Original", date: raw.date }) };
  return {
    alpha: { cards: [{ id: "card" }, { id: "native" }], origins: [{ id: "origin", cardId: "card", provider: "RD_STATION_CRM_V1", sourceDealId: "deal" }], events: [original], corrections: [] as Record<string, unknown>[] },
    source: { complete: true, detailCount: 1, deals: { complete: true, rows: [{ id: "deal" }, { id: "unmapped" }] }, activities: { complete: true, rows: [raw] },
      users: { rows: [{ id: "writer", name: "Pessoa original" }, { id: "owner", name: "Responsável atual" }] },
      tasks: { false: { rows: [] as Record<string, unknown>[] }, true: { rows: [] as Record<string, unknown>[] } }, stages: [] },
    usersV2: { data: [{ id: "writer", name: "Pessoa original" }] },
    details: { deal: { complete: true, data: { id: "deal", deal_stage_histories: [] } } },
    databaseHash: "synthetic", sourceHashes: {}, generatedAt: "2026-10-20T12:00:00Z",
  };
}

describe("reconciliação de histórico RD", () => {
  it("recupera autor pelo ID da anotação, preserva bruto e não escreve entidades de negócio", () => {
    const input = fixture(), plan = buildHistoryPlan(input);
    expect(plan.summary).toMatchObject({ alphaCards: 2, linkedCards: 1, unlinkedCards: 1, rdDealsWithoutAlpha: 1, authorNamesRecovered: 1, updates: 1 });
    const next = JSON.parse(plan.changes[0].writes[0].args[0]);
    expect(next.authorName).toBe("Pessoa original");
    expect(next.rdHistorySource.authorId).toBe("writer");
    expect(plan.changes.flatMap((c: { writes: { sql: string }[] }) => c.writes).every((w: { sql: string }) => /^(UPDATE BpmEventoExternoCard|INSERT INTO BpmEventoExternoCorrecao)/.test(w.sql))).toBe(true);
    expect(plan.changes[0].writes[0].sql).not.toContain("rawJson=");
  });
  it("preserva autoria e conteúdo editados manualmente, inclusive campos removidos", () => {
    const input = fixture();
    input.alpha.events[0].projectedJson = JSON.stringify({ title: "Anotação", type: "ANOTACAO", content: "", date: null, authorName: "Autor validado localmente" });
    input.alpha.corrections.push({ id: "manual", eventoId: "event", versao: 1, autorId: 8, camposAlteradosJson: '{"content":true,"date":true,"authorName":true}' });
    const plan = buildHistoryPlan(input);
    expect(plan.changes).toHaveLength(0);
    expect(plan.summary.protectedFields).toBe(3);
  });
  it("não deduz autoria de owner e não limpa nome existente quando fonte não identifica autor", () => {
    const input = fixture();
    input.source.activities.rows[0].user_id = "unknown";
    input.alpha.events[0].projectedJson = JSON.stringify({ title: "Anotação", type: "ANOTACAO", content: "Original", date: input.source.activities.rows[0].date, authorName: "Nome anteriormente comprovado" });
    const plan = buildHistoryPlan(input);
    expect(plan.changes).toHaveLength(0);
    expect(plan.exceptions).toContainEqual(expect.objectContaining({ kind: "note_author_unavailable" }));
  });
  it("bloqueia fontes incompletas ou catálogos de contas sem identidade comum", () => {
    const input = fixture(); input.source.complete = false;
    expect(() => buildHistoryPlan(input)).toThrow("INCOMPLETE_SOURCE");
    input.source.complete = true; input.usersV2.data[0].id = "another-account";
    expect(() => buildHistoryPlan(input)).toThrow("V1_V2_USERS_NOT_MATCHED");
  });
  it("preserva evento ausente na fonte e separa duplicatas ambíguas", () => {
    const input = fixture();
    input.alpha.events.push({ ...input.alpha.events[0], id: "duplicate", sourceKey: "other" });
    expect(buildHistoryPlan(input).changes).toHaveLength(0);
    expect(buildHistoryPlan(input).exceptions).toContainEqual(expect.objectContaining({ kind: "ambiguous_event" }));
    input.source.activities.rows = [];
    expect(buildHistoryPlan(input).exceptions.filter((x: { kind: string }) => x.kind === "existing_event_not_reconciled_preserved")).toHaveLength(2);
  });
  it("preserva nome em conflito entre APIs e registra só a evidência realmente usada", () => {
    const input = fixture();
    input.usersV2.data[0].name = "Outro nome";
    let plan = buildHistoryPlan(input);
    expect(plan.changes).toHaveLength(0);
    expect(plan.exceptions).toContainEqual(expect.objectContaining({ kind: "author_catalogue_conflict" }));
    input.usersV2.data = [{ id: "owner", name: "Responsável atual" }];
    plan = buildHistoryPlan(input);
    expect(JSON.parse(plan.changes[0].writes[0].args[0]).rdHistorySource.authorCatalogue).toBe("RD_V1_EXACT_ID");
  });
  it("não apaga conteúdo e data quando a fonte vem incompleta", () => {
    const input = fixture();
    Reflect.deleteProperty(input.source.activities.rows[0], "text");
    input.source.activities.rows[0].date = "inválida";
    const plan = buildHistoryPlan(input), next = JSON.parse(plan.changes[0].writes[0].args[0]);
    expect(next.content).toBe("Original");
    expect(next.date).toBe("2026-10-10T12:00:00Z");
    expect(next.authorName).toBe("Pessoa original");
  });
  it("não confia só no prefixo de uma correção para sobrescrever campo local", () => {
    const input = fixture();
    input.alpha.corrections.push({ id: `rdrepair_${"a".repeat(28)}`, eventoId: "event", versao: 1, autorId: null, camposAlteradosJson: '{"authorName":true}' });
    expect(buildHistoryPlan(input).changes).toHaveLength(0);
  });
  it("recusa tarefa presente nos dois estados durante coleta", () => {
    const input = fixture();
    input.source.tasks.false.rows.push({ id: "task", deal_id: "deal", done: false });
    input.source.tasks.true.rows.push({ id: "task", deal_id: "deal", done: true });
    expect(() => buildHistoryPlan(input)).toThrow("TASK_MOVED_DURING_COLLECTION");
  });
  it("não cria correção apenas para preencher título genérico já apresentado pela interface", () => {
    const input = fixture();
    input.alpha.events[0].projectedJson = JSON.stringify({ title: null, type: "ANOTACAO", content: "Original", date: input.source.activities.rows[0].date, authorName: "Pessoa original" });
    expect(buildHistoryPlan(input).changes).toHaveLength(0);
  });
  it("não regrava histórico quando só mudou a representação do fuso da data", () => {
    const input = fixture();
    input.alpha.events[0].projectedJson = JSON.stringify({ title: "Anotação", type: "ANOTACAO", content: "Original", date: "2026-10-10T09:00:00-03:00", authorName: "Pessoa original" });
    expect(buildHistoryPlan(input).changes).toHaveLength(0);
  });
});

describe("paginação completa", () => {
  it("confirma identidade V1/V2, bloqueia autor divergente e nota alterada sem cobertura V2", () => {
    const input = fixture(), plan = buildHistoryPlan(input);
    const note = input.source.activities.rows[0];
    const crosscheck = { complete: true, expectedDealIds: ["deal"], rows: [{ dealId: "deal", response: { links: { next: null },
      data: [{ id: note.id, user_id: note.user_id, registered_at: note.date, description: "<p>Original</p>" }] } }] };
    const verify = () => verifyNotesV2({ ...input, crosscheck, changes: plan.changes });
    expect(verify()).toMatchObject({ v2DealsChecked: 1, v2NotesChecked: 1, v2DifferentContentRepresentation: 1 });
    crosscheck.rows[0].response.data[0].user_id = "other";
    expect(verify).toThrow("V1_V2_NOTE_IDENTITY_DIVERGED");
    crosscheck.rows[0].response.data = [];
    expect(verify).toThrow("CHANGED_NOTE_NOT_VERIFIED_V2");
    crosscheck.complete = false;
    expect(verify).toThrow("V2_CROSSCHECK_INCOMPLETE");
  });
  it("usa cursor opaco em negócios e página numérica em atividades", async () => {
    const calls: unknown[] = [];
    await collectPages(async (_: unknown, params: unknown) => {
      calls.push(params);
      return calls.length === 1 ? { deals: [{ id: "1" }], has_more: true, next_page: "opaque" } : { deals: [{ id: "2" }], has_more: false };
    }, "deals");
    expect(calls[1]).toEqual({ limit: 200, next_page: "opaque" });
    const pages: unknown[] = [];
    await collectPages(async (_: unknown, params: unknown) => {
      pages.push(params);
      return pages.length === 1 ? { activities: [{ id: "1" }], has_more: true, next_page: 2 } : { activities: [], has_more: false };
    }, "activities");
    expect(pages[1]).toEqual({ limit: 200, page: 2 });
  });
  it("recusa repetição e falta do marcador de término", async () => {
    await expect(collectPages(async () => ({ deals: [{ id: "1" }], has_more: true, next_page: "same" }), "deals")).rejects.toThrow();
    await expect(collectPages(async () => ({ deals: [] }), "deals")).rejects.toThrow("INVALID_PAGE_OR_END_MARKER");
    await expect(collectPages(async () => [{ id: "1" }], "deals")).rejects.toThrow("INVALID_PAGE_OR_END_MARKER");
  });
});

describe("autoria visível", () => {
  it("distingue correção automática comprovada de correção humana ou desconhecida", () => {
    const correction = { id: `rdrepair_${"a".repeat(28)}`, autorId: null, camposAlteradosJson: '{"title":true,"sourceStageName":true}' };
    expect(autorAjusteHistoricoRd(correction)).toBe("Ajuste automático da importação");
    expect(autorAjusteHistoricoRd({ ...correction, autorId: 8, autor: { nome: "Ana" } })).toBe("Ana");
    expect(autorAjusteHistoricoRd({ ...correction, id: "unknown" })).toBe("Autor do ajuste não identificado");
    expect(autorAjusteHistoricoRd({ ...correction, camposAlteradosJson: '{"authorName":true}' })).toBe("Autor do ajuste não identificado");
  });
  it("não exibe dono da tarefa como autor de anotação", () => {
    expect(apresentarEventoRd({ tipo: "TASK_RD", data: null, projecao: { authorName: "Ana" } }).autor).toBe("Responsável no RD: Ana");
    expect(apresentarEventoRd({ tipo: "ACTIVITY_NOTE", data: null, projecao: { authorName: "Ana" } }).autor).toBe("Ana");
  });
  it("usa período reconciliado sem mudar o bruto e permite saída nula comprovada", () => {
    const raw = { start_date: "2026-01-01", end_date: "2026-01-02" };
    expect(periodoOriginalRd(raw, { rdHistorySource: { version: 1 }, endDate: null }).saida).toBeNull();
    expect(raw.end_date).toBe("2026-01-02");
    expect(periodoOriginalRd(raw, { endDate: null }).saida).toBe("2026-01-02");
  });
});

describe("execução e compensação em SQLite", () => {
  it("aplica sem tocar bruto, repete sem duplicar, reverte com auditoria e bloqueia edição concorrente", async () => {
    const input = fixture(), plan = buildHistoryPlan(input), sqlite = new DatabaseSync(":memory:");
    sqlite.exec(`
      CREATE TABLE BpmCardOrigemExterna(id TEXT PRIMARY KEY,cardId TEXT,provider TEXT,sourceDealId TEXT);
      CREATE TABLE BpmEventoExternoCard(id TEXT PRIMARY KEY,origemId TEXT,sourceKey TEXT,sourceEventId TEXT,eventType TEXT,occurredAt TEXT,rawJson TEXT,projectedJson TEXT,createdAt TEXT,updatedAt TEXT, UNIQUE(origemId,sourceKey));
      CREATE TABLE BpmEventoExternoCorrecao(id TEXT PRIMARY KEY,eventoId TEXT,versao INTEGER,camposAlteradosJson TEXT,projecaoAnteriorJson TEXT,projecaoNovaJson TEXT,autorId INTEGER,createdAt TEXT,UNIQUE(eventoId,versao));
      CREATE TABLE BpmCardHistorico(id TEXT PRIMARY KEY,cardId TEXT,acao TEXT,valorNovoJson TEXT,automacaoOrigem TEXT,createdAt TEXT);
    `);
    const origin = input.alpha.origins[0], event = input.alpha.events[0];
    sqlite.prepare("INSERT INTO BpmCardOrigemExterna VALUES (?,?,?,?)").run(origin.id, origin.cardId, origin.provider, origin.sourceDealId);
    sqlite.prepare("INSERT INTO BpmEventoExternoCard(id,origemId,sourceKey,sourceEventId,eventType,occurredAt,rawJson,projectedJson) VALUES (?,?,?,?,?,?,?,?)").run(...Object.values(event));
    const execute = async (query: { sql: string; args?: unknown[] }) => {
      const stmt = sqlite.prepare(query.sql);
      return { rows: stmt.columns().length ? stmt.all(...(query.args ?? []) as never[]) : (stmt.run(...(query.args ?? []) as never[]), []) };
    };
    const batch = async (queries: { sql: string; args?: unknown[] }[]) => Promise.all(queries.map(execute));
    const db = { execute, batch, transaction: async () => {
      sqlite.exec("BEGIN"); let done = false;
      return { execute, batch, commit: async () => { sqlite.exec("COMMIT"); done = true; }, rollback: async () => { sqlite.exec("ROLLBACK"); done = true; }, close: () => { if (!done) sqlite.exec("ROLLBACK"); } };
    } };
    try {
      expect(await applyRecoveryBatch(db, plan.changes, "synthetic")).toEqual({ applied: 1, skipped: 0 });
      expect(await applyRecoveryBatch(db, plan.changes, "synthetic")).toEqual({ applied: 0, skipped: 1 });
      expect(sqlite.prepare("SELECT rawJson FROM BpmEventoExternoCard").get()?.rawJson).toBe(event.rawJson);
      sqlite.prepare("UPDATE BpmEventoExternoCard SET projectedJson=?").run('{"content":"Edição concorrente"}');
      await expect(applyRecoveryBatch(db, plan.changes, "synthetic", true)).rejects.toThrow("Estado mudou");
      sqlite.prepare("UPDATE BpmEventoExternoCard SET projectedJson=?").run(plan.changes[0].writes[0].args[0]);
      expect(await applyRecoveryBatch(db, plan.changes, "synthetic", true)).toEqual({ applied: 1, skipped: 0 });
      const pendingInput = fixture();
      pendingInput.alpha.events[0].id = "pending";
      pendingInput.alpha.events[0].sourceKey = "activity:pending-note";
      pendingInput.alpha.events[0].sourceEventId = "pending-note";
      pendingInput.source.activities.rows[0].id = "pending-note";
      const pendingEvent = pendingInput.alpha.events[0];
      sqlite.prepare("INSERT INTO BpmEventoExternoCard(id,origemId,sourceKey,sourceEventId,eventType,occurredAt,rawJson,projectedJson) VALUES (?,?,?,?,?,?,?,?)").run(...Object.values(pendingEvent));
      const pendingPlan = buildHistoryPlan(pendingInput);
      sqlite.prepare("UPDATE BpmEventoExternoCard SET projectedJson=? WHERE id='pending'").run('{"content":"Mudança concorrente intocada"}');
      await expect(applyRecoveryBatch(db, pendingPlan.changes, "synthetic")).rejects.toThrow("Estado mudou");
      const mixed = [...plan.changes, ...pendingPlan.changes];
      expect(await applyRecoveryBatch(db, mixed, "synthetic", true)).toEqual({ applied: 0, skipped: 2 });
      expect(await verifyHistoryRollback(db, mixed, "synthetic")).toMatchObject({ reverted: 1, neverApplied: 1, untouchedChanged: 1 });
      expect(await applyRecoveryBatch(db, mixed, "synthetic", true)).toEqual({ applied: 0, skipped: 2 });
      const insertionInput = fixture(); insertionInput.alpha.events = [];
      insertionInput.source.activities.rows[0].id = "new-note";
      const insertionPlan = buildHistoryPlan(insertionInput);
      sqlite.prepare("INSERT INTO BpmEventoExternoCard(id,origemId,sourceKey,sourceEventId,eventType,projectedJson) VALUES ('concurrent','origin','legacy-key','new-note','ACTIVITY_UNKNOWN','{}')").run();
      await expect(applyRecoveryBatch(db, insertionPlan.changes, "alias-race")).rejects.toThrow("Estado mudou");
      for (const check of plan.changes[0].rollbackAfter) expect(stateHash((await execute(check)).rows)).toBe(check.hash);
      expect(sqlite.prepare("SELECT COUNT(*) n FROM BpmEventoExternoCorrecao").get()?.n).toBe(2);
    } finally { sqlite.close(); }
  });
});
