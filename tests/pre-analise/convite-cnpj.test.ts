import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ pin: vi.fn(), receita: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/convite-pin", () => ({ validarPinComRateLimit: mocks.pin }));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: mocks.receita }));
vi.mock("@/lib/auth/rate-limit", () => ({ consumeAuthRateLimit: mocks.limit }));

import { POST } from "@/app/api/convite/consulta-cnpj/route";

const CNPJ = "33000167000101";
let sequence = 0;
function request(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return new NextRequest("http://localhost/api/convite/consulta-cnpj", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: `convite-valido-${sequence}`, pin: "1234", cnpj: CNPJ, ...overrides }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pin.mockResolvedValue({ ok: true });
  mocks.receita.mockResolvedValue({ cnpj: CNPJ, razaoSocial: "EMPRESA TESTE", optante_simples: null });
  mocks.limit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
});

describe("consulta cadastral pública por convite", () => {
  it("bloqueia token/PIN recusado antes de chamar a fonte", async () => {
    mocks.pin.mockResolvedValueOnce({ ok: false, error: "PIN inválido", status: 403 });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.receita).not.toHaveBeenCalled();
    expect(mocks.pin).toHaveBeenCalledWith(expect.stringMatching(/^convite-valido-/), "1234", false);
  });

  it("rejeita payload inválido antes de validar o convite", async () => {
    const response = await POST(request({ pin: "12" }));
    expect(response.status).toBe(400);
    expect(mocks.pin).not.toHaveBeenCalled();
    expect(mocks.receita).not.toHaveBeenCalled();
  });

  it("rejeita CNPJ curto antes de consultar a fonte", async () => {
    const response = await POST(request({ cnpj: "1234567890123." }));
    expect(response.status).toBe(400);
    expect(mocks.receita).not.toHaveBeenCalled();
  });

  it("limita a cinco consultas por convite validado", async () => {
    const token = `convite-rate-${Date.now()}`;
    for (let index = 0; index < 5; index++) {
      expect((await POST(request({ token }))).status).toBe(200);
    }
    mocks.limit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });
    const denied = await POST(request({ token }));
    expect(denied.status).toBe(429);
    expect(denied.headers.get("Retry-After")).toBe("30");
    expect(mocks.limit).toHaveBeenCalledWith("pre_analise_convite", token);
    expect(mocks.receita).toHaveBeenCalledTimes(5);
  });

  it("retorna cadastro válido sem cache", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ cnpj: CNPJ, razaoSocial: "EMPRESA TESTE", optante_simples: null });
  });

  it("não chama a fonte quando o contador compartilhado está indisponível", async () => {
    mocks.limit.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.receita).not.toHaveBeenCalled();
  });

  it("devolve erro controlado após falha do fornecedor", async () => {
    mocks.receita.mockRejectedValueOnce(new Error("segredo-do-fornecedor"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("segredo-do-fornecedor");
  });
});
