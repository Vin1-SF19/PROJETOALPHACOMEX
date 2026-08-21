import "server-only";

import db from "@/lib/prisma";

const DEFAULT_BATCH_SIZE = 200;

function boundedBatchSize(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(500, Math.trunc(value ?? DEFAULT_BATCH_SIZE)));
}

/**
 * Removes only expired or already-consumed authentication artifacts. The
 * sweep is deliberately bounded so a cron invocation cannot turn into an
 * unbounded mutation or hold the Turso writer for a long period.
 */
export async function purgeExpiredAlphaSeoOAuthData(input: {
  now?: Date;
  batchSize?: number;
} = {}) {
  const now = input.now ?? new Date();
  const batchSize = boundedBatchSize(input.batchSize);
  const consumedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1_000);

  const [googleNonces, authorizationCodes, accessTokens, refreshTokens, grants] =
    await Promise.all([
      db.alphaSeoGoogleOAuthNonce.findMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { consumedAt: { lt: consumedBefore } },
          ],
        },
        select: { id: true },
        orderBy: { expiresAt: "asc" },
        take: batchSize,
      }),
      db.alphaSeoMcpAuthorizationCode.findMany({
        where: {
          OR: [
            { expiresAt: { lt: now } },
            { consumedAt: { lt: consumedBefore } },
          ],
        },
        select: { id: true },
        orderBy: { expiresAt: "asc" },
        take: batchSize,
      }),
      db.alphaSeoMcpAccessToken.findMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: consumedBefore } }],
        },
        select: { id: true },
        orderBy: { expiresAt: "asc" },
        take: batchSize,
      }),
      db.alphaSeoMcpRefreshToken.findMany({
        where: {
          OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: consumedBefore } }],
        },
        select: { id: true },
        orderBy: { expiresAt: "asc" },
        take: batchSize,
      }),
      db.alphaSeoMcpOAuthGrant.findMany({
        where: { status: "ACTIVE", expiresAt: { lt: now } },
        select: { id: true },
        orderBy: { expiresAt: "asc" },
        take: batchSize,
      }),
    ]);

  const [nonceResult, codeResult, accessResult, refreshResult, expiredGrants] =
    await db.$transaction([
      db.alphaSeoGoogleOAuthNonce.deleteMany({
        where: { id: { in: googleNonces.map(({ id }) => id) } },
      }),
      db.alphaSeoMcpAuthorizationCode.deleteMany({
        where: { id: { in: authorizationCodes.map(({ id }) => id) } },
      }),
      db.alphaSeoMcpAccessToken.deleteMany({
        where: { id: { in: accessTokens.map(({ id }) => id) } },
      }),
      db.alphaSeoMcpRefreshToken.deleteMany({
        where: { id: { in: refreshTokens.map(({ id }) => id) } },
      }),
      db.alphaSeoMcpOAuthGrant.updateMany({
        where: { id: { in: grants.map(({ id }) => id) }, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      }),
    ]);

  const counts = {
    googleNonces: nonceResult.count,
    authorizationCodes: codeResult.count,
    accessTokens: accessResult.count,
    refreshTokens: refreshResult.count,
    grantsExpired: expiredGrants.count,
  };
  return {
    counts,
    processed: Object.values(counts).reduce((total, count) => total + count, 0),
    done:
      googleNonces.length < batchSize &&
      authorizationCodes.length < batchSize &&
      accessTokens.length < batchSize &&
      refreshTokens.length < batchSize &&
      grants.length < batchSize,
  };
}
