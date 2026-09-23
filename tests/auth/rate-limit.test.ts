import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  deleteMany: vi.fn(),
  deleteOne: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: mocks.queryRaw,
    authRateLimit: {
      deleteMany: mocks.deleteMany,
      delete: mocks.deleteOne,
    },
  },
}));

import {
  AUTH_RATE_LIMIT_POLICIES,
  authRateLimitKey,
  consumeAuthRateLimit,
  getAuthRequestAddress,
  normalizeAuthIdentifier,
} from "@/lib/auth/rate-limit";

describe("rate limit compartilhado de autenticação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_RATE_LIMIT_SECRET = "s".repeat(32);
    mocks.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("normaliza identificador e prioriza o endereço fornecido pela borda", () => {
    expect(normalizeAuthIdentifier(" USUARIO@ALPHA.TEST ")).toBe("usuario@alpha.test");
    expect(getAuthRequestAddress(new Headers({
      "x-vercel-forwarded-for": "203.0.113.4, 10.0.0.1",
      "x-forwarded-for": "198.51.100.8",
    }))).toBe("203.0.113.4");
  });

  it("persiste somente HMAC estável, sem identificador em claro", () => {
    const first = authRateLimitKey("login_identifier", "usuario@alpha.test");
    const second = authRateLimitKey("login_identifier", "usuario@alpha.test");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("usuario");
  });

  it("separa as cotas compartilhadas de cadastro, tributo e convite", () => {
    expect(AUTH_RATE_LIMIT_POLICIES.pre_analise_cadastro).toMatchObject({ limit: 30, windowMs: 60_000 });
    expect(AUTH_RATE_LIMIT_POLICIES.pre_analise_tributario).toMatchObject({ limit: 12, windowMs: 60_000 });
    expect(AUTH_RATE_LIMIT_POLICIES.pre_analise_convite).toMatchObject({ limit: 5, windowMs: 60_000 });
    expect(new Set([
      authRateLimitKey("pre_analise_cadastro", "123"),
      authRateLimitKey("pre_analise_tributario", "123"),
      authRateLimitKey("pre_analise_convite", "123"),
    ]).size).toBe(3);
  });

  it("libera uma tentativa sem bloqueio", async () => {
    mocks.queryRaw.mockResolvedValue([{ attempts: 1, blockedUntil: null }]);

    await expect(
      consumeAuthRateLimit("login_identifier", "usuario@alpha.test", new Date("2026-09-19T14:00:00.000Z")),
    ).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("nega enquanto o bloqueio persistente está ativo", async () => {
    mocks.queryRaw.mockResolvedValue([{
      attempts: 6,
      blockedUntil: "2026-09-19T14:15:00.000Z",
    }]);

    await expect(
      consumeAuthRateLimit("login_identifier", "usuario@alpha.test", new Date("2026-09-19T14:00:00.000Z")),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 900 });
  });

  it("falha fechado quando não existe segredo forte", async () => {
    delete process.env.AUTH_RATE_LIMIT_SECRET;
    delete process.env.AUTH_SECRET;

    await expect(consumeAuthRateLimit("login_ip", "203.0.113.4")).rejects.toThrow(
      "AUTH_RATE_LIMIT_SECRET",
    );
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });
});
