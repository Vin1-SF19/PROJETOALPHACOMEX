import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  nonceFind: vi.fn(),
  nonceUpdateMany: vi.fn(),
  grantUpsert: vi.fn(),
  grantFind: vi.fn(),
  grantUpdateMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    alphaSeoGoogleOAuthNonce: {
      findFirst: mocks.nonceFind,
      updateMany: mocks.nonceUpdateMany,
      create: vi.fn(),
    },
    alphaSeoGoogleOAuthGrant: {
      upsert: mocks.grantUpsert,
      findFirst: mocks.grantFind,
      updateMany: mocks.grantUpdateMany,
    },
  },
}));
import {
  decryptSecret,
  encryptSecret,
  generatePkce,
  redactGoogleError,
  sha256,
} from "@/lib/alpha-seo/google/crypto";
import {
  consumeGoogleOAuth,
  revokeGoogleGrantIfUnused,
} from "@/lib/alpha-seo/google/oauth";

describe("Google OAuth Alpha SEO", () => {
  beforeEach(() => {
    process.env.ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(
      32,
      7,
    ).toString("base64");
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    vi.restoreAllMocks();
    mocks.nonceFind.mockReset();
    mocks.nonceUpdateMany.mockReset();
    mocks.grantUpsert.mockReset();
    mocks.grantFind.mockReset();
    mocks.grantUpdateMany.mockReset();
  });
  it("usa PKCE S256 e AES-256-GCM autenticado por propósito", () => {
    const pkce = generatePkce();
    expect(pkce.verifier.length).toBeGreaterThan(40);
    expect(pkce.challenge).not.toBe(pkce.verifier);
    const value = encryptSecret("refresh-sensitive", "purpose-a");
    expect(decryptSecret(value.ciphertext, "purpose-a")).toBe(
      "refresh-sensitive",
    );
    expect(() => decryptSecret(value.ciphertext, "purpose-b")).toThrow();
  });
  it("rejeita state/usuário/projeto divergente antes da troca", async () => {
    mocks.nonceFind.mockResolvedValue(null);
    await expect(
      consumeGoogleOAuth({
        userId: 2,
        projectId: "p-other",
        product: "GSC",
        redirectUri: "https://alpha.test/cb",
        state: "state",
        code: "code",
      }),
    ).rejects.toThrow("GOOGLE_OAUTH_STATE_INVALID");
    expect(mocks.nonceFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          stateHash: sha256("state"),
          userId: 2,
          projectId: "p-other",
        }),
      }),
    );
  });
  it("bloqueia replay por claim atômico", async () => {
    const encrypted = encryptSecret("verifier", "google-pkce:1:p1:GSC");
    mocks.nonceFind.mockResolvedValue({
      id: "n",
      redirectUriHash: sha256("https://alpha.test/cb"),
      codeVerifierCiphertext: encrypted.ciphertext,
    });
    mocks.nonceUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      consumeGoogleOAuth({
        userId: 1,
        projectId: "p1",
        product: "GSC",
        redirectUri: "https://alpha.test/cb",
        state: "s",
        code: "c",
      }),
    ).rejects.toThrow("GOOGLE_OAUTH_STATE_REPLAYED");
  });
  it("remove tokens de erros", () =>
    expect(
      redactGoogleError("Bearer abc.def access_token=secret&code=abc"),
    ).not.toMatch(/abc\.def|secret/));

  it("não revoga grant GSC enquanto existe outro consumer", async () => {
    const access = encryptSecret("access", "google-access:1:GSC:account");
    mocks.grantFind.mockResolvedValue({
      id: "grant",
      product: "GSC",
      accountId: "account",
      accessTokenCiphertext: access.ciphertext,
      refreshTokenCiphertext: null,
    });
    mocks.grantUpdateMany.mockResolvedValue({ count: 0 });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      revokeGoogleGrantIfUnused("grant", 1, "GSC"),
    ).resolves.toBe(false);
    expect(mocks.grantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "grant",
          product: "GSC",
          gscConnections: { none: {} },
        }),
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revoga grant GA4 somente após claim sem consumers", async () => {
    const refresh = encryptSecret(
      "refresh",
      "google-refresh:1:GA4:account",
    );
    mocks.grantFind.mockResolvedValue({
      id: "grant",
      product: "GA4",
      accountId: "account",
      accessTokenCiphertext: "unused",
      refreshTokenCiphertext: refresh.ciphertext,
    });
    mocks.grantUpdateMany.mockResolvedValue({ count: 1 });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      revokeGoogleGrantIfUnused("grant", 1, "GA4"),
    ).resolves.toBe(true);
    expect(mocks.grantUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: "GA4",
          ga4Connections: { none: {} },
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
