import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findGoogleNonces,
  findAuthorizationCodes,
  findAccessTokens,
  findRefreshTokens,
  findGrants,
  deleteGoogleNonces,
  deleteAuthorizationCodes,
  deleteAccessTokens,
  deleteRefreshTokens,
  expireGrants,
} = vi.hoisted(() => ({
  findGoogleNonces: vi.fn(),
  findAuthorizationCodes: vi.fn(),
  findAccessTokens: vi.fn(),
  findRefreshTokens: vi.fn(),
  findGrants: vi.fn(),
  deleteGoogleNonces: vi.fn(),
  deleteAuthorizationCodes: vi.fn(),
  deleteAccessTokens: vi.fn(),
  deleteRefreshTokens: vi.fn(),
  expireGrants: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    alphaSeoGoogleOAuthNonce: {
      findMany: findGoogleNonces,
      deleteMany: deleteGoogleNonces,
    },
    alphaSeoMcpAuthorizationCode: {
      findMany: findAuthorizationCodes,
      deleteMany: deleteAuthorizationCodes,
    },
    alphaSeoMcpAccessToken: {
      findMany: findAccessTokens,
      deleteMany: deleteAccessTokens,
    },
    alphaSeoMcpRefreshToken: {
      findMany: findRefreshTokens,
      deleteMany: deleteRefreshTokens,
    },
    alphaSeoMcpOAuthGrant: {
      findMany: findGrants,
      updateMany: expireGrants,
    },
    $transaction: (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
  },
}));

describe("Alpha SEO OAuth cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const finder of [
      findGoogleNonces,
      findAuthorizationCodes,
      findAccessTokens,
      findRefreshTokens,
      findGrants,
    ]) finder.mockResolvedValue([]);
    deleteGoogleNonces.mockResolvedValue({ count: 0 });
    deleteAuthorizationCodes.mockResolvedValue({ count: 0 });
    deleteAccessTokens.mockResolvedValue({ count: 0 });
    deleteRefreshTokens.mockResolvedValue({ count: 0 });
    expireGrants.mockResolvedValue({ count: 0 });
  });

  it("bounds every destructive query and reports a completed sweep", async () => {
    const { purgeExpiredAlphaSeoOAuthData } = await import(
      "@/lib/alpha-seo/jobs/oauth-cleanup"
    );
    const result = await purgeExpiredAlphaSeoOAuthData({
      now: new Date("2026-08-20T03:17:00.000Z"),
      batchSize: 9_999,
    });

    for (const finder of [
      findGoogleNonces,
      findAuthorizationCodes,
      findAccessTokens,
      findRefreshTokens,
      findGrants,
    ]) expect(finder).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
    expect(result).toEqual({
      counts: {
        googleNonces: 0,
        authorizationCodes: 0,
        accessTokens: 0,
        refreshTokens: 0,
        grantsExpired: 0,
      },
      processed: 0,
      done: true,
    });
  });

  it("uses only preselected ids and exposes when another sweep is needed", async () => {
    const fullBatch = Array.from({ length: 2 }, (_, index) => ({
      id: `nonce-${index}`,
    }));
    findGoogleNonces.mockResolvedValue(fullBatch);
    deleteGoogleNonces.mockResolvedValue({ count: 2 });
    const { purgeExpiredAlphaSeoOAuthData } = await import(
      "@/lib/alpha-seo/jobs/oauth-cleanup"
    );

    const result = await purgeExpiredAlphaSeoOAuthData({ batchSize: 2 });

    expect(deleteGoogleNonces).toHaveBeenCalledWith({
      where: { id: { in: ["nonce-0", "nonce-1"] } },
    });
    expect(result.processed).toBe(2);
    expect(result.done).toBe(false);
  });
});
