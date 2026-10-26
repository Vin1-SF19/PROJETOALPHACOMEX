import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authComEstadoAcesso: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("../../auth", () => ({
  authComEstadoAcesso: mocks.authComEstadoAcesso,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: {
      updateMany: mocks.updateMany,
    },
  },
}));

import { POST } from "@/app/api/heartbeat/route";

describe("heartbeat da sessão por status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("manda o navegador encerrar uma sessão que foi bloqueada", async () => {
    mocks.authComEstadoAcesso.mockResolvedValue({
      acessoBloqueado: true,
      user: undefined,
    });

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Acesso bloqueado" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("não autentica uma requisição sem sessão", async () => {
    mocks.authComEstadoAcesso.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("mantém o heartbeat somente para usuário ainda ATIVO", async () => {
    mocks.authComEstadoAcesso.mockResolvedValue({
      acessoBloqueado: false,
      user: { email: "ativo@alpha.test" },
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        email: "ativo@alpha.test",
        status: "ATIVO",
      },
      data: { ultimo_aviso: expect.any(String) },
    });
  });

  it("nega se o status mudar entre a revalidação e a atualização", async () => {
    mocks.authComEstadoAcesso.mockResolvedValue({
      acessoBloqueado: false,
      user: { email: "alterado@alpha.test" },
    });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST();

    expect(response.status).toBe(403);
  });

  it("returns a recoverable503 for transport deadline and never repeats a presence write", async () => {
    mocks.authComEstadoAcesso.mockResolvedValue({ user: { email: "active@alpha.test" } });
    mocks.updateMany.mockRejectedValue({ code: 23, cause: new DOMException("Database transport deadline exceeded", "TimeoutError") });
    const response = await POST();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(await response.json()).toMatchObject({ code: "HEARTBEAT_UNAVAILABLE", retryable: true });
    expect(mocks.updateMany).toHaveBeenCalledOnce();
  });
});
