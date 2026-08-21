import "server-only";

import db from "@/lib/prisma";
import { computeNextRankCheckAt, type RankDevice, type RankSchedule } from "./contracts";
import { acquireAlphaSeoMutex } from "@/lib/alpha-seo/jobs/mutex";

const ACTIVE_RUNS = ["PENDING", "RUNNING"];

export async function getRankConfig(projectId: string, configId: string) {
  return db.alphaSeoRankConfig.findFirst({
    where: { id: configId, projectId },
    select: {
      id: true, projectId: true, domain: true, normalizedDomain: true,
      locationCode: true, locationName: true, languageCode: true, devices: true,
      serpDepth: true, scheduleInterval: true, scheduleAnchorAt: true,
      isActive: true, lastCheckedAt: true, nextCheckAt: true, lastSkipReason: true,
      createdAt: true, updatedAt: true,
    },
  });
}

export async function listRankConfigs(projectId: string) {
  return db.alphaSeoRankConfig.findMany({
    where: { projectId },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true, domain: true, locationCode: true, locationName: true, languageCode: true,
      devices: true, serpDepth: true, scheduleInterval: true, isActive: true,
      lastCheckedAt: true, nextCheckAt: true, lastSkipReason: true, createdAt: true,
      _count: { select: { keywords: true, runs: true } },
    },
  });
}

export async function claimConfigMutex(projectId: string, configId: string) {
  const config = await getRankConfig(projectId, configId);
  if (!config || !config.isActive) return { ok: false as const, reason: "NOT_FOUND" as const };
  const lease = await acquireAlphaSeoMutex({ projectId, operation: "RANK_RUN_MUTEX", key: configId });
  return lease ? { ok: true as const, config, lease } : { ok: false as const, reason: "LEASE_CONFLICT" as const };
}

export async function recoverStaleActiveRuns(configId: string, now = new Date()) {
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  return db.alphaSeoRankRun.updateMany({
    where: {
      configId,
      status: { in: ACTIVE_RUNS },
      OR: [{ leaseExpiresAt: { lt: now } }, { leaseExpiresAt: null, heartbeatAt: { lt: staleBefore } }, { leaseExpiresAt: null, heartbeatAt: null, startedAt: { lt: staleBefore } }],
    },
    data: { status: "FAILED", errorCode: "STALE_LEASE", errorMessage: "Execucao recuperada apos lease expirado", completedAt: now },
  });
}

export async function getActiveRankRun(configId: string) {
  return db.alphaSeoRankRun.findFirst({
    where: { configId, status: { in: ACTIVE_RUNS } },
    orderBy: { startedAt: "desc" },
    select: { id: true, status: true, leaseExpiresAt: true, heartbeatAt: true, startedAt: true },
  });
}

export async function getRankResults(projectId: string, configId: string, limit = 2_000, compareDays = 7) {
  const config = await getRankConfig(projectId, configId);
  if (!config) return null;
  const [keywords, latestRun] = await Promise.all([
    db.alphaSeoRankKeyword.findMany({
      where: { configId }, orderBy: { keyword: "asc" }, take: limit,
      select: { id: true, keyword: true, searchVolume: true, keywordDifficulty: true, cpcMicros: true, metricsFetchedAt: true },
    }),
    db.alphaSeoRankRun.findFirst({
      where: { configId }, orderBy: { startedAt: "desc" },
      select: { id: true, status: true, keywordsTotal: true, keywordsChecked: true, errorCode: true, errorMessage: true, startedAt: true, completedAt: true },
    }),
  ]);
  const keywordIds = keywords.map((keyword) => keyword.id);
  const snapshots = keywordIds.length === 0 ? [] : await db.alphaSeoRankSnapshot.findMany({
    where: { trackingKeywordId: { in: keywordIds } },
    orderBy: { checkedAt: "desc" },
    take: Math.min(4_000, keywordIds.length * 4),
    select: { trackingKeywordId: true, device: true, position: true, rankedUrl: true, serpFeatures: true, checkedAt: true },
  });
  const comparison = keywordIds.length === 0 ? [] : await db.alphaSeoRankSnapshot.findMany({
    where: { trackingKeywordId: { in: keywordIds }, checkedAt: { lte: new Date(Date.now() - compareDays * 86_400_000) } },
    orderBy: { checkedAt: "desc" }, take: Math.min(4_000, keywordIds.length * 4),
    select: { trackingKeywordId: true, device: true, position: true, checkedAt: true },
  });
  const earliest = keywordIds.length === 0 ? [] : await db.alphaSeoRankSnapshot.findMany({
    where: { trackingKeywordId: { in: keywordIds } }, orderBy: { checkedAt: "asc" },
    take: Math.min(4_000, keywordIds.length * 4), select: { trackingKeywordId: true, device: true, position: true },
  });
  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.trackingKeywordId}:${snapshot.device}`;
    if (!latest.has(key)) latest.set(key, snapshot);
  }
  const previous = new Map<string, number | null>();
  for (const snapshot of comparison) {
    const key = `${snapshot.trackingKeywordId}:${snapshot.device}`;
    if (!previous.has(key)) previous.set(key, snapshot.position);
  }
  for (const snapshot of earliest) {
    const key = `${snapshot.trackingKeywordId}:${snapshot.device}`;
    if (!previous.has(key)) previous.set(key, snapshot.position);
  }
  return {
    config, latestRun,
    rows: keywords.map((keyword) => ({
      ...keyword,
      desktop: deviceResult(latest.get(`${keyword.id}:DESKTOP`) ?? null, previous.get(`${keyword.id}:DESKTOP`) ?? null),
      mobile: deviceResult(latest.get(`${keyword.id}:MOBILE`) ?? null, previous.get(`${keyword.id}:MOBILE`) ?? null),
    })),
  };
}

function deviceResult(snapshot: { position: number | null; rankedUrl: string | null; serpFeatures: unknown; checkedAt: Date } | null, previousPosition: number | null) {
  return snapshot ? { ...snapshot, previousPosition } : { position: null, rankedUrl: null, serpFeatures: null, checkedAt: null, previousPosition };
}

export async function getRankKeywordHistory(input: { projectId: string; configId: string; keywordId: string; device?: RankDevice; sinceDays: number; limit: number }) {
  const config = await getRankConfig(input.projectId, input.configId);
  if (!config) return null;
  const keyword = await db.alphaSeoRankKeyword.findFirst({ where: { id: input.keywordId, configId: input.configId }, select: { id: true, keyword: true } });
  if (!keyword) return null;
  const since = new Date(Date.now() - input.sinceDays * 86_400_000);
  const points = await db.alphaSeoRankSnapshot.findMany({
    where: { trackingKeywordId: input.keywordId, checkedAt: { gte: since }, ...(input.device ? { device: input.device } : {}) },
    orderBy: { checkedAt: "asc" }, take: input.limit,
    select: { runId: true, device: true, position: true, rankedUrl: true, serpFeatures: true, checkedAt: true },
  });
  return { keyword, points };
}

export async function getRankTrend(input: { projectId: string; configId: string; device: RankDevice; sinceDays: number; runLimit: number }) {
  const config = await getRankConfig(input.projectId, input.configId);
  if (!config) return null;
  const runs = await db.alphaSeoRankRun.findMany({
    where: { configId: input.configId, status: "COMPLETED", startedAt: { gte: new Date(Date.now() - input.sinceDays * 86_400_000) } },
    orderBy: { startedAt: "desc" }, take: input.runLimit,
    select: { id: true, startedAt: true, snapshots: { where: { device: input.device }, select: { position: true } } },
  });
  return runs.reverse().map((run) => {
    const positions = run.snapshots.map((snapshot) => snapshot.position);
    return {
      runId: run.id, checkedAt: run.startedAt,
      top3: positions.filter((position) => position !== null && position <= 3).length,
      top4to10: positions.filter((position) => position !== null && position >= 4 && position <= 10).length,
      top11to20: positions.filter((position) => position !== null && position >= 11 && position <= 20).length,
      notRanking: positions.filter((position) => position === null || position > 20).length,
    };
  });
}

export async function scheduleDueRankConfigs(now = new Date(), limit = 100) {
  const due = await db.alphaSeoRankConfig.findMany({
    where: { isActive: true, scheduleInterval: { not: "MANUAL" }, nextCheckAt: { lte: now } },
    orderBy: { nextCheckAt: "asc" }, take: limit,
    select: { id: true, projectId: true, devices: true, nextCheckAt: true, scheduleInterval: true, updatedAt: true, _count: { select: { keywords: true } } },
  });
  const results: Array<{ configId: string; projectId: string; status: string; scheduledFor?: Date; advancedTo?: Date }> = [];
  let admittedUnits = 0;
  let admittedConfigs = 0;
  for (const config of due) {
    const schedule = config.scheduleInterval as Exclude<RankSchedule, "MANUAL">;
    const observed = config.nextCheckAt;
    if (!observed) continue;
    const taskUnits = config._count.keywords * (config.devices === "BOTH" ? 2 : 1);
    if (admittedConfigs > 0 && admittedUnits + taskUnits > 1_000) {
      results.push({ configId: config.id, projectId: config.projectId, status: "budget_deferred" });
      break;
    }
    const nextCheckAt = computeNextRankCheckAt(schedule, observed, now);
    const skipReason = config._count.keywords === 0 ? "no_keywords" : null;
    const claimed = await db.alphaSeoRankConfig.updateMany({
      where: { id: config.id, projectId: config.projectId, nextCheckAt: observed, updatedAt: config.updatedAt },
      data: { nextCheckAt, scheduleAnchorAt: nextCheckAt, lastSkipReason: skipReason },
    });
    if (claimed.count !== 1) { results.push({ configId: config.id, projectId: config.projectId, status: "concurrent_change" }); continue; }
    if (skipReason) { results.push({ configId: config.id, projectId: config.projectId, status: skipReason }); continue; }
    admittedUnits += taskUnits;
    admittedConfigs += 1;
    results.push({ configId: config.id, projectId: config.projectId, status: "claimed", scheduledFor: observed, advancedTo: nextCheckAt });
  }
  return results;
}
