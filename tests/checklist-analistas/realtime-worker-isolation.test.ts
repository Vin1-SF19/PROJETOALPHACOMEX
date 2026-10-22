import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { criarFixtureChecklist } from "./sqlite-fixture";

// Importing either production dependency is forbidden, not just calling trigger.
const forbidden = vi.hoisted(() => ({ database: vi.fn(), publisher: vi.fn(), pusher: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  forbidden.database();
  throw new Error("Worker polling must not import the application database");
});
vi.mock("@/lib/checklist/eventos", () => {
  forbidden.publisher();
  throw new Error("Worker polling must not import the publisher");
});
vi.mock("@/lib/pusher-server.ts", () => {
  forbidden.pusher();
  throw new Error("Worker polling must not import Pusher");
});

import { POST } from "@/app/api/checklist/jobs/eventos/route";

const secret = "synthetic-worker-secret-1234567890";
let fixture: Awaited<ReturnType<typeof criarFixtureChecklist>>;
let confirmed: string;

async function snapshot() {
  return JSON.stringify({
    events: await fixture.db.checklistEvento.findMany({ orderBy: { id: "asc" } }),
    readstate: await fixture.db.checklistEventoLeitura.findMany({ orderBy: { id: "asc" } }),
  });
}

function request(authorization: string | undefined = `Bearer ${secret}`) {
  return new Request("https://example.invalid/api/checklist/jobs/eventos", {
    method: "POST", headers: authorization === undefined ? undefined : { authorization },
  });
}

beforeAll(async () => {
  fixture = await criarFixtureChecklist();
  const f = await fixture.atendimento();
  await fixture.db.checklistEvento.createMany({ data: [
    { id: "event-pending", mutationId: "mutation-pending", payloadHash: "synthetic", agregadoTipo: "ATENDIMENTO", agregadoId: f.empresa.id, revision: 1, tipo: "CHECKLIST_ITEM_ATUALIZADO", empresaId: f.empresa.id, atorTipo: "INTERNO", atorUsuarioId: 1, dados: { itemId: f.item.id } },
    { id: "event-retrying", mutationId: "mutation-retrying", payloadHash: "synthetic", agregadoTipo: "ATENDIMENTO", agregadoId: f.empresa.id, revision: 2, tipo: "CHECKLIST_ITEM_ATUALIZADO", empresaId: f.empresa.id, atorTipo: "INTERNO", atorUsuarioId: 1, tentativas: 3, claimToken: "existing-claim", claimAte: new Date("2026-10-21T00:00:00Z"), proximaTentativaEm: new Date("2026-10-21T00:00:00Z"), ultimoErro: "synthetic-retry" },
  ] });
  await fixture.db.checklistEventoLeitura.create({ data: { eventoId: "event-pending", usuarioId: 1 } });
  confirmed = await snapshot();
}, 30000);

afterAll(async () => { await fixture?.close(); });

describe("worker CheckList — polling não é publicação externa", () => {
  beforeEach(() => {
    vi.stubEnv("CHECKLIST_WORKER_SECRET", secret);
    vi.stubEnv("NEXT_PUBLIC_CHECKLIST_REALTIME_MODE", undefined);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No external network permitted"); }));
  });

  afterEach(async () => {
    expect(forbidden.database).not.toHaveBeenCalled();
    expect(forbidden.publisher).not.toHaveBeenCalled();
    expect(forbidden.pusher).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(await snapshot()).toBe(confirmed);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([undefined, "polling"])("token correto, modo %s: retorna zero sem claim/retry/publicadoEm/leitura", async (mode) => {
    vi.stubEnv("NEXT_PUBLIC_CHECKLIST_REALTIME_MODE", mode);
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ processed: 0, transport: "polling" });
  });

  it.each(["pusher", "", " polling", "Polling", "sensitive-config-never-echo"])("configuração inválida %j: 503 seguro sem efeitos", async (mode) => {
    vi.stubEnv("NEXT_PUBLIC_CHECKLIST_REALTIME_MODE", mode);
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Transporte CheckList indisponível." });
  });

  it.each(["", "Bearer wrong", `Bearer ${"x".repeat(secret.length)}`, `bearer ${secret}`])("nega autorização incorreta %j antes de resolver configuração", async (authorization) => {
    vi.stubEnv("NEXT_PUBLIC_CHECKLIST_REALTIME_MODE", "invalid");
    const response = await POST(request(authorization));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Não autorizado" });
  });

  it("segredo ausente nega inclusive o literal Bearer undefined", async () => {
    vi.stubEnv("CHECKLIST_WORKER_SECRET", undefined);
    expect((await POST(request("Bearer undefined"))).status).toBe(401);
  });

  it("sem header continua 401 em polling", async () => {
    const response = await POST(new Request("https://example.invalid/api/checklist/jobs/eventos", { method: "POST" }));
    expect(response.status).toBe(401);
  });
});
