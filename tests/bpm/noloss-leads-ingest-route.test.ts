import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  nolossLead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { POST } from "@/app/api/bpm/noloss-leads/ingest/route";

const ORIGINAL_SECRET = process.env.NOLOSS_WEBHOOK_SECRET;

function criarRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/bpm/noloss-leads/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bpm/noloss-leads/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOLOSS_WEBHOOK_SECRET = "segredo-correto";
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.NOLOSS_WEBHOOK_SECRET;
    else process.env.NOLOSS_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it("bloqueia sem header de secret", async () => {
    const response = await POST(criarRequest({ id: "contato-1" }));

    expect(response.status).toBe(401);
    expect(prismaMock.nolossLead.create).not.toHaveBeenCalled();
  });

  it("bloqueia com header de secret errado", async () => {
    const response = await POST(criarRequest({ id: "contato-1" }, { "x-noloss-webhook-secret": "errado" }));

    expect(response.status).toBe(401);
    expect(prismaMock.nolossLead.create).not.toHaveBeenCalled();
  });

  it("bloqueia mesmo com header certo quando NOLOSS_WEBHOOK_SECRET não está configurado", async () => {
    delete process.env.NOLOSS_WEBHOOK_SECRET;
    const response = await POST(criarRequest({ id: "contato-1" }, { "x-noloss-webhook-secret": "qualquer-coisa" }));

    expect(response.status).toBe(401);
  });

  it("aceita com header de secret correto e cria o lead", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue(null);
    prismaMock.nolossLead.create.mockResolvedValue({ id: "novo-lead" });

    const response = await POST(criarRequest(
      { id: "contato-1", email: "a@a.com", firstName: "Ana", lastName: "Silva", phone: "11999990000" },
      { "x-noloss-webhook-secret": "segredo-correto" },
    ));

    expect(response.status).toBe(200);
    expect(prismaMock.nolossLead.create).toHaveBeenCalledWith({
      data: {
        nolossContactId: "contato-1",
        nome: "Ana Silva",
        email: "a@a.com",
        telefone: "11999990000",
        status: "pending",
      },
    });
  });

  it("rejeita payload sem id (400)", async () => {
    const response = await POST(criarRequest({ email: "a@a.com" }, { "x-noloss-webhook-secret": "segredo-correto" }));

    expect(response.status).toBe(400);
    expect(prismaMock.nolossLead.create).not.toHaveBeenCalled();
  });

  it("rejeita JSON inválido (400)", async () => {
    const request = new NextRequest("http://localhost/api/bpm/noloss-leads/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-noloss-webhook-secret": "segredo-correto" },
      body: "{ isto não é json",
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("monta o nome só com firstName quando lastName não vem", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue(null);
    prismaMock.nolossLead.create.mockResolvedValue({ id: "novo-lead-2" });

    await POST(criarRequest(
      { id: "contato-2", firstName: "Ana" },
      { "x-noloss-webhook-secret": "segredo-correto" },
    ));

    expect(prismaMock.nolossLead.create).toHaveBeenCalledWith({
      data: {
        nolossContactId: "contato-2",
        nome: "Ana",
        email: null,
        telefone: null,
        status: "pending",
      },
    });
  });

  it("monta o nome só com lastName quando firstName não vem", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue(null);
    prismaMock.nolossLead.create.mockResolvedValue({ id: "novo-lead-4" });

    await POST(criarRequest(
      { id: "contato-4", lastName: "Silva" },
      { "x-noloss-webhook-secret": "segredo-correto" },
    ));

    expect(prismaMock.nolossLead.create).toHaveBeenCalledWith({
      data: {
        nolossContactId: "contato-4",
        nome: "Silva",
        email: null,
        telefone: null,
        status: "pending",
      },
    });
  });

  it("nome fica null quando nem firstName nem lastName vêm preenchidos", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue(null);
    prismaMock.nolossLead.create.mockResolvedValue({ id: "novo-lead-3" });

    await POST(criarRequest(
      { id: "contato-3", email: "so-email@teste.com" },
      { "x-noloss-webhook-secret": "segredo-correto" },
    ));

    expect(prismaMock.nolossLead.create).toHaveBeenCalledWith({
      data: {
        nolossContactId: "contato-3",
        nome: null,
        email: "so-email@teste.com",
        telefone: null,
        status: "pending",
      },
    });
  });

  it("idempotência: reenvio do mesmo nolossContactId atualiza dados mas nunca reverte status já promovido", async () => {
    prismaMock.nolossLead.findUnique.mockResolvedValue({ id: "lead-existente" });
    prismaMock.nolossLead.update.mockResolvedValue({ id: "lead-existente" });

    const response = await POST(criarRequest(
      { id: "contato-ja-promovido", firstName: "Novo", lastName: "Nome", email: "novo@email.com" },
      { "x-noloss-webhook-secret": "segredo-correto" },
    ));

    expect(response.status).toBe(200);
    // Atualiza dados de contato via update — nunca via create (que fixaria
    // status:"pending" de novo) nem passando "status" no payload de update.
    expect(prismaMock.nolossLead.create).not.toHaveBeenCalled();
    expect(prismaMock.nolossLead.update).toHaveBeenCalledWith({
      where: { id: "lead-existente" },
      data: { nome: "Novo Nome", email: "novo@email.com", telefone: null },
    });
    const dadosAtualizados = prismaMock.nolossLead.update.mock.calls[0][0].data;
    expect(dadosAtualizados).not.toHaveProperty("status");
  });
});
