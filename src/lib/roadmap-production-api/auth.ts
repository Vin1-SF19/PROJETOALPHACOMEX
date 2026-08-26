import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { auth } from "../../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export const ROADMAP_API_READ_SCOPE = "roadmap:read";
export const ROADMAP_API_WRITE_SCOPE = "roadmap:write";
export const ROADMAP_API_ALLOWED_SCOPES = [
  ROADMAP_API_READ_SCOPE,
  ROADMAP_API_WRITE_SCOPE,
] as const;
const TOKEN_PREFIX = "roadmap_key_";

export interface RoadmapApiIdentity {
  userId: number;
  scopes: string[];
  credentialId: string | null;
}

export class RoadmapProductionApiError extends Error {
  constructor(
    public readonly status: 401 | 403 | 429,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoadmapProductionApiError";
  }
}

export function hashRoadmapApiSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createRoadmapApiToken(): { token: string; prefix: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, prefix: token.slice(0, TOKEN_PREFIX.length + 6) };
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) {
    throw new RoadmapProductionApiError(
      401,
      "INVALID_AUTHORIZATION",
      "Use Authorization: Bearer <token>.",
    );
  }
  return match[1];
}

function scopesFromJson(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

async function assertActiveRoadmapProductionUser(userId: number): Promise<void> {
  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { status: true, role: true },
  });
  if (!user || user.status !== "ATIVO") {
    throw new RoadmapProductionApiError(
      401,
      "USER_INACTIVE",
      "A credencial pertence a um usuário inativo.",
    );
  }
  if (!isAdminRole(user.role)) {
    const permissions = await getPermissoesEfetivas(userId);
    if (!permissions.includes("roadmapProduction")) {
      throw new RoadmapProductionApiError(
        403,
        "MODULE_ACCESS_DENIED",
        "O usuário não possui acesso à Produção do Roadmap.",
      );
    }
  }
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
    if (
      !current.enabled ||
      current.revokedAt ||
      (current.expiresAt && current.expiresAt <= now)
    ) {
      throw new RoadmapProductionApiError(
        401,
        "API_KEY_INVALID",
        "API key inválida, revogada ou expirada.",
      );
    }
    const insideWindow = Boolean(
      current.lastRequestAt &&
        now.getTime() - current.lastRequestAt.getTime() < current.rateLimitWindowMs,
    );
    if (insideWindow && current.requestCount >= current.rateLimitMax) {
      throw new RoadmapProductionApiError(
        429,
        "RATE_LIMITED",
        "Limite da API key atingido. Aguarde a próxima janela.",
      );
    }
    const effectiveNow =
      current.lastRequestAt && current.lastRequestAt > now ? current.lastRequestAt : now;
    const consumed = await db.roadmapApiKey.updateMany({
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
    const refreshed = await db.roadmapApiKey.findUnique({
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
    if (!refreshed) {
      throw new RoadmapProductionApiError(
        401,
        "API_KEY_INVALID",
        "API key inválida, revogada ou expirada.",
      );
    }
    current = refreshed;
  }
  throw new RoadmapProductionApiError(
    429,
    "RATE_LIMITED",
    "Muitas requisições concorrentes para esta API key.",
  );
}

async function resolveApiKey(token: string): Promise<RoadmapApiIdentity | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const now = new Date();
  const row = await db.roadmapApiKey.findUnique({
    where: { keyHash: hashRoadmapApiSecret(token) },
    select: {
      id: true,
      createdById: true,
      scopesJson: true,
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
    throw new RoadmapProductionApiError(
      401,
      "API_KEY_INVALID",
      "API key inválida, revogada ou expirada.",
    );
  }
  await assertActiveRoadmapProductionUser(row.createdById);
  await consumeApiKeyRateLimit(row, now);
  return {
    userId: row.createdById,
    scopes: scopesFromJson(row.scopesJson),
    credentialId: row.id,
  };
}

async function resolveSession(): Promise<RoadmapApiIdentity> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new RoadmapProductionApiError(
      401,
      "UNAUTHENTICATED",
      "Autentique-se no Painel Alpha ou envie uma credencial Bearer.",
    );
  }
  await assertActiveRoadmapProductionUser(userId);
  return {
    userId,
    scopes: [...ROADMAP_API_ALLOWED_SCOPES],
    credentialId: null,
  };
}

export async function resolveRoadmapApiIdentity(request: Request): Promise<RoadmapApiIdentity> {
  const token = bearerToken(request);
  if (!token) return resolveSession();
  const identity = await resolveApiKey(token);
  if (!identity) {
    throw new RoadmapProductionApiError(
      401,
      "BEARER_TOKEN_INVALID",
      "Credencial Bearer não reconhecida.",
    );
  }
  return identity;
}

export function requireScope(identity: RoadmapApiIdentity, scope: string): void {
  if (!identity.scopes.includes(scope)) {
    throw new RoadmapProductionApiError(
      403,
      "SCOPE_REQUIRED",
      `A operação exige o scope ${scope}.`,
    );
  }
}
