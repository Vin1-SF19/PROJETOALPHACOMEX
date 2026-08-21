import "server-only";

import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { alphaSeoCacheKey, alphaSeoIdempotencyKey } from "@/lib/alpha-seo/operation-policy";
import type { AlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { acquireAlphaSeoMutex, releaseAlphaSeoMutex } from "@/lib/alpha-seo/jobs/mutex";
import { createAlphaSeoDataForSeoClient } from "./client";

const APPROVAL_THRESHOLD_MICROS_USD = 2_000_000;

export type AlphaSeoProviderOperationAccess = Pick<AlphaSeoProjectAccess, "projectId" | "userId">;

function operationCost(operation: string, units: number): number {
  const perUnitMicros: Record<string, number> = {
    KEYWORD_RESEARCH: 20_000,
    KEYWORD_METRICS: 10_000,
    SERP_ANALYSIS: 25_000,
    DOMAIN_OVERVIEW: 20_000,
    DOMAIN_KEYWORDS: 30_000,
    DOMAIN_PAGES: 30_000,
    BACKLINKS_OVERVIEW: 30_000,
    BACKLINKS_HISTORY: 30_000,
    BACKLINKS_ROWS: 30_000,
    BACKLINKS_DOMAINS: 30_000,
    BACKLINKS_PAGES: 30_000,
    LIGHTHOUSE: 25_000,
    RANK_SUGGESTIONS: 25_000,
    RANK_KEYWORD_METRICS: 10_000,
    SAVED_KEYWORD_METRICS: 10_000,
  };
  return units * (perUnitMicros[operation] ?? 25_000);
}

export function estimateAlphaSeoProviderCost(operation: string, units: number) {
  const safeUnits = Math.max(0, Math.trunc(units));
  const estimatedMicrosUsd = operationCost(operation, safeUnits);
  return { operation, units: safeUnits, estimatedMicrosUsd, approvalRequired: estimatedMicrosUsd > APPROVAL_THRESHOLD_MICROS_USD };
}

export function estimateAlphaSeoProviderRequest(access: AlphaSeoProviderOperationAccess, operation: string, request: unknown, units: number) {
  return { ...estimateAlphaSeoProviderCost(operation, units), requestHash: alphaSeoCacheKey(access.projectId, operation, request) };
}

export async function approveAlphaSeoProviderCost(access: AlphaSeoProviderOperationAccess, operation: string, request: unknown, units: number) {
  const requestHash = alphaSeoCacheKey(access.projectId, operation, request);
  const estimate = estimateAlphaSeoProviderCost(operation, units);
  return db.alphaSeoCostApproval.upsert({
    where: { projectId_userId_operation_requestHash: { projectId: access.projectId, userId: access.userId, operation, requestHash } },
    create: { projectId: access.projectId, userId: access.userId, operation, requestHash, estimatedUnits: units, estimatedMicrosUsd: estimate.estimatedMicrosUsd, expiresAt: new Date(Date.now() + 15 * 60_000) },
    update: { estimatedUnits: units, estimatedMicrosUsd: estimate.estimatedMicrosUsd, approvedAt: new Date(), expiresAt: new Date(Date.now() + 15 * 60_000) },
    select: { id: true, operation: true, estimatedUnits: true, estimatedMicrosUsd: true, expiresAt: true },
  });
}

export async function assertAlphaSeoProviderCostApproved(access: AlphaSeoProviderOperationAccess, operation: string, request: unknown, units: number) {
  const estimate = estimateAlphaSeoProviderCost(operation, units);
  if (!estimate.approvalRequired) return estimate;
  const requestHash = alphaSeoCacheKey(access.projectId, operation, request);
  const approval = await db.alphaSeoCostApproval.findUnique({ where: { projectId_userId_operation_requestHash: { projectId: access.projectId, userId: access.userId, operation, requestHash } }, select: { expiresAt: true } });
  if (!approval || approval.expiresAt <= new Date()) {
    const error = new Error("Aprovação de custo necessária antes desta operação");
    error.name = "AlphaSeoCostApprovalRequired";
    throw error;
  }
  return estimate;
}

export async function executeAlphaSeoDataForSeo<T>(input: {
  access: AlphaSeoProviderOperationAccess;
  operation: string;
  path: string;
  payload: Record<string, unknown>;
  units?: number;
  cacheTtlSeconds?: number;
  timeoutMs?: number;
  approval?: { operation: string; request: unknown; units: number };
  parse: (results: unknown[]) => T;
}): Promise<{ data: T; cached: boolean; runId: string | null; costUsd: number }> {
  const units = input.units ?? 1;
  const cacheTtlSeconds = input.cacheTtlSeconds ?? 43_200;
  const requestHash = alphaSeoCacheKey(input.access.projectId, input.operation, input.payload);
  const cacheWindow = Math.floor(Date.now() / (cacheTtlSeconds * 1000));
  const idempotencyKey = alphaSeoIdempotencyKey(input.access.projectId, input.operation, { payload: input.payload, cacheWindow });
  const estimate = estimateAlphaSeoProviderCost(input.operation, units);
  const now = new Date();
  const cached = await db.alphaSeoProviderCache.findUnique({
    where: { projectId_provider_operation_cacheKeyHash: { projectId: input.access.projectId, provider: "DATAFORSEO", operation: input.operation, cacheKeyHash: requestHash } },
    select: { payload: true, expiresAt: true, sourceRunId: true },
  });
  if (cached && cached.expiresAt > now) return { data: cached.payload as T, cached: true, runId: cached.sourceRunId, costUsd: 0 };

  let prior = await db.alphaSeoExternalOperationRun.findUnique({ where: { idempotencyKey }, select: { id: true, status: true, result: true, actualMicrosUsd: true } });
  if (prior?.status === "COMPLETED" && prior.result !== null) {
    return { data: prior.result as T, cached: true, runId: prior.id, costUsd: (prior.actualMicrosUsd ?? 0) / 1_000_000 };
  }
  const approvalPolicy = input.approval ?? { operation: input.operation, request: input.payload, units };
  const approvalEstimate = estimateAlphaSeoProviderCost(approvalPolicy.operation, approvalPolicy.units);
  if (approvalEstimate.approvalRequired) {
    const approvalRequestHash = alphaSeoCacheKey(input.access.projectId, approvalPolicy.operation, approvalPolicy.request);
    const approval = await db.alphaSeoCostApproval.findUnique({ where: { projectId_userId_operation_requestHash: { projectId: input.access.projectId, userId: input.access.userId, operation: approvalPolicy.operation, requestHash: approvalRequestHash } }, select: { expiresAt: true, estimatedUnits: true, estimatedMicrosUsd: true } });
    if (!approval || approval.expiresAt <= now || approval.estimatedUnits < approvalEstimate.units || approval.estimatedMicrosUsd < approvalEstimate.estimatedMicrosUsd) {
      const error = new Error("Aprovação de custo necessária antes desta operação");
      error.name = "AlphaSeoCostApprovalRequired";
      throw error;
    }
  }

  const lease = await acquireAlphaSeoMutex({
    projectId: input.access.projectId,
    operation: "DATAFORSEO_REQUEST_MUTEX",
    key: idempotencyKey,
    leaseMs: 5 * 60_000,
  });
  if (!lease) {
    const error = new Error("Uma requisição idêntica já está em andamento");
    error.name = "AlphaSeoOperationInProgress";
    throw error;
  }
  try {
    const afterLock = new Date();
    const cachedAfterLock = await db.alphaSeoProviderCache.findUnique({
      where: { projectId_provider_operation_cacheKeyHash: { projectId: input.access.projectId, provider: "DATAFORSEO", operation: input.operation, cacheKeyHash: requestHash } },
      select: { payload: true, expiresAt: true, sourceRunId: true },
    });
    if (cachedAfterLock && cachedAfterLock.expiresAt > afterLock) {
      return { data: cachedAfterLock.payload as T, cached: true, runId: cachedAfterLock.sourceRunId, costUsd: 0 };
    }
    prior = await db.alphaSeoExternalOperationRun.findUnique({ where: { idempotencyKey }, select: { id: true, status: true, result: true, actualMicrosUsd: true } });
    if (prior?.status === "COMPLETED" && prior.result !== null) {
      return { data: prior.result as T, cached: true, runId: prior.id, costUsd: (prior.actualMicrosUsd ?? 0) / 1_000_000 };
    }

    const run = prior ?? await db.alphaSeoExternalOperationRun.create({
      data: { projectId: input.access.projectId, requestedById: input.access.userId, provider: "DATAFORSEO", operation: input.operation, target: typeof input.payload.target === "string" ? input.payload.target : null, request: input.payload as Prisma.InputJsonValue, requestHash, idempotencyKey, status: "PENDING", estimatedUnits: units, estimatedMicrosUsd: estimate.estimatedMicrosUsd },
      select: { id: true, status: true, result: true, actualMicrosUsd: true },
    });
    await db.alphaSeoExternalOperationRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: afterLock } });
    try {
      const provider = await createAlphaSeoDataForSeoClient({ timeoutMs: input.timeoutMs }).live(input.path, input.payload);
      const data = input.parse(provider.result);
      const actualMicrosUsd = Math.round(provider.costUsd * 1_000_000);
      await db.$transaction(async (tx) => {
        await tx.alphaSeoExternalOperationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", result: data as Prisma.InputJsonValue, actualUnits: units, actualMicrosUsd, completedAt: new Date() } });
        await tx.alphaSeoProviderCache.upsert({
          where: { projectId_provider_operation_cacheKeyHash: { projectId: input.access.projectId, provider: "DATAFORSEO", operation: input.operation, cacheKeyHash: requestHash } },
          create: { projectId: input.access.projectId, provider: "DATAFORSEO", operation: input.operation, cacheKeyHash: requestHash, payload: data as Prisma.InputJsonValue, sourceRunId: run.id, expiresAt: new Date(Date.now() + cacheTtlSeconds * 1000) },
          update: { payload: data as Prisma.InputJsonValue, sourceRunId: run.id, expiresAt: new Date(Date.now() + cacheTtlSeconds * 1000) },
        });
      });
      return { data, cached: false, runId: run.id, costUsd: provider.costUsd };
    } catch (error) {
      await db.alphaSeoExternalOperationRun.update({ where: { id: run.id }, data: { status: "FAILED", errorCode: error instanceof Error ? error.name : "UPSTREAM_ERROR", completedAt: new Date() } });
      throw error;
    }
  } finally {
    await releaseAlphaSeoMutex(lease);
  }
}
