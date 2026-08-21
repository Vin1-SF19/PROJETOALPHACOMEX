import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";

export type AlphaSeoJobType = "RANK_RUN" | "SITE_AUDIT" | "LIGHTHOUSE";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  const nested = toPrismaJsonNested(value);
  return nested === null ? "null" : nested;
}

function toPrismaJsonNested(value: unknown): Prisma.InputJsonValue | null {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(toPrismaJsonNested);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, nestedValue]) => nestedValue !== undefined).map(([key, nestedValue]) => [key, toPrismaJsonNested(nestedValue)]));
  return String(value);
}

export async function enqueueAlphaSeoJob(input: {
  projectId?: string;
  type: AlphaSeoJobType;
  idempotencyKey: string;
  payload: Prisma.InputJsonValue;
  priority?: number;
  availableAt?: Date;
  maxAttempts?: number;
}) {
  return db.alphaSeoJob.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: {},
    create: {
      projectId: input.projectId,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      priority: input.priority ?? 100,
      availableAt: input.availableAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
    },
    select: { id: true, status: true, idempotencyKey: true },
  });
}

export async function claimAlphaSeoJob(input: { workerId: string; leaseMs?: number; types?: AlphaSeoJobType[]; now?: Date }) {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? 300_000;
  const staleBefore = new Date(now.getTime() - leaseMs);
  const candidates = await db.alphaSeoJob.findMany({
    where: {
      type: input.types ? { in: input.types } : undefined,
      availableAt: { lte: now },
      OR: [
        { status: { in: ["PENDING", "RETRY"] } },
        { status: "PROCESSING", claimExpiresAt: { lt: now } },
        { status: "PROCESSING", claimExpiresAt: null, heartbeatAt: { lt: staleBefore } },
      ],
    },
    orderBy: [{ priority: "asc" }, { availableAt: "asc" }, { createdAt: "asc" }],
    take: 10,
    select: { id: true, status: true, claimToken: true, claimedBy: true, claimExpiresAt: true, heartbeatAt: true },
  });

  for (const candidate of candidates) {
    const nextToken = candidate.claimToken + 1;
    const claimed = await db.alphaSeoJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        claimToken: candidate.claimToken,
        claimedBy: candidate.claimedBy,
        claimExpiresAt: candidate.claimExpiresAt,
        heartbeatAt: candidate.heartbeatAt,
      },
      data: {
        status: "PROCESSING", claimedBy: input.workerId, claimedAt: now,
        claimExpiresAt: new Date(now.getTime() + leaseMs), heartbeatAt: now,
        claimToken: nextToken, attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;
    return db.alphaSeoJob.findFirst({
      where: { id: candidate.id, claimedBy: input.workerId, claimToken: nextToken },
      select: { id: true, projectId: true, type: true, payload: true, attemptCount: true, maxAttempts: true, claimToken: true, idempotencyKey: true },
    });
  }
  return null;
}

export async function heartbeatAlphaSeoJob(input: { jobId: string; workerId: string; claimToken: number; leaseMs?: number }) {
  const now = new Date();
  return db.alphaSeoJob.updateMany({
    where: { id: input.jobId, status: "PROCESSING", claimedBy: input.workerId, claimToken: input.claimToken },
    data: { heartbeatAt: now, claimExpiresAt: new Date(now.getTime() + (input.leaseMs ?? 300_000)) },
  });
}

export async function checkpointAlphaSeoJob(input: {
  jobId: string;
  workerId: string;
  claimToken: number;
  payload: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  leaseMs?: number;
}) {
  const now = new Date();
  const updated = await db.alphaSeoJob.updateMany({
    where: { id: input.jobId, status: "PROCESSING", claimedBy: input.workerId, claimToken: input.claimToken },
    data: {
      payload: input.payload,
      ...(input.result !== undefined ? { result: input.result } : {}),
      heartbeatAt: now,
      claimExpiresAt: new Date(now.getTime() + (input.leaseMs ?? 300_000)),
    },
  });
  if (updated.count !== 1) throw new Error("ALPHA_SEO_JOB_FENCE_LOST");
}

export async function deferAlphaSeoJob(input: {
  jobId: string;
  workerId: string;
  claimToken: number;
  delayMs: number;
  result?: Prisma.InputJsonValue;
}) {
  const now = new Date();
  const deferred = await db.alphaSeoJob.updateMany({
    where: { id: input.jobId, status: "PROCESSING", claimedBy: input.workerId, claimToken: input.claimToken },
    data: {
      status: "RETRY",
      availableAt: new Date(now.getTime() + Math.max(1_000, input.delayMs)),
      ...(input.result !== undefined ? { result: input.result } : {}),
      attemptCount: { decrement: 1 },
      claimedBy: null,
      claimedAt: null,
      claimExpiresAt: null,
      heartbeatAt: now,
      lastErrorCode: "PROVIDER_QUEUE_PENDING",
      lastErrorMessage: "Aguardando tarefas DataForSEO queued",
    },
  });
  if (deferred.count !== 1) throw new Error("ALPHA_SEO_JOB_FENCE_LOST");
}

export async function completeAlphaSeoJob(input: { jobId: string; workerId: string; claimToken: number; result?: Prisma.InputJsonValue }) {
  const completed = await db.alphaSeoJob.updateMany({
    where: { id: input.jobId, status: "PROCESSING", claimedBy: input.workerId, claimToken: input.claimToken },
    data: { status: "SUCCEEDED", result: input.result, completedAt: new Date(), claimExpiresAt: null, heartbeatAt: new Date() },
  });
  if (completed.count !== 1) throw new Error("ALPHA_SEO_JOB_FENCE_LOST");
}

export async function failAlphaSeoJob(input: { jobId: string; workerId: string; claimToken: number; attemptCount: number; maxAttempts: number; error: unknown }) {
  const exhausted = input.attemptCount >= input.maxAttempts;
  const delayMs = computeAlphaSeoRetryDelay(input.attemptCount);
  const message = input.error instanceof Error ? input.error.message : "Falha desconhecida";
  const failed = await db.alphaSeoJob.updateMany({
    where: { id: input.jobId, status: "PROCESSING", claimedBy: input.workerId, claimToken: input.claimToken },
    data: {
      status: exhausted ? "DEAD_LETTER" : "RETRY",
      availableAt: exhausted ? new Date() : new Date(Date.now() + delayMs),
      lastErrorCode: exhausted ? "RETRY_EXHAUSTED" : "RETRY_SCHEDULED",
      lastErrorMessage: message.slice(0, 1_000), deadLetteredAt: exhausted ? new Date() : null,
      claimExpiresAt: null, heartbeatAt: new Date(),
    },
  });
  if (failed.count !== 1) throw new Error("ALPHA_SEO_JOB_FENCE_LOST");
}

export function computeAlphaSeoRetryDelay(attemptCount: number) {
  return Math.min(30 * 60_000, 5_000 * 2 ** Math.max(0, attemptCount - 1));
}

export function newWorkerId(prefix = "alpha-seo") {
  return `${prefix}:${process.pid}:${randomUUID()}`;
}
