import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  endpoint: vi.fn(),
  compare: vi.fn(),
  criarCard: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: { bpmWebhookEndpoint: { findUnique: mocks.endpoint } } }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/bpm/criar-card-webhook-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/bpm/criar-card-webhook-server")>();
  return { ...original, criarCardNovoLeadViaWebhook: mocks.criarCard };
});

import { POST } from "@/app/api/bpm/webhooks/[slug]/cards/route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/bpm/webhooks/lead-api/cards", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const body = {
  empresa: { cnpj: "11.222.333/0001-81", razaoSocial: "Empresa API" },
};
const headers = {
  "x-bpm-webhook-secret": "segredo",
  "idempotency-key": "crm-lead-123",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.endpoint.mockResolvedValue({
    id: "endpoint-1",
    ativo: true,
    segredoHash: "hash-segredo",
    pipelineId: "pipeline-radar",
    pipeline: { nome: "Revisão de Radar", ativo: true },
  });
  mocks.compare.mockResolvedValue(true);
  mocks.criarCard.mockResolvedValue({
    cardId: "card-1", closerEmail: "closer@example.com", empresaId: 11, pipelineId: "pipeline-radar", etapaId: "novos-leads",
    responsavelId: 17, duplicate: false,
  });
});

describe("POST /api/bpm/webhooks/:slug/cards", () => {
  it("autentica com segredo do endpoint e cria o card real", async () => {
    const response = await POST(request(body, headers), { params: Promise.resolve({ slug: "lead-api" }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { cardId: "card-1", closerEmail: "closer@example.com", responsavelId: 17 },
    });
    expect(mocks.criarCard).toHaveBeenCalledWith(expect.objectContaining({
      endpointId: "endpoint-1",
      pipelineId: "pipeline-radar",
      idempotencyKey: "crm-lead-123",
      dados: body,
    }));
  });

  it("rejeita credencial incorreta sem chamar a criação", async () => {
    mocks.compare.mockResolvedValue(false);
    const response = await POST(request(body, headers), { params: Promise.resolve({ slug: "lead-api" }) });

    expect(response.status).toBe(401);
    expect(mocks.criarCard).not.toHaveBeenCalled();
  });

  it("rejeita endpoint fora de Revisão de Radar", async () => {
    mocks.endpoint.mockResolvedValueOnce({
      id: "endpoint-1", ativo: true, segredoHash: "hash-segredo", pipelineId: "pipeline-radar",
      pipeline: { nome: "Financeiro", ativo: true },
    });
    const response = await POST(request(body, headers), { params: Promise.resolve({ slug: "lead-api" }) });

    expect(response.status).toBe(404);
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.criarCard).not.toHaveBeenCalled();
  });

  it("exige chave de idempotência e valida o corpo", async () => {
    const semChave = await POST(request(body, { "x-bpm-webhook-secret": "segredo" }), { params: Promise.resolve({ slug: "lead-api" }) });
    expect(semChave.status).toBe(400);
    const invalido = await POST(request({ ...body, responsavelId: 999 }, headers), { params: Promise.resolve({ slug: "lead-api" }) });
    expect(invalido.status).toBe(400);
    expect(mocks.criarCard).not.toHaveBeenCalled();
  });
});
