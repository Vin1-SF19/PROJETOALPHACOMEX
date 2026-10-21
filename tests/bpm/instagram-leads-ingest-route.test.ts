import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INSTAGRAM_COLUNAS as C, INSTAGRAM_SPREADSHEET_ID } from "@/lib/bpm/instagram-leads";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), etapa: vi.fn(), receber: vi.fn(), notificar: vi.fn() }));
vi.mock("@/lib/bpm/instagram-leads-server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/bpm/instagram-leads-server")>(),
  autenticarInstagram: mocks.auth, etapaEntradaInstagram: mocks.etapa, receberInstagramLead: mocks.receber,
}));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: mocks.notificar }));
import { POST } from "@/app/api/integrations/instagram/leads/route";
import { ErroInstagram } from "@/lib/bpm/instagram-leads-server";

const lead = { id: "l:exemplo", full_name: "Contato Exemplo", created_time: "2026-10-21T12:00:00Z", platform: "ig", [C.radar]: "ilimitado" };
const body = { spreadsheetId: INSTAGRAM_SPREADSHEET_ID, sheetId: 0, lead };
const request = (input: unknown, headers = {}) => new NextRequest("https://staging.alpha-comex.com/api/integrations/instagram/leads", {
  method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + "a".repeat(43), ...headers }, body: JSON.stringify(input),
});

beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ id: "endpoint", pipelineId: "pipeline" }); mocks.etapa.mockResolvedValue({ id: "etapa" });
  mocks.receber.mockResolvedValue({ leadId: "cvirtual", duplicate: false, status: "pending", cardId: null });
});

describe("POST Instagram", () => {
  it.each([401, 503])("falha fechada com %s sem persistir", async (status) => {
    mocks.auth.mockRejectedValue(new ErroInstagram(status, "TESTE", "Indisponível"));
    expect((await POST(request(body))).status).toBe(status);
    expect(mocks.receber).not.toHaveBeenCalled();
  });
  it("aceita lead, retorna identificadores e invalida board depois da persistência", async () => {
    const response = await POST(request(body));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, externalId: "l:exemplo", leadId: "cvirtual", status: "pending" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.notificar).toHaveBeenCalledWith({ pipelineId: "pipeline", tipo: "CARD_CRIADO" });
    expect(mocks.receber.mock.invocationCallOrder[0]).toBeLessThan(mocks.notificar.mock.invocationCallOrder[0]);
  });
  it("duplicado não repete invalidação e mantém promovido", async () => {
    mocks.receber.mockResolvedValue({ leadId: "cvirtual", duplicate: true, status: "promoted", cardId: "ccard" });
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true, status: "promoted", cardId: "ccard" });
    expect(mocks.notificar).not.toHaveBeenCalled();
  });
  it("dryRun e teste Meta não criam lead", async () => {
    const preview = await POST(request({ ...body, dryRun: true }));
    expect(await preview.json()).toMatchObject({ dryRun: true, radarPretendido: "Revisão de Radar Ilimitado" });
    const teste = await POST(request({ ...body, lead: { ...lead, full_name: "<test lead: dummy data for full_name>" } }));
    expect(await teste.json()).toMatchObject({ ignored: true, reason: "LEAD_DE_TESTE" });
    expect(mocks.receber).not.toHaveBeenCalled();
  });
  it("rejeita fonte errada, ID numérico e JSON malformado", async () => {
    expect((await POST(request({ ...body, sheetId: 1 }))).status).toBe(422);
    expect((await POST(request({ ...body, lead: { ...lead, id: 123 } }))).status).toBe(422);
    const malformed = new NextRequest("http://localhost/api/integrations/instagram/leads", { method: "POST", body: "{bad" });
    expect((await POST(malformed)).status).toBe(400);
    expect(mocks.receber).not.toHaveBeenCalled();
  });
  it("limita bytes mesmo sem content-length", async () => {
    expect((await POST(request({ ...body, extra: "x".repeat(33000) }))).status).toBe(413);
    expect((await POST(request(body, { "content-length": "33000" }))).status).toBe(413);
    expect(mocks.receber).not.toHaveBeenCalled();
  });
});
