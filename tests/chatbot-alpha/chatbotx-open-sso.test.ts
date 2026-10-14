import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  permissions: vi.fn(),
}));

vi.mock("@/../auth", () => ({ auth: mocks.auth }));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: mocks.permissions }));

import { GET } from "@/app/api/chatbotx/open/route";

describe("SSO do ChatbotX", () => {
  beforeEach(() => {
    vi.stubEnv("ALPHA_SSO_SECRET", "a-secure-test-secret-with-32-or-more-characters");
    vi.stubEnv("CHATBOTX_URL", "https://chatbotx.example.test");
    mocks.auth.mockResolvedValue({
      user: { id: "42", email: " Comercial@alpha.test ", role: "COMERCIAL" },
    });
    mocks.permissions.mockResolvedValue(["builder"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ loginUrl: "https://chatbotx.example.test/login/sso" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("envia a claim role do Painel Alpha sem confundi-la com cargo", async () => {
    const response = await GET();
    expect(response.status).toBe(303);

    const [, request] = vi.mocked(fetch).mock.calls[0];
    const { assertion } = JSON.parse(String(request?.body)) as { assertion: string };
    const claims = decodeJwt(assertion);
    expect(claims.email).toBe("comercial@alpha.test");
    expect(claims.role).toBe("COMERCIAL");
    expect(claims.sub).toBe("42");
    expect(claims.cargo).toBeUndefined();
  });
});
