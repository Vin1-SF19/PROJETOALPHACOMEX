import { randomBytes } from "node:crypto";
import db from "@/lib/prisma";
import { decryptSecret, encryptSecret, generatePkce, sha256 } from "./crypto";

export type GoogleProduct = "GSC" | "GA4";

const SCOPES: Record<GoogleProduct, string[]> = {
  GSC: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
  GA4: [
    "openid",
    "email",
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
};

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("ALPHA_SEO_GOOGLE_OAUTH_NOT_CONFIGURED");
  return { clientId, clientSecret };
}

export async function beginGoogleOAuth(input: {
  userId: number;
  projectId: string;
  product: GoogleProduct;
  redirectUri: string;
}) {
  const { clientId } = config();
  const state = randomBytes(32).toString("base64url");
  const pkce = generatePkce();
  const encrypted = encryptSecret(
    pkce.verifier,
    `google-pkce:${input.userId}:${input.projectId}:${input.product}`,
  );
  await db.alphaSeoGoogleOAuthNonce.create({
    data: {
      userId: input.userId,
      projectId: input.projectId,
      product: input.product,
      stateHash: sha256(state),
      codeVerifierCiphertext: encrypted.ciphertext,
      tokenKeyVersion: encrypted.keyVersion,
      redirectUriHash: sha256(input.redirectUri),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES[input.product].join(" "),
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

export async function resolveGoogleOAuthState(
  state: string,
  product: GoogleProduct,
) {
  const nonce = await db.alphaSeoGoogleOAuthNonce.findFirst({
    where: {
      stateHash: sha256(state),
      product,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { userId: true, projectId: true },
  });
  if (!nonce) throw new Error("GOOGLE_OAUTH_STATE_INVALID");
  return nonce;
}

type TokenPayload = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenPayload> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GOOGLE_TOKEN_EXCHANGE_${response.status}`);
  return TokenPayloadSchema.parse(await response.json());
}

import { z } from "zod";
const TokenPayloadSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1).optional(),
    id_token: z.string().min(1).optional(),
    expires_in: z.number().positive().optional(),
    refresh_token_expires_in: z.number().positive().optional(),
    scope: z.string().optional(),
  })
  .strict();

async function fetchGoogleIdentity(
  accessToken: string,
): Promise<{ id: string; email?: string }> {
  const response = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`GOOGLE_USERINFO_${response.status}`);
  const identity = z
    .object({ sub: z.string().min(1), email: z.string().email().optional() })
    .passthrough()
    .parse(await response.json());
  return { id: identity.sub, email: identity.email };
}

export async function consumeGoogleOAuth(input: {
  userId: number;
  projectId: string;
  product: GoogleProduct;
  redirectUri: string;
  state: string;
  code: string;
}) {
  const nonce = await db.alphaSeoGoogleOAuthNonce.findFirst({
    where: {
      stateHash: sha256(input.state),
      userId: input.userId,
      projectId: input.projectId,
      product: input.product,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!nonce || nonce.redirectUriHash !== sha256(input.redirectUri))
    throw new Error("GOOGLE_OAUTH_STATE_INVALID");
  const claimed = await db.alphaSeoGoogleOAuthNonce.updateMany({
    where: { id: nonce.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (claimed.count !== 1) throw new Error("GOOGLE_OAUTH_STATE_REPLAYED");
  const verifier = decryptSecret(
    nonce.codeVerifierCiphertext,
    `google-pkce:${input.userId}:${input.projectId}:${input.product}`,
  );
  const cfg = config();
  const tokens = await tokenRequest(
    new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code: input.code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    }),
  );
  const account = await fetchGoogleIdentity(tokens.access_token);
  const access = encryptSecret(
    tokens.access_token,
    `google-access:${input.userId}:${input.product}:${account.id}`,
  );
  const refresh = tokens.refresh_token
    ? encryptSecret(
        tokens.refresh_token,
        `google-refresh:${input.userId}:${input.product}:${account.id}`,
      )
    : undefined;
  const identity = tokens.id_token
    ? encryptSecret(
        tokens.id_token,
        `google-id:${input.userId}:${input.product}:${account.id}`,
      )
    : undefined;
  return db.alphaSeoGoogleOAuthGrant.upsert({
    where: {
      userId_product_accountId: {
        userId: input.userId,
        product: input.product,
        accountId: account.id,
      },
    },
    create: {
      userId: input.userId,
      product: input.product,
      accountId: account.id,
      accountEmail: account.email,
      accessTokenCiphertext: access.ciphertext,
      refreshTokenCiphertext: refresh?.ciphertext,
      idTokenCiphertext: identity?.ciphertext,
      scopes: (tokens.scope ?? SCOPES[input.product].join(" ")).split(" "),
      tokenKeyVersion: access.keyVersion,
      accessTokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      refreshTokenExpiresAt: tokens.refresh_token_expires_in
        ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000)
        : null,
      revokedAt: null,
    },
    update: {
      accountEmail: account.email,
      accessTokenCiphertext: access.ciphertext,
      ...(refresh ? { refreshTokenCiphertext: refresh.ciphertext } : {}),
      ...(identity ? { idTokenCiphertext: identity.ciphertext } : {}),
      scopes: (tokens.scope ?? SCOPES[input.product].join(" ")).split(" "),
      tokenKeyVersion: access.keyVersion,
      accessTokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      revokedAt: null,
    },
  });
}

export async function getGoogleAccessToken(
  grantId: string,
  userId: number,
): Promise<string> {
  const grant = await db.alphaSeoGoogleOAuthGrant.findFirst({
    where: { id: grantId, userId, revokedAt: null },
  });
  if (!grant) throw new Error("GOOGLE_GRANT_NOT_FOUND");
  if (
    !grant.accessTokenExpiresAt ||
    grant.accessTokenExpiresAt.getTime() > Date.now() + 60_000
  )
    return decryptSecret(
      grant.accessTokenCiphertext,
      `google-access:${userId}:${grant.product}:${grant.accountId}`,
    );
  if (!grant.refreshTokenCiphertext)
    throw new Error("GOOGLE_RECONNECT_REQUIRED");
  const cfg = config();
  const refreshToken = decryptSecret(
    grant.refreshTokenCiphertext,
    `google-refresh:${userId}:${grant.product}:${grant.accountId}`,
  );
  const tokens = await tokenRequest(
    new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  );
  const access = encryptSecret(
    tokens.access_token,
    `google-access:${userId}:${grant.product}:${grant.accountId}`,
  );
  await db.alphaSeoGoogleOAuthGrant.update({
    where: { id: grant.id },
    data: {
      accessTokenCiphertext: access.ciphertext,
      accessTokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : null,
      ...(tokens.refresh_token
        ? {
            refreshTokenCiphertext: encryptSecret(
              tokens.refresh_token,
              `google-refresh:${userId}:${grant.product}:${grant.accountId}`,
            ).ciphertext,
          }
        : {}),
    },
  });
  return tokens.access_token;
}

/**
 * Revoga um grant somente quando ele não sustenta mais nenhuma conexão do
 * produto correspondente. O filtro relacional faz o claim da revogação em
 * uma única escrita, evitando revogar um token ainda compartilhado.
 */
export async function revokeGoogleGrantIfUnused(
  grantId: string,
  userId: number,
  product: GoogleProduct,
) {
  const grant = await db.alphaSeoGoogleOAuthGrant.findFirst({
    where: { id: grantId, userId, product, revokedAt: null },
    select: {
      id: true,
      product: true,
      accountId: true,
      accessTokenCiphertext: true,
      refreshTokenCiphertext: true,
    },
  });
  if (!grant) return false;

  const unusedFilter =
    product === "GSC"
      ? { gscConnections: { none: {} } }
      : { ga4Connections: { none: {} } };
  const claimed = await db.alphaSeoGoogleOAuthGrant.updateMany({
    where: {
      id: grant.id,
      userId,
      product,
      revokedAt: null,
      ...unusedFilter,
    },
    data: { revokedAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const token = grant.refreshTokenCiphertext
    ? decryptSecret(
        grant.refreshTokenCiphertext,
        `google-refresh:${userId}:${grant.product}:${grant.accountId}`,
      )
    : decryptSecret(
        grant.accessTokenCiphertext,
        `google-access:${userId}:${grant.product}:${grant.accountId}`,
      );
  await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(15_000),
    },
  ).catch(() => undefined);
  return true;
}
