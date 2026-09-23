import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";

import db from "@/lib/prisma";

export type AuthRateLimitScope =
  | "login_ip"
  | "login_identifier"
  | "recovery_ip"
  | "recovery_identifier"
  | "pre_analise_cadastro"
  | "pre_analise_tributario"
  | "pre_analise_convite";

type AuthRateLimitPolicy = {
  limit: number;
  windowMs: number;
  blockMs: number;
};

export const AUTH_RATE_LIMIT_POLICIES: Record<AuthRateLimitScope, AuthRateLimitPolicy> = {
  login_ip: { limit: 30, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  login_identifier: { limit: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  recovery_ip: { limit: 20, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  recovery_identifier: { limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  pre_analise_cadastro: { limit: 30, windowMs: 60_000, blockMs: 60_000 },
  pre_analise_tributario: { limit: 12, windowMs: 60_000, blockMs: 60_000 },
  pre_analise_convite: { limit: 5, windowMs: 60_000, blockMs: 60_000 },
};

type RateLimitRow = {
  attempts: number | bigint;
  blockedUntil: string | Date | null;
};

export type AuthRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

let lastCleanupAt = 0;

function rateLimitSecret(): string {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_RATE_LIMIT_SECRET ou AUTH_SECRET seguro não configurado");
  }
  return secret;
}

export function normalizeAuthIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase().slice(0, 254);
}

export function getAuthRequestAddress(headers: Headers): string {
  const forwarded =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip") ??
    "unavailable";

  return forwarded.split(",", 1)[0]?.trim().toLowerCase().slice(0, 128) || "unavailable";
}

export function authRateLimitKey(scope: AuthRateLimitScope, subject: string): string {
  return createHmac("sha256", rateLimitSecret())
    .update(`${scope}\0${subject}`, "utf8")
    .digest("hex");
}

async function cleanupExpiredRateLimits(now: Date): Promise<void> {
  if (now.getTime() - lastCleanupAt < 60 * 60_000) return;
  lastCleanupAt = now.getTime();

  await db.authRateLimit.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
  });
}

export async function consumeAuthRateLimit(
  scope: AuthRateLimitScope,
  subject: string,
  now = new Date(),
): Promise<AuthRateLimitResult> {
  const policy = AUTH_RATE_LIMIT_POLICIES[scope];
  const key = authRateLimitKey(scope, subject);
  const nowIso = now.toISOString();
  const windowCutoffIso = new Date(now.getTime() - policy.windowMs).toISOString();
  const blockUntilIso = new Date(now.getTime() + policy.blockMs).toISOString();

  const rows = await db.$queryRaw<RateLimitRow[]>(Prisma.sql`
    INSERT INTO "AuthRateLimit" (
      "key", "scope", "attempts", "windowStartedAt", "blockedUntil", "updatedAt"
    ) VALUES (
      ${key}, ${scope}, 1, ${nowIso}, NULL, ${nowIso}
    )
    ON CONFLICT("key") DO UPDATE SET
      "scope" = excluded."scope",
      "attempts" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${windowCutoffIso} THEN 1
        WHEN "AuthRateLimit"."blockedUntil" IS NOT NULL
          AND "AuthRateLimit"."blockedUntil" > ${nowIso}
          THEN "AuthRateLimit"."attempts"
        ELSE "AuthRateLimit"."attempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${windowCutoffIso} THEN ${nowIso}
        ELSE "AuthRateLimit"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${windowCutoffIso} THEN NULL
        WHEN "AuthRateLimit"."blockedUntil" IS NOT NULL
          AND "AuthRateLimit"."blockedUntil" > ${nowIso}
          THEN "AuthRateLimit"."blockedUntil"
        WHEN "AuthRateLimit"."attempts" + 1 > ${policy.limit} THEN ${blockUntilIso}
        ELSE NULL
      END,
      "updatedAt" = ${nowIso}
    RETURNING "attempts", "blockedUntil"
  `);

  try {
    await cleanupExpiredRateLimits(now);
  } catch (error) {
    console.error("Falha ao limpar contadores antigos de autenticação:", error);
  }

  const blockedUntil = rows[0]?.blockedUntil
    ? new Date(rows[0].blockedUntil).getTime()
    : 0;
  const retryAfterSeconds = Math.max(0, Math.ceil((blockedUntil - now.getTime()) / 1000));

  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

export async function clearAuthRateLimit(
  scope: AuthRateLimitScope,
  subject: string,
): Promise<void> {
  await db.authRateLimit.delete({
    where: { key: authRateLimitKey(scope, subject) },
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return;
    throw error;
  });
}
