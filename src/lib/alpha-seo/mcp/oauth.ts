import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import db from "@/lib/prisma";
import {
  createOpaqueMcpToken,
  hashMcpSecret,
  MCP_ALLOWED_SCOPES,
  MCP_SCOPE,
} from "./auth";

const CLIENT_SECRET_PREFIX = "aseo_cs_";
const AUTH_CODE_PREFIX = "aseo_code_";
const ACCESS_TOKEN_PREFIX = "aseo_at_";
const REFRESH_TOKEN_PREFIX = "aseo_rt_";

const redirectUriSchema = z
  .string()
  .url()
  .max(2_048)
  .refine((raw) => {
    const url = new URL(raw);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  }, "redirect_uri deve usar HTTPS (HTTP só em localhost)");

export const oauthClientRegistrationSchema = z
  .object({
    client_name: z.string().trim().min(1).max(120),
    redirect_uris: z.array(redirectUriSchema).min(1).max(20),
    grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).min(1).default(["authorization_code", "refresh_token"]),
    response_types: z.array(z.literal("code")).min(1).default(["code"]),
    token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).default("none"),
    scope: z.string().max(500).optional(),
  })
  .strict();

export const oauthAuthorizeSchema = z
  .object({
    response_type: z.literal("code"),
    client_id: z.string().min(1).max(200),
    redirect_uri: redirectUriSchema,
    scope: z.string().max(500).default(`${MCP_SCOPE} alpha-seo:read`),
    state: z.string().min(8).max(1_024),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    code_challenge_method: z.literal("S256"),
    project_id: z.string().min(1).max(100),
    resource: z.string().url().max(2_048).optional(),
  })
  .strict();

function parseScopes(raw: string | undefined): string[] {
  const requested = [...new Set((raw ?? "").split(/\s+/).filter(Boolean))];
  if (!requested.includes(MCP_SCOPE)) requested.unshift(MCP_SCOPE);
  for (const scope of requested) {
    if (!(MCP_ALLOWED_SCOPES as readonly string[]).includes(scope)) throw new Error(`INVALID_SCOPE:${scope}`);
  }
  return requested;
}

function constantTimeEqual(left: string, rightHash: string): boolean {
  const digest = Buffer.from(hashMcpSecret(left), "hex");
  const expected = Buffer.from(rightHash, "hex");
  return digest.length === expected.length && timingSafeEqual(digest, expected);
}

export async function registerMcpOAuthClient(input: unknown, createdById?: number) {
  const parsed = oauthClientRegistrationSchema.parse(input);
  const clientId = createOpaqueMcpToken("aseo_client_");
  const confidential = parsed.token_endpoint_auth_method !== "none";
  const clientSecret = confidential ? createOpaqueMcpToken(CLIENT_SECRET_PREFIX) : null;
  const scopes = parseScopes(parsed.scope);
  await db.alphaSeoMcpOAuthClient.create({
    data: {
      clientId,
      clientSecretHash: clientSecret ? hashMcpSecret(clientSecret) : null,
      clientName: parsed.client_name,
      redirectUris: parsed.redirect_uris,
      grantTypes: parsed.grant_types,
      responseTypes: parsed.response_types,
      tokenEndpointAuthMethod: parsed.token_endpoint_auth_method,
      scopes,
      createdById: createdById ?? null,
    },
  });
  return {
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    client_name: parsed.client_name,
    redirect_uris: parsed.redirect_uris,
    grant_types: parsed.grant_types,
    response_types: parsed.response_types,
    token_endpoint_auth_method: parsed.token_endpoint_auth_method,
    scope: scopes.join(" "),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function createMcpAuthorizationCode(input: {
  payload: unknown;
  userId: number;
}) {
  const parsed = oauthAuthorizeSchema.parse(input.payload);
  const client = await db.alphaSeoMcpOAuthClient.findUnique({
    where: { clientId: parsed.client_id },
    select: { id: true, redirectUris: true, scopes: true, revokedAt: true },
  });
  if (!client || client.revokedAt) throw new Error("OAUTH_CLIENT_INVALID");
  if (!stringArray(client.redirectUris).includes(parsed.redirect_uri)) throw new Error("REDIRECT_URI_MISMATCH");
  const clientScopes = new Set(stringArray(client.scopes));
  const requestedScopes = parseScopes(parsed.scope);
  if (requestedScopes.some((scope) => !clientScopes.has(scope))) throw new Error("INVALID_SCOPE");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const grant = await db.$transaction(async (tx) => {
    const existing = await tx.alphaSeoMcpOAuthGrant.findFirst({
      where: { oauthClientId: client.id, userId: input.userId, projectId: parsed.project_id, status: "ACTIVE", revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (existing) {
      return tx.alphaSeoMcpOAuthGrant.update({
        where: { id: existing.id },
        data: { scopes: requestedScopes, resource: parsed.resource ?? null, expiresAt, consentedAt: now },
        select: { id: true },
      });
    }
    return tx.alphaSeoMcpOAuthGrant.create({
      data: {
        oauthClientId: client.id,
        userId: input.userId,
        projectId: parsed.project_id,
        scopes: requestedScopes,
        resource: parsed.resource ?? null,
        expiresAt,
      },
      select: { id: true },
    });
  });
  const code = createOpaqueMcpToken(AUTH_CODE_PREFIX);
  await db.alphaSeoMcpAuthorizationCode.create({
    data: {
      grantId: grant.id,
      codeHash: hashMcpSecret(code),
      redirectUriHash: hashMcpSecret(parsed.redirect_uri),
      codeChallenge: parsed.code_challenge,
      codeChallengeMethod: parsed.code_challenge_method,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const redirect = new URL(parsed.redirect_uri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", parsed.state);
  return { redirect: redirect.toString(), grantId: grant.id };
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

interface ClientCredentials {
  clientId: string;
  clientSecret?: string;
}

export function readOAuthClientCredentials(request: Request, body: URLSearchParams): ClientCredentials {
  const basic = request.headers.get("authorization")?.match(/^Basic\s+(.+)$/i);
  if (basic) {
    const [clientId, clientSecret] = Buffer.from(basic[1], "base64").toString("utf8").split(":", 2).map(decodeURIComponent);
    return { clientId, clientSecret };
  }
  return { clientId: body.get("client_id") ?? "", clientSecret: body.get("client_secret") ?? undefined };
}

async function verifyClient(credentials: ClientCredentials) {
  const client = await db.alphaSeoMcpOAuthClient.findUnique({
    where: { clientId: credentials.clientId },
    select: { id: true, clientId: true, clientSecretHash: true, tokenEndpointAuthMethod: true, revokedAt: true },
  });
  if (!client || client.revokedAt) throw new Error("INVALID_CLIENT");
  if (client.tokenEndpointAuthMethod === "none") {
    if (credentials.clientSecret) throw new Error("INVALID_CLIENT");
  } else if (!credentials.clientSecret || !client.clientSecretHash || !constantTimeEqual(credentials.clientSecret, client.clientSecretHash)) {
    throw new Error("INVALID_CLIENT");
  }
  return client;
}

async function issueTokens(grantId: string, requestedScopes?: string[]) {
  const grant = await db.alphaSeoMcpOAuthGrant.findUnique({ where: { id: grantId }, select: { id: true, scopes: true, status: true, expiresAt: true } });
  if (!grant || grant.status !== "ACTIVE" || (grant.expiresAt && grant.expiresAt <= new Date())) throw new Error("INVALID_GRANT");
  const granted = stringArray(grant.scopes);
  const selected = requestedScopes?.length ? requestedScopes : granted;
  if (selected.some((scope) => !granted.includes(scope))) throw new Error("INVALID_SCOPE");
  const accessToken = createOpaqueMcpToken(ACCESS_TOKEN_PREFIX);
  const refreshToken = createOpaqueMcpToken(REFRESH_TOKEN_PREFIX);
  const familyId = createOpaqueMcpToken("aseo_family_");
  const accessExpiresAt = new Date(Date.now() + 60 * 60_000);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  await db.$transaction([
    db.alphaSeoMcpAccessToken.create({ data: { grantId, tokenHash: hashMcpSecret(accessToken), scopes: selected, expiresAt: accessExpiresAt } }),
    db.alphaSeoMcpRefreshToken.create({ data: { grantId, tokenHash: hashMcpSecret(refreshToken), tokenFamilyId: familyId, scopes: selected, expiresAt: refreshExpiresAt } }),
  ]);
  return { access_token: accessToken, token_type: "Bearer", expires_in: 3_600, refresh_token: refreshToken, scope: selected.join(" ") };
}

export async function exchangeMcpAuthorizationCode(input: {
  request: Request;
  body: URLSearchParams;
}) {
  const client = await verifyClient(readOAuthClientCredentials(input.request, input.body));
  const code = input.body.get("code") ?? "";
  const redirectUri = input.body.get("redirect_uri") ?? "";
  const verifier = input.body.get("code_verifier") ?? "";
  if (!code || !redirectUri || !verifier) throw new Error("INVALID_REQUEST");
  const row = await db.alphaSeoMcpAuthorizationCode.findUnique({
    where: { codeHash: hashMcpSecret(code) },
    select: { id: true, grantId: true, redirectUriHash: true, codeChallenge: true, expiresAt: true, consumedAt: true, grant: { select: { oauthClientId: true } } },
  });
  if (!row || row.grant.oauthClientId !== client.id || row.consumedAt || row.expiresAt <= new Date()) throw new Error("INVALID_GRANT");
  if (row.redirectUriHash !== hashMcpSecret(redirectUri) || row.codeChallenge !== codeChallenge(verifier)) throw new Error("INVALID_GRANT");
  const consumed = await db.alphaSeoMcpAuthorizationCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw new Error("INVALID_GRANT");
  return issueTokens(row.grantId, parseScopes(input.body.get("scope") ?? undefined));
}

export async function rotateMcpRefreshToken(input: { request: Request; body: URLSearchParams }) {
  const client = await verifyClient(readOAuthClientCredentials(input.request, input.body));
  const raw = input.body.get("refresh_token") ?? "";
  const row = await db.alphaSeoMcpRefreshToken.findUnique({
    where: { tokenHash: hashMcpSecret(raw) },
    select: { id: true, grantId: true, tokenFamilyId: true, scopes: true, expiresAt: true, usedAt: true, revokedAt: true, grant: { select: { oauthClientId: true, status: true, revokedAt: true } } },
  });
  if (!row || row.grant.oauthClientId !== client.id || row.revokedAt || row.expiresAt <= new Date() || row.grant.status !== "ACTIVE" || row.grant.revokedAt) throw new Error("INVALID_GRANT");
  if (row.usedAt) {
    await db.alphaSeoMcpRefreshToken.updateMany({ where: { tokenFamilyId: row.tokenFamilyId }, data: { revokedAt: new Date() } });
    throw new Error("REFRESH_TOKEN_REUSE_DETECTED");
  }
  const marked = await db.alphaSeoMcpRefreshToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (marked.count !== 1) throw new Error("INVALID_GRANT");
  const requested = input.body.get("scope") ? parseScopes(input.body.get("scope") ?? undefined) : stringArray(row.scopes);
  const grantScopes = stringArray(row.scopes);
  if (requested.some((scope) => !grantScopes.includes(scope))) throw new Error("INVALID_SCOPE");
  const accessToken = createOpaqueMcpToken(ACCESS_TOKEN_PREFIX);
  const refreshToken = createOpaqueMcpToken(REFRESH_TOKEN_PREFIX);
  await db.$transaction([
    db.alphaSeoMcpAccessToken.create({ data: { grantId: row.grantId, tokenHash: hashMcpSecret(accessToken), scopes: requested, expiresAt: new Date(Date.now() + 60 * 60_000) } }),
    db.alphaSeoMcpRefreshToken.create({ data: { grantId: row.grantId, tokenHash: hashMcpSecret(refreshToken), tokenFamilyId: row.tokenFamilyId, parentTokenId: row.id, scopes: requested, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000) } }),
  ]);
  return { access_token: accessToken, token_type: "Bearer", expires_in: 3_600, refresh_token: refreshToken, scope: requested.join(" ") };
}

export async function revokeMcpToken(raw: string): Promise<void> {
  if (raw.startsWith(ACCESS_TOKEN_PREFIX)) {
    await db.alphaSeoMcpAccessToken.updateMany({ where: { tokenHash: hashMcpSecret(raw), revokedAt: null }, data: { revokedAt: new Date() } });
  } else if (raw.startsWith(REFRESH_TOKEN_PREFIX)) {
    const token = await db.alphaSeoMcpRefreshToken.findUnique({ where: { tokenHash: hashMcpSecret(raw) }, select: { tokenFamilyId: true } });
    if (token) await db.alphaSeoMcpRefreshToken.updateMany({ where: { tokenFamilyId: token.tokenFamilyId }, data: { revokedAt: new Date() } });
  }
}

