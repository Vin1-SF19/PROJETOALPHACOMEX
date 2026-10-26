import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ endpoint: vi.fn(), compare: vi.fn(), mover: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { bpmWebhookEndpoint: { findUnique: mocks.endpoint } } }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/bpm/mover-card-webhook-server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/bpm/mover-card-webhook-server")>(), moverCardViaWebhook: mocks.mover,
}));

import { POST } from "@/app/api/bpm/webhooks/[slug]/cards/[cardId]/etapa/route";

const body = { etapaDestino: "AGENDAR_REUNIAO", camposValores: { campo: "valor" } };
const headers = { "x-bpm-webhook-secret": "secret", "Idempotency-Key": "etapa-123" };
const context = { params: Promise.resolve({ slug: "endpoint", cardId: "card-1" }) };
const request = (payload: unknown = body, requestHeaders = headers) => new NextRequest("http://localhost/api/bpm/webhooks/endpoint/cards/card-1/etapa", {
  method: "POST", headers: requestHeaders, body: JSON.stringify(payload),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.endpoint.mockResolvedValue({ id: "endpoint", ativo: true, segredoHash: "hash", pipelineId: "radar",
    pipeline: { ativo: true, nome: "Revisão de Radar" } });
  mocks.compare.mockResolvedValue(true);
  mocks.mover.mockResolvedValue({ success: true, data: { cardId: "card-1", etapaDestinoId: "agendar" } });
});

describe("POST webhook de etapa por ID", () => {
  it("autentica o endpoint e retorna o movimento", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { cardId: "card-1" } });
    expect(mocks.mover).toHaveBeenCalledWith(expect.objectContaining({ pipelineId: "radar", cardId: "card-1", dados: body }));
  });
  it("não movimenta com segredo incorreto", async () => {
    mocks.compare.mockResolvedValue(false);
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.mover).not.toHaveBeenCalled();
  });
  it("recusa endpoint inativo", async () => {
    mocks.endpoint.mockResolvedValue({ ativo: false });
    expect((await POST(request(), context)).status).toBe(404);
    expect(mocks.mover).not.toHaveBeenCalled();
  });
  it("exige idempotência", async () => {
    expect((await POST(request(body, { ...headers, "Idempotency-Key": "" }), context)).status).toBe(400);
    expect(mocks.mover).not.toHaveBeenCalled();
  });
  it("exige data/hora ao passar para Reunião Agendada", async () => {
    expect((await POST(request({ etapaDestino: "REUNIAO_AGENDADA", camposValores: {} }), context)).status).toBe(400);
    expect(mocks.mover).not.toHaveBeenCalled();
  });
  it("retorna 422 e a lista de requisitos pendentes", async () => {
    mocks.mover.mockResolvedValue({ success: false, code: "REQUIREMENTS_PENDING", error: "Campos pendentes", pendencias: ["Radar pretendido"] });
    const response = await POST(request(), context);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ pendencias: ["Radar pretendido"] });
  });
  it("retorna 409 se o card mudou de etapa", async () => {
    mocks.mover.mockResolvedValue({ success: false, code: "STALE_STAGE", error: "Card mudou" });
    expect((await POST(request(), context)).status).toBe(409);
  });
});
