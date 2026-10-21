import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ bpmWebhookEndpoint: { findUnique: vi.fn() }, bpmWebhookEntrada: { upsert: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ default: db }));
import { POST } from "@/app/api/bpm/webhooks/[slug]/route";
import { INSTAGRAM_ENDPOINT_SLUG } from "@/lib/bpm/instagram-leads";

it("rota genérica nunca cria rejeição/evento na inbox Instagram mesmo com chave conhecida", async () => {
  const request = new NextRequest(`http://localhost/api/bpm/webhooks/${INSTAGRAM_ENDPOINT_SLUG}`, { method: "POST", headers: {
    "idempotency-key": "instagram:origem:0:l:example", "x-bpm-webhook-secret": "incorreto",
  }, body: JSON.stringify({ cardId: "c000000000000000000000000" }) });
  const response = await POST(request, { params: Promise.resolve({ slug: INSTAGRAM_ENDPOINT_SLUG }) });
  expect(response.status).toBe(404);
  expect(db.bpmWebhookEndpoint.findUnique).not.toHaveBeenCalled();
  expect(db.bpmWebhookEntrada.upsert).not.toHaveBeenCalled();
});
