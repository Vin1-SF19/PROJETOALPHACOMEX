import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));
import { conflitoRecursoLease } from "@/lib/bpm/ficha-viabilidade-automatica-server";

type Stmt = { sql?: string; sql_id?: number };
type RequestHrana = { type: string; stmt?: Stmt; sql_id?: number; sql?: string; batch?: { steps: Array<{ stmt: Stmt }> } };

/** Decode the real installed HTTP client/adapter response, not a P2002 stub. */
it("reconhece a UNIQUE do recurso recebida por Hrana sem P2002", async () => {
  const sqlCache = new Map<number, string>();
  let tentouCreate = false;
  function executar(stmt: Stmt) {
    const sql = stmt.sql ?? sqlCache.get(stmt.sql_id ?? -1) ?? "";
    if (/^INSERT\s/i.test(sql)) {
      tentouCreate = true;
      return { error: { code: "SQLITE_CONSTRAINT", message: "UNIQUE constraint failed: BpmAutomacaoLease.recurso" } };
    }
    return { result: { cols: [], rows: [], affected_row_count: 0 } };
  }
  const fetchHrana = vi.fn(async (request: Request) => {
    expect(new URL(request.url).origin).toBe("https://hrana-ficha-fixture.invalid");
    if (request.method === "GET") return new Response(null, { status: 404 });
    const body = await request.json() as { requests: RequestHrana[] };
    const results = body.requests.map(item => {
      if (item.type === "store_sql" && item.sql_id !== undefined && item.sql) {
        sqlCache.set(item.sql_id, item.sql); return { type: "ok", response: { type: "store_sql" } };
      }
      if (["close", "close_sql"].includes(item.type)) return { type: "ok", response: { type: item.type } };
      if (item.type === "get_autocommit") return { type: "ok", response: { type: "get_autocommit", is_autocommit: true } };
      if (item.type === "batch" && item.batch) {
        const steps = item.batch.steps.map(step => executar(step.stmt));
        return { type: "ok", response: { type: "batch", result: { step_results: steps.map(step => step.result ?? null), step_errors: steps.map(step => step.error ?? null) } } };
      }
      if (item.type !== "execute" || !item.stmt) throw new Error("Unexpected Hrana fixture request");
      const step = executar(item.stmt);
      return step.error ? { type: "error", error: step.error } : { type: "ok", response: { type: "execute", result: step.result } };
    });
    return new Response(JSON.stringify({ baton: null, base_url: null, results }), { headers: { "Content-Type": "application/json" } });
  });
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url: "https://hrana-ficha-fixture.invalid", fetch: fetchHrana }), log: [] });
  let failure: unknown;
  try { await prisma.bpmAutomacaoLease.create({ data: { recurso: "ficha-viabilidade:card-ficticio", titular: "concorrente", expiraEm: new Date() } }); }
  catch (error) { failure = error; }
  finally { await prisma.$disconnect(); }
  expect(tentouCreate).toBe(true);
  expect(failure).toMatchObject({ name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 1,
    message: expect.stringContaining("UNIQUE constraint failed: BpmAutomacaoLease.recurso") } });
  expect(failure).not.toHaveProperty("code", "P2002");
  expect(conflitoRecursoLease(failure)).toBe(true);
});

it.each([
  { name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 1, message: "SQLITE_CONSTRAINT: NOT NULL constraint failed: BpmAutomacaoLease.titular" } },
  { name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 1, message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: BpmAutomacaoLease.id" } },
  { name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 1, message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: Cliente.cnpj" } },
  { name: "DriverAdapterError", cause: { kind: "sqlite", extendedCode: 5, message: "SQLITE_BUSY: database is locked" } },
  { code: "P2002", meta: { modelName: "Cliente", target: ["recurso"] } },
  { code: "P2002", meta: { modelName: "BpmAutomacaoLease", target: ["id"] } },
  new Error("Armazenamento indisponível"),
])("não confunde outro erro com a disputa do recurso: %j", error => {
  expect(conflitoRecursoLease(error)).toBe(false);
});
