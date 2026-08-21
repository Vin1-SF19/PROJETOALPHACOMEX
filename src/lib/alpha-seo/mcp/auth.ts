import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { auth } from "../../../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import type {
  AlphaSeoMcpIdentity,
  AlphaSeoMcpProjectContext,
} from "./types";

export const MCP_SCOPE = "alpha-seo:mcp";
export const MCP_READ_SCOPE = "alpha-seo:read";
export const MCP_WRITE_SCOPE = "alpha-seo:write";
export const MCP_ALLOWED_SCOPES = [MCP_SCOPE, MCP_READ_SCOPE, MCP_WRITE_SCOPE] as const;

export class AlphaSeoMcpAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 429,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AlphaSeoMcpAuthError";
  }
}

export function hashMcpSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createOpaqueMcpToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) {
    throw new AlphaSeoMcpAuthError(401, "INVALID_AUTHORIZATION", "Use Authorization: Bearer <token>.");
  }
  return match[1];
}

function scopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function assertActiveMcpUser(userId: number): Promise<{ email: string }> {
  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { email: true, status: true, role: true },
  });
  if (!user || user.status !== "ATIVO") {
    throw new AlphaSeoMcpAuthError(401, "USER_INACTIVE", "A credencial pertence a um usuário inativo.");
  }
  if (!isAdminRole(user.role)) {
    const permissions = await getPermissoesEfetivas(userId);
    if (!permissions.includes("alphaSeo")) {
      throw new AlphaSeoMcpAuthError(403, "MODULE_ACCESS_DENIED", "O usuário não possui acesso ao Alpha SEO.");
    }
  }
  return { email: user.email };
}

async function resolveApiKey(token: string): Promise<AlphaSeoMcpIdentity | null> {
  if (!token.startsWith("aseo_key_")) return null;
  const now = new Date();
  const row = await db.alphaSeoApiKey.findUnique({
    where: { keyHash: hashMcpSecret(token) },
    select: {
      id: true,
      projectId: true,
      createdById: true,
      scopes: true,
      enabled: true,
      expiresAt: true,
      revokedAt: true,
      rateLimitWindowMs: true,
      rateLimitMax: true,
      requestCount: true,
      lastRequestAt: true,
    },
  });
  if (!row || !row.enabled || row.revokedAt || (row.expiresAt && row.expiresAt <= now)) {
    throw new AlphaSeoMcpAuthError(401, "API_KEY_INVALID", "API key inválida, revogada ou expirada.");
  }
  const user = await assertActiveMcpUser(row.createdById);
  await consumeApiKeyRateLimit(row, now);
  return {
    kind: "api_key",
    userId: row.createdById,
    email: user.email,
    scopes: scopes(row.scopes),
    fixedProjectId: row.projectId,
    credentialId: row.id,
  };
}

async function consumeApiKeyRateLimit(
  initial: {
    id: string;
    enabled: boolean;
    expiresAt: Date | null;
    revokedAt: Date | null;
    rateLimitWindowMs: number;
    rateLimitMax: number;
    requestCount: number;
    lastRequestAt: Date | null;
  },
  now: Date,
): Promise<void> {
  let current = initial;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!current.enabled || current.revokedAt || (current.expiresAt && current.expiresAt <= now)) {
      throw new AlphaSeoMcpAuthError(401, "API_KEY_INVALID", "API key inválida, revogada ou expirada.");
    }
    const insideWindow = Boolean(
      current.lastRequestAt && now.getTime() - current.lastRequestAt.getTime() < current.rateLimitWindowMs,
    );
    if (insideWindow && current.requestCount >= current.rateLimitMax) {
      throw new AlphaSeoMcpAuthError(429, "RATE_LIMITED", "Limite da API key atingido. Aguarde a próxima janela.");
    }
    const effectiveNow = current.lastRequestAt && current.lastRequestAt > now ? current.lastRequestAt : now;
    const consumed = await db.alphaSeoApiKey.updateMany({
      where: {
        id: current.id,
        enabled: true,
        revokedAt: null,
        requestCount: current.requestCount,
        lastRequestAt: current.lastRequestAt,
      },
      data: {
        requestCount: insideWindow ? current.requestCount + 1 : 1,
        lastRequestAt: effectiveNow,
        lastUsedAt: effectiveNow,
      },
    });
    if (consumed.count === 1) return;
    const refreshed = await db.alphaSeoApiKey.findUnique({
      where: { id: current.id },
      select: {
        id: true,
        enabled: true,
        expiresAt: true,
        revokedAt: true,
        rateLimitWindowMs: true,
        rateLimitMax: true,
        requestCount: true,
        lastRequestAt: true,
      },
    });
    if (!refreshed) throw new AlphaSeoMcpAuthError(401, "API_KEY_INVALID", "API key inválida, revogada ou expirada.");
    current = refreshed;
  }
  throw new AlphaSeoMcpAuthError(429, "RATE_LIMITED", "Muitas requisições concorrentes para esta API key.");
}

async function resolveAccessToken(token: string): Promise<AlphaSeoMcpIdentity | null> {
  if (!token.startsWith("aseo_at_")) return null;
  const now = new Date();
  const row = await db.alphaSeoMcpAccessToken.findUnique({
    where: { tokenHash: hashMcpSecret(token) },
    select: {
      id: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
      grant: {
        select: {
          userId: true,
          projectId: true,
          status: true,
          expiresAt: true,
          revokedAt: true,
          scopes: true,
          client: { select: { revokedAt: true } },
        },
      },
    },
  });
  if (
    !row ||
    row.revokedAt ||
    row.expiresAt <= now ||
    row.grant.status !== "ACTIVE" ||
    row.grant.revokedAt ||
    row.grant.client.revokedAt ||
    (row.grant.expiresAt && row.grant.expiresAt <= now)
  ) {
    throw new AlphaSeoMcpAuthError(401, "ACCESS_TOKEN_INVALID", "Access token inválido, revogado ou expirado.");
  }
  await db.alphaSeoMcpAccessToken.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  const user = await assertActiveMcpUser(row.grant.userId);
  const tokenScopes = scopes(row.scopes);
  const grantScopes = new Set(scopes(row.grant.scopes));
  return {
    kind: "oauth",
    userId: row.grant.userId,
    email: user.email,
    scopes: tokenScopes.filter((scope) => grantScopes.has(scope)),
    fixedProjectId: row.grant.projectId,
    credentialId: row.id,
  };
}

async function resolveSession(): Promise<AlphaSeoMcpIdentity> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new AlphaSeoMcpAuthError(401, "UNAUTHENTICATED", "Autentique-se no Painel Alpha ou envie uma credencial Bearer.");
  }
  const user = await assertActiveMcpUser(userId);
  return {
    kind: "session",
    userId,
    email: user.email,
    scopes: [...MCP_ALLOWED_SCOPES],
    fixedProjectId: null,
    credentialId: null,
  };
}

export async function resolveAlphaSeoMcpIdentity(request: Request): Promise<AlphaSeoMcpIdentity> {
  const token = bearerToken(request);
  if (!token) return resolveSession();
  const identity = (await resolveApiKey(token)) ?? (await resolveAccessToken(token));
  if (!identity) {
    throw new AlphaSeoMcpAuthError(401, "BEARER_TOKEN_INVALID", "Credencial Bearer não reconhecida.");
  }
  if (!identity.scopes.includes(MCP_SCOPE)) {
    throw new AlphaSeoMcpAuthError(403, "MCP_SCOPE_REQUIRED", `A credencial precisa do scope ${MCP_SCOPE}.`);
  }
  return identity;
}

const ROLE_LEVEL = { VIEWER: 1, EDITOR: 2, OWNER: 3 } as const;

export async function authorizeMcpProject(
  identity: AlphaSeoMcpIdentity,
  projectId: string,
  minimumRole: "OWNER" | "EDITOR" | "VIEWER" = "VIEWER",
): Promise<AlphaSeoMcpProjectContext> {
  if (identity.fixedProjectId && identity.fixedProjectId !== projectId) {
    throw new AlphaSeoMcpAuthError(403, "PROJECT_SCOPE_MISMATCH", "A credencial não autoriza este projeto.");
  }
  if (minimumRole !== "VIEWER" && !identity.scopes.includes(MCP_WRITE_SCOPE)) {
    throw new AlphaSeoMcpAuthError(403, "WRITE_SCOPE_REQUIRED", `A operação exige o scope ${MCP_WRITE_SCOPE}.`);
  }
  if (minimumRole === "VIEWER" && !identity.scopes.some((scope) => scope === MCP_READ_SCOPE || scope === MCP_WRITE_SCOPE)) {
    throw new AlphaSeoMcpAuthError(403, "READ_SCOPE_REQUIRED", `A operação exige ${MCP_READ_SCOPE} ou ${MCP_WRITE_SCOPE}.`);
  }
  const project = await db.alphaSeoProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      domain: true,
      locationCode: true,
      locationName: true,
      languageCode: true,
      market: true,
      status: true,
      members: {
        where: { userId: identity.userId, active: true },
        select: { role: true },
        take: 1,
      },
    },
  });
  if (!project || project.status !== "ACTIVE") {
    throw new AlphaSeoMcpAuthError(403, "PROJECT_NOT_FOUND", "Projeto não encontrado ou indisponível.");
  }
  let role: "OWNER" | "EDITOR" | "VIEWER";
  if (project.ownerId === identity.userId) role = "OWNER";
  else {
    const candidate = project.members[0]?.role;
    if (candidate !== "OWNER" && candidate !== "EDITOR" && candidate !== "VIEWER") {
      throw new AlphaSeoMcpAuthError(403, "PROJECT_ACCESS_DENIED", "O usuário não participa deste projeto.");
    }
    role = candidate;
  }
  if (ROLE_LEVEL[role] < ROLE_LEVEL[minimumRole]) {
    throw new AlphaSeoMcpAuthError(403, "PROJECT_ROLE_DENIED", `A operação exige papel ${minimumRole}.`);
  }
  return {
    ...identity,
    projectId: project.id,
    projectRole: role,
    project: {
      id: project.id,
      name: project.name,
      domain: project.domain,
      locationCode: project.locationCode,
      locationName: project.locationName,
      languageCode: project.languageCode,
      market: project.market,
    },
  };
}
