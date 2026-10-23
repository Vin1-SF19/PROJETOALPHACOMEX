import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { expect, it, vi } from "vitest";
import { erroEhCnpjDuplicado } from "@/lib/cnpj/erro-unicidade";

type Stmt = { sql?: string; sql_id?: number; args?: Array<{ type: string; value?: string }> };
type HranaRequest = { type: string; stmt?: Stmt; sql_id?: number; sql?: string; batch?: { steps: Array<{ stmt: Stmt }> } };

/** The response below is a Hrana v2 server error, not a thrown Prisma/P2002 stub.
 * No real transport or database is used: the installed HTTP client and adapter
 * must decode it and propagate the same base SQLITE_CONSTRAINT seen in logs. */
it("HTTP adapter decodes base SQLITE_CONSTRAINT without assuming Prisma P2002", async () => {
  const statements: Stmt[] = [];
  const sqlCache = new Map<number, string>();
  let autocommit = true;
  function executar(stmt: Stmt) {
    const resolvida = { ...stmt, sql: stmt.sql ?? sqlCache.get(stmt.sql_id!) };
    statements.push(resolvida);
    if (/^BEGIN\s/i.test(resolvida.sql ?? "")) autocommit = false;
    if (/^(ROLLBACK|COMMIT)\b/i.test(resolvida.sql ?? "")) autocommit = true;
    if (/^UPDATE\s/i.test(resolvida.sql ?? "")) return { error: { code: "SQLITE_CONSTRAINT", message: "UNIQUE constraint failed: Cliente.cnpj" } };
    return { result: { cols: [], rows: [], affected_row_count: 0 } };
  }
  const fetchHrana = vi.fn(async (input: Request) => {
    expect(new URL(input.url).origin).toBe("https://hrana-fixture.invalid");
    if (input.method === "GET") return new Response(null, { status: 404 });
    const body = await input.json() as { requests: HranaRequest[] };
    const results = body.requests.map((request) => {
      if (request.type === "close") return { type: "ok", response: { type: "close" } };
      if (request.type === "store_sql" && request.sql_id !== undefined && request.sql) {
        sqlCache.set(request.sql_id, request.sql); return { type: "ok", response: { type: "store_sql" } };
      }
      if (request.type === "close_sql") return { type: "ok", response: { type: "close_sql" } };
      if (request.type === "get_autocommit") return { type: "ok", response: { type: "get_autocommit", is_autocommit: autocommit } };
      if (request.type === "batch" && request.batch) {
        const steps = request.batch.steps.map((step) => executar(step.stmt));
        return { type: "ok", response: { type: "batch", result: { step_results: steps.map((step) => step.result ?? null), step_errors: steps.map((step) => step.error ?? null) } } };
      }
      if (request.type !== "execute" || !request.stmt) throw new Error("Unexpected fixture protocol request: " + JSON.stringify(request));
      const step = executar(request.stmt);
      return step.error ? { type: "error", error: step.error } : { type: "ok", response: { type: "execute", result: step.result } };
    });
    return new Response(JSON.stringify({ baton: null, base_url: null, results }), { headers: { "Content-Type": "application/json" } });
  });
  const prisma = new PrismaClient({ adapter: new PrismaLibSQL({ url: "https://hrana-fixture.invalid", fetch: fetchHrana }), log: [] });
  let failure: unknown;
  try {
    await prisma.cliente.updateMany({ where: { id: 42, cnpj: null }, data: { cnpj: "11222333000181" } });
  } catch (error) { failure = error; }
  finally { await prisma.$disconnect(); }
  expect(failure).toBeDefined();
  expect(failure).toMatchObject({ name: "DriverAdapterError", message: expect.stringContaining("UNIQUE constraint failed: Cliente.cnpj") });
  expect(failure).toMatchObject({ cause: { kind: "sqlite", originalMessage: expect.stringContaining("UNIQUE constraint failed: Cliente.cnpj") } });
  expect((failure as { cause: { originalCode?: string } }).cause.originalCode).toBeUndefined();
  expect((failure as { code?: string }).code).not.toBe("P2002");
  expect(erroEhCnpjDuplicado(failure)).toBe(true);
  const updates = statements.filter((stmt) => /^UPDATE\s/i.test(stmt.sql ?? ""));
  expect(updates).toHaveLength(1);
  expect(updates[0].args).toContainEqual({ type: "text", value: "11222333000181" });
  expect(fetchHrana).toHaveBeenCalled();
});
