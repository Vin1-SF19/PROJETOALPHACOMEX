import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { enqueueAlphaSeoJob, toPrismaJson } from "@/lib/alpha-seo/jobs/queue";
import {
  computeNextRankCheckAt, estimateRankCost, normalizeRankKeyword, rankDevicesList,
  rankRequestHash, rankRunRetryError, type RankSchedule,
} from "./contracts";
import { claimConfigMutex, getActiveRankRun, getRankConfig, listRankConfigs, recoverStaleActiveRuns, scheduleDueRankConfigs } from "./repository";
import { DataForSeoRankProvider, mapRankKeywordSuggestions, type RankKeywordSuggestion, type RankProvider } from "./provider";
import { newRankQueuedState, rankQueueAuditSummary, type RankQueuedState } from "./queued-state";
import { acquireAlphaSeoMutex, releaseAlphaSeoMutex } from "@/lib/alpha-seo/jobs/mutex";
import {
  approveAlphaSeoProviderCost,
  assertAlphaSeoProviderCostApproved,
  estimateAlphaSeoProviderRequest,
  executeAlphaSeoDataForSeo,
  type AlphaSeoProviderOperationAccess,
} from "@/lib/alpha-seo/dataforseo/operations";

const MAX_CONFIGS = 500;
const MAX_KEYWORDS = 1_000;

export async function createRankConfig(input: {
  projectId: string; domain: string; locationCode: number; locationName?: string | null;
  languageCode: string; devices: string; serpDepth: number; scheduleInterval: RankSchedule;
}) {
  const project = await db.alphaSeoProject.findFirst({ where: { id: input.projectId, status: "ACTIVE" }, select: { id: true } });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  const lease = await acquireAlphaSeoMutex({ projectId: input.projectId, operation: "RANK_CONFIG_MUTEX", key: input.projectId });
  if (!lease) throw new Error("RANK_CONFIG_LEASE_CONFLICT");
  try {
    const duplicate = await db.alphaSeoRankConfig.findFirst({
      where: { projectId: input.projectId, normalizedDomain: input.domain, locationCode: input.locationCode, locationName: input.locationName ?? null },
      select: { id: true, isActive: true },
    });
    const activeCount = await db.alphaSeoRankConfig.count({ where: { projectId: input.projectId, isActive: true } });
    if ((!duplicate || !duplicate.isActive) && activeCount >= MAX_CONFIGS) throw new Error("RANK_CONFIG_LIMIT_REACHED");
    if (duplicate?.isActive) throw new Error("RANK_CONFIG_ALREADY_EXISTS");
    const nextCheckAt = input.scheduleInterval === "MANUAL" ? null : computeNextRankCheckAt(input.scheduleInterval);
    if (duplicate) {
      return db.alphaSeoRankConfig.update({
        where: { id: duplicate.id },
        data: { ...input, normalizedDomain: input.domain, isActive: true, nextCheckAt, scheduleAnchorAt: nextCheckAt, lastSkipReason: null },
        select: { id: true, domain: true, devices: true, serpDepth: true, scheduleInterval: true, nextCheckAt: true },
      });
    }
    return db.alphaSeoRankConfig.create({
      data: { ...input, normalizedDomain: input.domain, nextCheckAt, scheduleAnchorAt: nextCheckAt },
      select: { id: true, domain: true, devices: true, serpDepth: true, scheduleInterval: true, nextCheckAt: true },
    });
  } finally {
    await releaseAlphaSeoMutex(lease);
  }
}

export async function updateRankConfig(input: {
  projectId: string; configId: string; domain?: string; locationCode?: number; locationName?: string | null;
  languageCode?: string; devices?: string; serpDepth?: number; scheduleInterval?: RankSchedule; isActive?: boolean;
}) {
  const current = await getRankConfig(input.projectId, input.configId);
  if (!current) throw new Error("RANK_CONFIG_NOT_FOUND");
  const lease = await acquireAlphaSeoMutex({ projectId: input.projectId, operation: "RANK_CONFIG_MUTEX", key: input.projectId });
  if (!lease) throw new Error("RANK_CONFIG_LEASE_CONFLICT");
  try {
    if (!current.isActive && input.isActive === true) {
      const activeCount = await db.alphaSeoRankConfig.count({ where: { projectId: input.projectId, isActive: true } });
      if (activeCount >= MAX_CONFIGS) throw new Error("RANK_CONFIG_LIMIT_REACHED");
    }
    const targetDomain = input.domain ?? current.normalizedDomain;
    const targetLocationCode = input.locationCode ?? current.locationCode;
    const targetLocationName = input.locationName !== undefined ? input.locationName : current.locationName;
    const duplicate = await db.alphaSeoRankConfig.findFirst({ where: { projectId: input.projectId, id: { not: input.configId }, normalizedDomain: targetDomain, locationCode: targetLocationCode, locationName: targetLocationName, isActive: true }, select: { id: true } });
    if (duplicate) throw new Error("RANK_CONFIG_ALREADY_EXISTS");
    let nextCheckAt = current.nextCheckAt;
    let scheduleAnchorAt = current.scheduleAnchorAt;
    if (input.scheduleInterval) {
      nextCheckAt = input.scheduleInterval === "MANUAL" ? null : computeNextRankCheckAt(input.scheduleInterval);
      scheduleAnchorAt = nextCheckAt;
    }
    const data: Prisma.AlphaSeoRankConfigUpdateInput = {
      ...(input.domain ? { domain: input.domain, normalizedDomain: input.domain } : {}),
      ...(input.locationCode ? { locationCode: input.locationCode } : {}),
      ...(input.locationName !== undefined ? { locationName: input.locationName } : {}),
      ...(input.languageCode ? { languageCode: input.languageCode } : {}),
      ...(input.devices ? { devices: input.devices } : {}),
      ...(input.serpDepth ? { serpDepth: input.serpDepth } : {}),
      ...(input.scheduleInterval ? { scheduleInterval: input.scheduleInterval, nextCheckAt, scheduleAnchorAt } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    return db.alphaSeoRankConfig.update({ where: { id: input.configId }, data, select: { id: true, updatedAt: true } });
  } finally {
    await releaseAlphaSeoMutex(lease);
  }
}

export { listRankConfigs };

export async function addRankKeywords(input: { projectId: string; configId: string; keywords: string[] }) {
  const config = await getRankConfig(input.projectId, input.configId);
  if (!config) throw new Error("RANK_CONFIG_NOT_FOUND");
  const lease = await acquireAlphaSeoMutex({ projectId: input.projectId, operation: "RANK_KEYWORD_MUTEX", key: input.configId });
  if (!lease) throw new Error("RANK_KEYWORD_LEASE_CONFLICT");
  try {
    const existing = await db.alphaSeoRankKeyword.findMany({ where: { configId: input.configId }, select: { normalizedKeyword: true } });
    if (existing.length >= MAX_KEYWORDS) throw new Error("RANK_KEYWORD_LIMIT_REACHED");
    const seen = new Set(existing.map((row) => row.normalizedKeyword));
    const rows: Array<{ configId: string; keyword: string; normalizedKeyword: string }> = [];
    for (const raw of input.keywords) {
      if (rows.length + existing.length >= MAX_KEYWORDS) break;
      const normalizedKeyword = normalizeRankKeyword(raw);
      if (!normalizedKeyword || seen.has(normalizedKeyword)) continue;
      seen.add(normalizedKeyword);
      rows.push({ configId: input.configId, keyword: raw.trim().replace(/\s+/g, " "), normalizedKeyword });
    }
    if (rows.length > 0) await Promise.all(rows.map((row) => db.alphaSeoRankKeyword.upsert({ where: { configId_normalizedKeyword: { configId: row.configId, normalizedKeyword: row.normalizedKeyword } }, update: {}, create: row })));
    const added = await db.alphaSeoRankKeyword.findMany({ where: { configId: input.configId, normalizedKeyword: { in: rows.map((row) => row.normalizedKeyword) } }, select: { id: true, keyword: true } });
    return { added: added.length, addedIds: added.map((row) => row.id) };
  } finally {
    await releaseAlphaSeoMutex(lease);
  }
}

export async function removeRankKeywords(input: { projectId: string; configId: string; keywordIds: string[] }) {
  const config = await getRankConfig(input.projectId, input.configId);
  if (!config) throw new Error("RANK_CONFIG_NOT_FOUND");
  const rows = await db.alphaSeoRankKeyword.findMany({ where: { configId: input.configId, id: { in: [...new Set(input.keywordIds)] } }, select: { id: true } });
  await Promise.all(rows.map((row) => db.alphaSeoRankKeyword.delete({ where: { id: row.id } })));
  return { removed: rows.length };
}

export async function estimateRankRun(input: { projectId: string; configId: string; keywordIds?: string[]; queued?: boolean }) {
  const config = await getRankConfig(input.projectId, input.configId);
  if (!config) throw new Error("RANK_CONFIG_NOT_FOUND");
  const keywordCount = await db.alphaSeoRankKeyword.count({ where: { configId: input.configId, ...(input.keywordIds ? { id: { in: input.keywordIds } } : {}) } });
  const estimate = estimateRankCost({ keywordCount, devices: config.devices as "DESKTOP" | "MOBILE" | "BOTH", serpDepth: config.serpDepth, queued: input.queued });
  return { ...estimate, keywordCount, requestHash: rankRequestHash({ configId: input.configId, keywordIds: [...(input.keywordIds ?? [])].sort(), devices: config.devices, serpDepth: config.serpDepth, queued: !!input.queued }) };
}

export async function approveRankRunCost(input: { projectId: string; configId: string; userId: number; keywordIds?: string[]; requestHash: string }) {
  const estimate = await estimateRankRun({ projectId: input.projectId, configId: input.configId, keywordIds: input.keywordIds });
  if (estimate.requestHash !== input.requestHash) throw new Error("RANK_COST_ESTIMATE_CHANGED");
  return db.alphaSeoCostApproval.upsert({
    where: { projectId_userId_operation_requestHash: { projectId: input.projectId, userId: input.userId, operation: "RANK_RUN", requestHash: input.requestHash } },
    update: { estimatedUnits: estimate.estimatedUnits, estimatedMicrosUsd: estimate.estimatedMicrosUsd, approvedAt: new Date(), expiresAt: new Date(Date.now() + 15 * 60_000) },
    create: { projectId: input.projectId, userId: input.userId, operation: "RANK_RUN", requestHash: input.requestHash, estimatedUnits: estimate.estimatedUnits, estimatedMicrosUsd: estimate.estimatedMicrosUsd, expiresAt: new Date(Date.now() + 15 * 60_000) },
    select: { requestHash: true, expiresAt: true },
  });
}

export async function triggerRankRun(input: { projectId: string; configId: string; userId?: number; keywordIds?: string[]; approvalRequestHash?: string; trigger?: "MANUAL" | "SCHEDULED"; scheduledFor?: Date }) {
  const claimed = await claimConfigMutex(input.projectId, input.configId);
  if (!claimed.ok) return { ok: false as const, reason: claimed.reason, blockingRunId: null };
  try {
    await recoverStaleActiveRuns(input.configId);
    const active = await getActiveRankRun(input.configId);
    if (active) return { ok: false as const, reason: "ALREADY_RUNNING" as const, blockingRunId: active.id };
    const allKeywords = await db.alphaSeoRankKeyword.findMany({ where: { configId: input.configId }, select: { id: true } });
    const allowedIds = new Set(allKeywords.map((row) => row.id));
    const keywordIds = input.keywordIds ? [...new Set(input.keywordIds)].filter((id) => allowedIds.has(id)) : undefined;
    if (input.keywordIds && keywordIds?.length !== new Set(input.keywordIds).size) throw new Error("RANK_KEYWORD_NOT_FOUND");
    const count = keywordIds?.length ?? allKeywords.length;
    if (count === 0) throw new Error("RANK_KEYWORDS_EMPTY");
    const estimate = await estimateRankRun({ projectId: input.projectId, configId: input.configId, keywordIds, queued: input.trigger === "SCHEDULED" });
    if (input.trigger !== "SCHEDULED") {
      if (!input.userId || input.approvalRequestHash !== estimate.requestHash) throw new Error("RANK_COST_APPROVAL_REQUIRED");
      const approval = await db.alphaSeoCostApproval.findFirst({ where: { projectId: input.projectId, userId: input.userId, operation: "RANK_RUN", requestHash: estimate.requestHash, expiresAt: { gt: new Date() } }, select: { id: true, estimatedUnits: true, estimatedMicrosUsd: true } });
      if (!approval || approval.estimatedUnits < estimate.estimatedUnits || approval.estimatedMicrosUsd < estimate.estimatedMicrosUsd) throw new Error("RANK_COST_APPROVAL_REQUIRED");
    }
    const runId = randomUUID();
    const idempotencyKey = input.trigger === "SCHEDULED" ? `rank:${input.configId}:${input.scheduledFor?.toISOString() ?? claimed.config.nextCheckAt?.toISOString() ?? runId}` : `rank:${runId}`;
    const run = await db.alphaSeoRankRun.create({
      data: { id: runId, configId: input.configId, requestedById: input.userId, trigger: input.trigger ?? "MANUAL", scheduledFor: input.scheduledFor, idempotencyKey, keywordsTotal: count, isSubsetRun: !!keywordIds, estimatedUnits: estimate.estimatedUnits, estimatedMicrosUsd: estimate.estimatedMicrosUsd },
      select: { id: true },
    });
    await enqueueAlphaSeoJob({ projectId: input.projectId, type: "RANK_RUN", idempotencyKey: `job:${idempotencyKey}`, payload: { runId: run.id, keywordIds: keywordIds ?? null } });
    return { ok: true as const, runId: run.id };
  } finally {
    await releaseAlphaSeoMutex(claimed.lease);
  }
}

export async function refreshRankKeywordMetrics(input: { projectId: string; configId: string; access: AlphaSeoProviderOperationAccess }) {
  const plan = await buildRankKeywordMetricsPlan(input.projectId, input.configId);
  if (plan.units === 0) return { updated: 0, actualMicrosUsd: 0 };
  await assertAlphaSeoProviderCostApproved(input.access, "RANK_KEYWORD_METRICS", plan.request, plan.units);
  const metrics: RankKeywordSuggestion[] = [];
  let actualMicrosUsd = 0;
  for (const batch of plan.batches) {
    const response = await executeAlphaSeoDataForSeo({
      access: input.access,
      operation: "RANK_KEYWORD_METRICS",
      path: "dataforseo_labs/google/keyword_overview/live",
      payload: batch,
      units: batch.keywords.length,
      cacheTtlSeconds: 86_400,
      approval: { operation: "RANK_KEYWORD_METRICS", request: plan.request, units: plan.units },
      parse: mapRankKeywordSuggestions,
    });
    metrics.push(...response.data);
    actualMicrosUsd += Math.round(response.costUsd * 1_000_000);
  }
  const byKeyword = new Map(metrics.map((metric) => [normalizeRankKeyword(metric.keyword), metric]));
  let updated = 0;
  for (const keyword of plan.keywords) {
    const metric = byKeyword.get(normalizeRankKeyword(keyword.keyword));
    if (!metric) continue;
    await db.alphaSeoRankKeyword.update({ where: { id: keyword.id }, data: { searchVolume: metric.searchVolume, keywordDifficulty: metric.keywordDifficulty, cpcMicros: metric.cpcMicros, metricsFetchedAt: new Date() } });
    updated += 1;
  }
  return { updated, actualMicrosUsd };
}

export async function estimateRankKeywordMetricsCost(input: { projectId: string; configId: string; access: AlphaSeoProviderOperationAccess }) {
  const plan = await buildRankKeywordMetricsPlan(input.projectId, input.configId);
  return estimateAlphaSeoProviderRequest(input.access, "RANK_KEYWORD_METRICS", plan.request, plan.units);
}

export async function approveRankKeywordMetricsCost(input: { projectId: string; configId: string; requestHash: string; access: AlphaSeoProviderOperationAccess }) {
  const plan = await buildRankKeywordMetricsPlan(input.projectId, input.configId);
  const estimate = estimateAlphaSeoProviderRequest(input.access, "RANK_KEYWORD_METRICS", plan.request, plan.units);
  if (estimate.requestHash !== input.requestHash) throw new Error("RANK_METRICS_COST_ESTIMATE_CHANGED");
  return approveAlphaSeoProviderCost(input.access, "RANK_KEYWORD_METRICS", plan.request, plan.units);
}

export async function suggestRankKeywords(input: { projectId: string; configId: string; seed: string; limit: number; access: AlphaSeoProviderOperationAccess }) {
  const config = await getRankConfig(input.projectId, input.configId);
  if (!config) throw new Error("RANK_CONFIG_NOT_FOUND");
  const payload = { keyword: input.seed, location_code: config.locationCode, language_code: config.languageCode, include_seed_keyword: true, limit: input.limit };
  const response = await executeAlphaSeoDataForSeo({
    access: input.access,
    operation: "RANK_SUGGESTIONS",
    path: "dataforseo_labs/google/keyword_suggestions/live",
    payload,
    units: 1,
    cacheTtlSeconds: 86_400,
    parse: mapRankKeywordSuggestions,
  });
  return response.data;
}

async function buildRankKeywordMetricsPlan(projectId: string, configId: string) {
  const config = await getRankConfig(projectId, configId);
  if (!config) throw new Error("RANK_CONFIG_NOT_FOUND");
  const keywords = await db.alphaSeoRankKeyword.findMany({ where: { configId }, orderBy: { id: "asc" }, take: MAX_KEYWORDS, select: { id: true, keyword: true } });
  const batches: Array<{ keywords: string[]; location_code: number; language_code: string; include_clickstream_data: false }> = [];
  for (let offset = 0; offset < keywords.length; offset += 700) {
    batches.push({ keywords: keywords.slice(offset, offset + 700).map((row) => row.keyword), location_code: config.locationCode, language_code: config.languageCode, include_clickstream_data: false });
  }
  return { keywords, batches, units: keywords.length, request: { configId, keywordIds: keywords.map((row) => row.id) } };
}

export async function processRankRun(
  runId: string,
  workerId: string,
  provider: RankProvider = new DataForSeoRankProvider(),
  requestedKeywordIds?: string[],
  heartbeatJob?: () => Promise<void>,
  queuedState?: RankQueuedState,
  checkpointQueuedState?: (state: RankQueuedState) => Promise<void>,
) {
  const run = await db.alphaSeoRankRun.findUnique({ where: { id: runId }, select: { id: true, configId: true, status: true, trigger: true, leaseToken: true, keywordsTotal: true } });
  if (!run) throw new Error("RANK_RUN_NOT_FOUND");
  if (!["PENDING", "RUNNING"].includes(run.status)) {
    if (["COMPLETED", "CANCELLED"].includes(run.status)) {
      return { skipped: true, terminal: true, reason: `RANK_RUN_${run.status}` };
    }
    throw new Error("RANK_RUN_TERMINAL_FAILED");
  }
  const token = run.leaseToken + 1;
  const now = new Date();
  const lease = await db.alphaSeoRankRun.updateMany({ where: { id: runId, leaseToken: run.leaseToken, OR: [{ status: "PENDING" }, { status: "RUNNING", leaseOwner: workerId }, { status: "RUNNING", leaseExpiresAt: { lt: now } }] }, data: { status: "RUNNING", leaseOwner: workerId, leaseToken: token, leaseExpiresAt: new Date(Date.now() + 300_000), heartbeatAt: now } });
  if (lease.count !== 1) {
    return { skipped: true, retryable: true, delayMs: 30_000, reason: "RANK_RUN_LEASE_BUSY" };
  }
  const current = await db.alphaSeoRankRun.findUnique({ where: { id: runId }, select: { id: true, configId: true, isSubsetRun: true } });
  if (!current) throw new Error("RANK_RUN_NOT_FOUND");
  const requestedIds = requestedKeywordIds?.filter((id) => typeof id === "string");
  const [config, keywords] = await Promise.all([
    db.alphaSeoRankConfig.findUnique({ where: { id: current.configId }, select: { id: true, projectId: true, domain: true, locationCode: true, locationName: true, languageCode: true, devices: true, serpDepth: true } }),
    db.alphaSeoRankKeyword.findMany({ where: { configId: current.configId, ...(requestedIds ? { id: { in: requestedIds } } : {}) }, orderBy: { createdAt: "asc" }, select: { id: true, keyword: true } }),
  ]);
  if (!config || keywords.length === 0) throw new Error("RANK_RUN_CONTEXT_INVALID");
  const tasks = keywords.flatMap((keyword) => rankDevicesList(config.devices as "DESKTOP" | "MOBILE" | "BOTH").map((device) => ({ keywordId: keyword.id, keyword: keyword.keyword, device })));
  let checkedKeywords = await countCheckedKeywords(runId);
  let partialError: string | null = null;
  let actualUnits = 0;
  let actualMicrosUsd = 0;
  let queueSummary: ReturnType<typeof rankQueueAuditSummary> | null = null;
  if (run.trigger === "SCHEDULED") {
    const state = queuedState ?? newRankQueuedState();
    let postedThisInvocation = false;
    while (state.postOffset < tasks.length) {
      const batch = tasks.slice(state.postOffset, state.postOffset + 100);
      const posted = await provider.postQueued({ tasks: batch, domain: config.domain, locationCode: config.locationCode, locationName: config.locationName, languageCode: config.languageCode, depth: config.serpDepth });
      state.pending.push(...posted.accepted);
      state.fallback.push(...posted.rejected);
      state.postOffset += batch.length;
      state.queueTasks += posted.accepted.length;
      state.actualUnits += posted.accepted.length;
      state.actualMicrosUsd += posted.actualMicrosUsd;
      postedThisInvocation = true;
      await checkpointQueuedState?.(state);
      await rankHeartbeat(runId, workerId, token, checkedKeywords);
      await heartbeatJob?.();
    }
    if (state.pending.length > 0 && postedThisInvocation) {
      await releaseRankLease(runId, workerId, token);
      return { skipped: false, deferred: true, delayMs: 4 * 60_000, checkedKeywords, queue: rankQueueAuditSummary(state) };
    }
    if (state.pending.length > 0 && state.pollRound < 6) {
      const batch = state.pending.slice(0, 500);
      const overflow = state.pending.slice(500);
      const collected = await provider.collectQueued({ tasks: batch, domain: config.domain });
      await persistRankSnapshots(runId, collected.completed);
      state.queueCollected += collected.completed.length;
      state.fallback.push(...collected.failed);
      state.pending = [...collected.pending, ...overflow];
      state.pollRound += 1;
      checkedKeywords = await countCheckedKeywords(runId);
      await checkpointQueuedState?.(state);
      await rankHeartbeat(runId, workerId, token, checkedKeywords);
      await heartbeatJob?.();
      if (state.pending.length > 0 && state.pollRound < 6) {
        await releaseRankLease(runId, workerId, token);
        return { skipped: false, deferred: true, delayMs: state.pollRound === 5 ? 3 * 60_000 : 2 * 60_000, checkedKeywords, queue: rankQueueAuditSummary(state) };
      }
    }
    if (state.pending.length > 0) {
      state.fallback.push(...state.pending.map((task) => ({ keywordId: task.keywordId, keyword: task.keyword, device: task.device })));
      state.pending = [];
    }
    state.fallbackTasks = state.fallback.length;
    while (state.fallback.length > 0) {
      const batch = state.fallback.slice(0, 10);
      const response = await provider.check({ tasks: batch, domain: config.domain, locationCode: config.locationCode, locationName: config.locationName, languageCode: config.languageCode, depth: config.serpDepth });
      await persistRankSnapshots(runId, response.results);
      state.fallbackChecked += response.results.length;
      state.actualUnits += batch.length;
      state.actualMicrosUsd += response.actualMicrosUsd;
      state.fallback = state.fallback.slice(batch.length);
      checkedKeywords = await countCheckedKeywords(runId);
      await checkpointQueuedState?.(state);
      await rankHeartbeat(runId, workerId, token, checkedKeywords);
      await heartbeatJob?.();
    }
    actualUnits = state.actualUnits;
    actualMicrosUsd = state.actualMicrosUsd;
    queueSummary = rankQueueAuditSummary(state);
  } else {
    for (let offset = 0; offset < tasks.length; offset += 10) {
      const batch = tasks.slice(offset, offset + 10);
      try {
        const response = await provider.check({ tasks: batch, domain: config.domain, locationCode: config.locationCode, locationName: config.locationName, languageCode: config.languageCode, depth: config.serpDepth });
        await persistRankSnapshots(runId, response.results);
        actualUnits += batch.length;
        actualMicrosUsd += response.actualMicrosUsd;
        checkedKeywords = await countCheckedKeywords(runId);
        await rankHeartbeat(runId, workerId, token, checkedKeywords);
        await heartbeatJob?.();
      } catch (error) {
        partialError = error instanceof Error ? error.message : "Falha em lote";
        break;
      }
    }
  }
  const retryError = rankRunRetryError(checkedKeywords, partialError);
  if (retryError) {
    const released = await db.alphaSeoRankRun.updateMany({
      where: { id: runId, status: "RUNNING", leaseOwner: workerId, leaseToken: token },
      data: {
        status: "PENDING",
        errorCode: "PROVIDER_RETRY_REQUIRED",
        errorMessage: retryError,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: new Date(),
      },
    });
    if (released.count !== 1) throw new Error("RANK_RUN_FENCE_LOST");
    throw new Error(retryError);
  }
  const finalized = await db.alphaSeoRankRun.updateMany({
    where: { id: runId, status: "RUNNING", leaseOwner: workerId, leaseToken: token },
    data: { status: "COMPLETED", keywordsChecked: checkedKeywords, actualUnits, actualMicrosUsd, errorCode: partialError ? "PARTIAL_PROVIDER_FAILURE" : null, errorMessage: partialError, completedAt: new Date(), leaseExpiresAt: null },
  });
  if (finalized.count !== 1) throw new Error("RANK_RUN_FENCE_LOST");
  await db.alphaSeoRankConfig.update({ where: { id: config.id }, data: { lastCheckedAt: new Date(), lastSkipReason: partialError ? "partial_provider_failure" : null } });
  return { skipped: false, deferred: false, checkedKeywords, partialError, queue: queueSummary };
}

async function persistRankSnapshots(runId: string, results: Awaited<ReturnType<RankProvider["check"]>>["results"]) {
  await Promise.all(results.map((result) => db.alphaSeoRankSnapshot.upsert({
    where: { runId_trackingKeywordId_device: { runId, trackingKeywordId: result.keywordId, device: result.device } },
    update: {},
    create: { runId, trackingKeywordId: result.keywordId, keyword: result.keyword, device: result.device, position: result.position, rankedUrl: result.rankedUrl, serpFeatures: toPrismaJson(result.serpFeatures) },
  })));
}

async function countCheckedKeywords(runId: string) {
  return db.alphaSeoRankSnapshot.findMany({ where: { runId }, distinct: ["trackingKeywordId"], select: { trackingKeywordId: true } }).then((rows) => rows.length);
}

async function rankHeartbeat(runId: string, workerId: string, token: number, checkedKeywords: number) {
  const heart = await db.alphaSeoRankRun.updateMany({ where: { id: runId, status: "RUNNING", leaseOwner: workerId, leaseToken: token }, data: { keywordsChecked: checkedKeywords, heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + 300_000) } });
  if (heart.count !== 1) throw new Error("RANK_RUN_FENCE_LOST");
}

async function releaseRankLease(runId: string, workerId: string, token: number) {
  const released = await db.alphaSeoRankRun.updateMany({ where: { id: runId, status: "RUNNING", leaseOwner: workerId, leaseToken: token }, data: { leaseExpiresAt: new Date(), heartbeatAt: new Date() } });
  if (released.count !== 1) throw new Error("RANK_RUN_FENCE_LOST");
}

export async function enqueueDueRankRuns(now = new Date()) {
  const claims = await scheduleDueRankConfigs(now);
  const results: Array<{ configId: string; status: string; runId?: string }> = [];
  for (const claim of claims) {
    if (claim.status !== "claimed") { results.push({ configId: claim.configId, status: claim.status }); continue; }
    try {
      const triggered = await triggerRankRun({ projectId: claim.projectId, configId: claim.configId, trigger: "SCHEDULED", scheduledFor: claim.scheduledFor });
      if (triggered.ok) results.push({ configId: claim.configId, status: "started", runId: triggered.runId });
      else {
        if (triggered.reason === "ALREADY_RUNNING" && claim.scheduledFor && claim.advancedTo) {
          await db.alphaSeoRankConfig.updateMany({ where: { id: claim.configId, projectId: claim.projectId, nextCheckAt: claim.advancedTo }, data: { nextCheckAt: claim.scheduledFor, scheduleAnchorAt: claim.scheduledFor } });
        }
        results.push({ configId: claim.configId, status: triggered.reason.toLowerCase() });
      }
    } catch (error) {
      results.push({ configId: claim.configId, status: error instanceof Error ? error.message : "schedule_failed" });
    }
  }
  return results;
}
