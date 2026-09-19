import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authConfig: undefined as undefined | {
    providers: Array<{
      authorize: (credentials: Record<string, unknown>, request: Request) => Promise<unknown>;
    }>;
  },
  findUserByCredentials: vi.fn(),
  consumeAuthRateLimit: vi.fn(),
  clearAuthRateLimit: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn((config) => {
    mocks.authConfig = config;
    return {
      handlers: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
      auth: vi.fn(),
    };
  }),
}));
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn((config) => config) }));
vi.mock("@/lib/user", () => ({ findUserByCredentials: mocks.findUserByCredentials }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeAuthRateLimit: mocks.consumeAuthRateLimit,
  clearAuthRateLimit: mocks.clearAuthRateLimit,
  getAuthRequestAddress: vi.fn(() => "203.0.113.10"),
  normalizeAuthIdentifier: vi.fn((value: string) => value.trim().toLowerCase()),
}));
vi.mock("@/lib/auth/acesso-painel", () => ({
  bloquearTokenAcesso: vi.fn((token) => token),
  revalidarTokenAcesso: vi.fn((token) => token),
  STATUS_USUARIO_ATIVO: "ATIVO",
}));

await import("../../auth");

describe("wiring do rate limit no provedor Credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeAuthRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.clearAuthRateLimit.mockResolvedValue(undefined);
  });

  function authorize() {
    const provider = mocks.authConfig?.providers[0];
    if (!provider) throw new Error("Credentials provider não capturado");
    return provider.authorize;
  }

  it("bloqueia antes do bcrypt quando IP ou identificador excede o limite", async () => {
    mocks.consumeAuthRateLimit
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 900 });

    await expect(authorize()(
      { email: " USER@ALPHA.TEST ", senha: "senha" },
      new Request("https://painel.alpha.test", { headers: { "x-forwarded-for": "203.0.113.10" } }),
    )).resolves.toBeNull();

    expect(mocks.findUserByCredentials).not.toHaveBeenCalled();
    expect(mocks.consumeAuthRateLimit).toHaveBeenCalledTimes(2);
  });

  it("mantém o login legítimo e limpa somente o contador do identificador", async () => {
    mocks.findUserByCredentials.mockResolvedValue({
      id: "7",
      email: "user@alpha.test",
      nome: "User",
      usuario: "user",
      role: "User",
      permissoes: [],
      authSessionVersion: 3,
    });

    await expect(authorize()(
      { email: " USER@ALPHA.TEST ", senha: "senha correta" },
      new Request("https://painel.alpha.test"),
    )).resolves.toMatchObject({
      id: "7",
      email: "user@alpha.test",
      authSessionVersion: 3,
    });

    expect(mocks.findUserByCredentials).toHaveBeenCalledWith("user@alpha.test", "senha correta");
    expect(mocks.clearAuthRateLimit).toHaveBeenCalledWith("login_identifier", "user@alpha.test");
    expect(mocks.clearAuthRateLimit).toHaveBeenCalledTimes(1);
  });
});
