import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getToken: vi.fn() }));

vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));

import { middleware } from "../../middleware";

describe("fronteira de autenticação do middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "s".repeat(32));
  });

  it("envia sessão temporária apenas para a troca obrigatória", async () => {
    mocks.getToken.mockResolvedValue({ role: "User", senhaTemporaria: true });

    const response = await middleware(new NextRequest("https://painel.alpha.test/PainelAlpha/Metas"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://painel.alpha.test/PainelAlpha/mudar-senha");
  });

  it("permite que a sessão temporária abra a própria página de troca", async () => {
    mocks.getToken.mockResolvedValue({ role: "User", senhaTemporaria: true });

    const response = await middleware(new NextRequest("https://painel.alpha.test/PainelAlpha/mudar-senha"));

    expect(response.status).toBe(200);
  });

  it("usa o cookie Auth.js com prefixo seguro em produção", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.getToken.mockResolvedValue(null);

    await middleware(new NextRequest("https://painel.alpha.test/"));

    expect(mocks.getToken).toHaveBeenCalledWith(expect.objectContaining({
      cookieName: "__Secure-authjs.session-token",
    }));
  });
});
