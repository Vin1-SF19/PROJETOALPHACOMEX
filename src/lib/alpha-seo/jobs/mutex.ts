import "server-only";

import { createHash, randomUUID } from "node:crypto";
import db from "@/lib/prisma";
import { toPrismaJson } from "./queue";

export interface AlphaSeoMutexLease { id: string; token: string; expiresAt: Date; }

export async function acquireAlphaSeoMutex(input: { projectId: string; operation: string; key: string; leaseMs?: number; now?: Date }): Promise<AlphaSeoMutexLease | null> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.leaseMs ?? 30_000));
  const cacheKeyHash = createHash("sha256").update(input.key).digest("hex");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = randomUUID();
    try {
      const created = await db.alphaSeoProviderCache.create({
        data: { projectId: input.projectId, provider: "ALPHA_SEO_SYSTEM", operation: input.operation, cacheKeyHash, payload: toPrismaJson({ kind: "mutex", token }), sourceRunId: token, expiresAt },
        select: { id: true },
      });
      return { id: created.id, token, expiresAt };
    } catch {
      const existing = await db.alphaSeoProviderCache.findUnique({
        where: { projectId_provider_operation_cacheKeyHash: { projectId: input.projectId, provider: "ALPHA_SEO_SYSTEM", operation: input.operation, cacheKeyHash } },
        select: { id: true, sourceRunId: true, expiresAt: true, updatedAt: true },
      });
      if (!existing) continue;
      if (existing.expiresAt > now) return null;
      const claimed = await db.alphaSeoProviderCache.updateMany({
        where: { id: existing.id, sourceRunId: existing.sourceRunId, updatedAt: existing.updatedAt, expiresAt: existing.expiresAt },
        data: { sourceRunId: token, expiresAt, payload: toPrismaJson({ kind: "mutex", token }) },
      });
      if (claimed.count === 1) return { id: existing.id, token, expiresAt };
    }
  }
  return null;
}

export async function releaseAlphaSeoMutex(lease: AlphaSeoMutexLease) {
  await db.alphaSeoProviderCache.updateMany({ where: { id: lease.id, sourceRunId: lease.token }, data: { expiresAt: new Date(), payload: toPrismaJson({ kind: "mutex", released: true }) } });
}
