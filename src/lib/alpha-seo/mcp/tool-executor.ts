import "server-only";

import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { executeAlphaSeoDataForSeo, approveAlphaSeoProviderCost, estimateAlphaSeoProviderCost } from "@/lib/alpha-seo/dataforseo/operations";
import { normalizeSeoTarget } from "@/lib/alpha-seo/dataforseo/target";
import { mapDataForSeoKeywordItems, mapSerpItems, normalizeKeyword } from "@/lib/alpha-seo/keywords/mappers";
import { normalizeAlphaSeoDomain } from "@/lib/alpha-seo/projects/normalize";
import { applyProjectMemoryUpdates, getProjectMemory, type MemoryUpdate } from "@/lib/alpha-seo/project-memory/service";
import {
  addRankKeywords,
  approveRankRunCost,
  createRankConfig,
  estimateRankRun,
  removeRankKeywords,
  triggerRankRun,
} from "@/lib/alpha-seo/rank-tracking/service";
import { getRankResults, listRankConfigs } from "@/lib/alpha-seo/rank-tracking/repository";
import { normalizeRankDomain } from "@/lib/alpha-seo/rank-tracking/contracts";
import { getSiteAuditResults, getSiteAuditStatus, startSiteAudit } from "@/lib/alpha-seo/audit/service";
import { getGoogleAccessToken } from "@/lib/alpha-seo/google/oauth";
import { inspectGscUrl, queryGsc, searchTotals, strikingDistance } from "@/lib/alpha-seo/google/gsc";
import { runGa4Report, type GA4_REPORTS } from "@/lib/alpha-seo/google/ga4";
import { alphaSeoCacheKey, alphaSeoIdempotencyKey } from "@/lib/alpha-seo/operation-policy";
import { acquireAlphaSeoMutex, releaseAlphaSeoMutex } from "@/lib/alpha-seo/jobs/mutex";
import { authorizeMcpProject } from "./auth";
import type { AlphaSeoMcpIdentity, AlphaSeoMcpProjectContext } from "./types";
import type { AlphaSeoMcpToolName } from "./registry";

type Args = Record<string, unknown>;

function stringArg(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== "string") throw new Error(`INVALID_INPUT:${key}`);
  return value;
}
function optionalString(args: Args, key: string): string | undefined {
  return typeof args[key] === "string" ? args[key] : undefined;
}
function numberArg(args: Args, key: string, fallback?: number): number {
  const value = args[key] ?? fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`INVALID_INPUT:${key}`);
  return value;
}
function stringList(args: Args, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`INVALID_INPUT:${key}`);
  return value;
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function itemsFromResults(results: unknown[]): unknown[] {
  const first = record(results[0]);
  return Array.isArray(first.items) ? first.items : results;
}

function providerAccess(context: AlphaSeoMcpProjectContext) {
  return {
    userId: context.userId,
    email: context.email,
    globalRole: "MCP",
    isAdmin: false,
    projectId: context.projectId,
    projectRole: context.projectRole,
    role: context.projectRole,
    projectStatus: "ACTIVE",
  };
}

async function projectContext(args: Args, identity: AlphaSeoMcpIdentity, role: "OWNER" | "EDITOR" | "VIEWER" = "VIEWER") {
  return authorizeMcpProject(identity, stringArg(args, "projectId"), role);
}

async function approveProviderIfPresented(
  context: AlphaSeoMcpProjectContext,
  operation: string,
  payload: Record<string, unknown>,
  units: number,
  approvedMicros: unknown,
) {
  const estimate = estimateAlphaSeoProviderCost(operation, units);
  if (!estimate.approvalRequired) return estimate;
  if (typeof approvedMicros !== "number" || approvedMicros < estimate.estimatedMicrosUsd) {
    throw new Error("COST_APPROVAL_REQUIRED");
  }
  await approveAlphaSeoProviderCost(providerAccess(context), operation, payload, units);
  return estimate;
}

async function provider<T>(input: {
  context: AlphaSeoMcpProjectContext;
  operation: string;
  path: string;
  payload: Record<string, unknown>;
  units?: number;
  approvedMicros?: unknown;
  parse: (results: unknown[]) => T;
}) {
  const units = input.units ?? 1;
  await approveProviderIfPresented(input.context, input.operation, input.payload, units, input.approvedMicros);
  return executeAlphaSeoDataForSeo({
    access: providerAccess(input.context),
    operation: input.operation,
    path: input.path,
    payload: input.payload,
    units,
    parse: input.parse,
  });
}

async function whoami(identity: AlphaSeoMcpIdentity) {
  if (identity.fixedProjectId) await authorizeMcpProject(identity, identity.fixedProjectId);
  const projects = await db.alphaSeoProject.count({
    where: identity.fixedProjectId
      ? { id: identity.fixedProjectId, status: "ACTIVE", OR: [{ ownerId: identity.userId }, { members: { some: { userId: identity.userId, active: true } } }] }
      : { status: "ACTIVE", OR: [{ ownerId: identity.userId }, { members: { some: { userId: identity.userId, active: true } } }] },
  });
  return { userId: identity.userId, email: identity.email, authKind: identity.kind, scopes: identity.scopes, fixedProjectId: identity.fixedProjectId, accessibleProjects: projects, mode: "painel-alpha" };
}

async function listProjects(args: Args, identity: AlphaSeoMcpIdentity) {
  const page = numberArg(args, "page", 1);
  const limit = numberArg(args, "limit", 50);
  const archived = args.archived === true;
  const search = optionalString(args, "search");
  if (identity.fixedProjectId) {
    if (archived) return { rows: [], pagination: { page, limit, total: 0, hasMore: false, nextPage: null } };
    await authorizeMcpProject(identity, identity.fixedProjectId);
  }
  const where: Prisma.AlphaSeoProjectWhereInput = {
    status: archived ? "ARCHIVED" : "ACTIVE",
    ...(identity.fixedProjectId
      ? { id: identity.fixedProjectId, OR: [{ ownerId: identity.userId }, { members: { some: { userId: identity.userId, active: true } } }] }
      : { OR: [{ ownerId: identity.userId }, { members: { some: { userId: identity.userId, active: true } } }] }),
    ...(search ? { name: { contains: search } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.alphaSeoProject.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit, select: { id: true, name: true, domain: true, locationCode: true, locationName: true, languageCode: true, market: true, status: true, createdAt: true, updatedAt: true } }),
    db.alphaSeoProject.count({ where }),
  ]);
  return { rows, pagination: { page, limit, total, hasMore: page * limit < total, nextPage: page * limit < total ? page + 1 : null } };
}

async function createProject(args: Args, identity: AlphaSeoMcpIdentity) {
  if (identity.fixedProjectId) throw new Error("PROJECT_SCOPE_MISMATCH");
  if (!identity.scopes.includes("alpha-seo:write")) throw new Error("WRITE_SCOPE_REQUIRED");
  const normalizedDomain = normalizeAlphaSeoDomain(optionalString(args, "domain"));
  const project = await db.alphaSeoProject.create({
    data: {
      ownerId: identity.userId,
      name: stringArg(args, "name"),
      domain: normalizedDomain,
      normalizedDomain,
      locationCode: numberArg(args, "locationCode", 2840),
      locationName: optionalString(args, "locationName") ?? null,
      languageCode: optionalString(args, "languageCode") ?? "pt",
      market: optionalString(args, "market") ?? "BR",
      members: { create: { userId: identity.userId, role: "OWNER", active: true } },
      activation: { create: {} },
    },
    select: { id: true, name: true, domain: true, locationCode: true, languageCode: true, market: true, createdAt: true },
  });
  await db.alphaSeoAuditEvent.create({ data: { projectId: project.id, userId: identity.userId, action: "PROJECT_CREATED_MCP", entityType: "PROJECT", entityId: project.id, requestId: crypto.randomUUID() } });
  return project;
}

async function getContext(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity);
  return { project: context.project, memory: await getProjectMemory(context.projectId) };
}

async function updateContext(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  return applyProjectMemoryUpdates({ projectId: context.projectId, userId: context.userId, author: "MCP", updates: args.updates as MemoryUpdate[] });
}

async function listSaved(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity);
  const page = numberArg(args, "page", 1);
  const limit = numberArg(args, "limit", 50);
  const clauses: Prisma.AlphaSeoSavedKeywordWhereInput[] = [];
  const search = optionalString(args, "search");
  if (search) clauses.push({ normalized: { contains: normalizeKeyword(search) } });
  for (const term of (args.includeTerms as string[] | undefined) ?? []) clauses.push({ normalized: { contains: normalizeKeyword(term) } });
  for (const term of (args.excludeTerms as string[] | undefined) ?? []) clauses.push({ NOT: { normalized: { contains: normalizeKeyword(term) } } });
  const tagIds = (args.tagIds as string[] | undefined) ?? [];
  const where: Prisma.AlphaSeoSavedKeywordWhereInput = { projectId: context.projectId, AND: clauses, ...(tagIds.length ? { tagAssignments: { some: { tagId: { in: tagIds }, tag: { projectId: context.projectId } } } } : {}) };
  const [rows, total, tags] = await Promise.all([
    db.alphaSeoSavedKeyword.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit, select: { id: true, keyword: true, locationCode: true, languageCode: true, createdAt: true, tagAssignments: { select: { tag: { select: { id: true, name: true, color: true } } } } } }),
    db.alphaSeoSavedKeyword.count({ where }),
    db.alphaSeoSavedKeywordTag.findMany({ where: { projectId: context.projectId }, orderBy: { name: "asc" }, take: 200, select: { id: true, name: true, color: true, _count: { select: { assignments: true } } } }),
  ]);
  return { rows: rows.map((row) => ({ ...row, tags: row.tagAssignments.map((item) => item.tag) })), tags, pagination: { page, limit, total, hasMore: page * limit < total, nextPage: page * limit < total ? page + 1 : null } };
}

async function saveKeywords(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const keywords = [...new Map(stringList(args, "keywords").map((value) => [normalizeKeyword(value), value.trim()])).entries()];
  const locationCode = typeof args.locationCode === "number" ? args.locationCode : context.project.locationCode;
  const languageCode = typeof args.languageCode === "string" ? args.languageCode : context.project.languageCode;
  const metricRows = Array.isArray(args.metrics) ? args.metrics.map(record) : [];
  const metrics = new Map(metricRows.map((metric) => [normalizeKeyword(String(metric.keyword ?? "")), metric]));
  const tags = ((args.tags as string[] | undefined) ?? []).map((name) => ({ name: name.trim(), normalizedName: name.trim().toLocaleLowerCase("pt-BR") }));
  const savedIds = await db.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const [normalized, keyword] of keywords) {
      const saved = await tx.alphaSeoSavedKeyword.upsert({ where: { projectId_normalized_locationCode_languageCode: { projectId: context.projectId, normalized, locationCode, languageCode } }, create: { projectId: context.projectId, keyword, normalized, locationCode, languageCode }, update: { keyword }, select: { id: true } });
      ids.push(saved.id);
      const metric = metrics.get(normalized);
      if (metric) await tx.alphaSeoKeywordMetric.upsert({ where: { projectId_normalizedKeyword_locationCode_languageCode: { projectId: context.projectId, normalizedKeyword: normalized, locationCode, languageCode } }, create: { projectId: context.projectId, keyword, normalizedKeyword: normalized, locationCode, languageCode, searchVolume: typeof metric.searchVolume === "number" ? metric.searchVolume : null, cpcMicros: typeof metric.cpc === "number" ? Math.round(metric.cpc * 1_000_000) : null, competition: typeof metric.competition === "number" ? metric.competition : null, keywordDifficulty: typeof metric.keywordDifficulty === "number" ? metric.keywordDifficulty : null, intent: typeof metric.intent === "string" ? metric.intent : null, monthlySearches: (Array.isArray(metric.monthlySearches) ? metric.monthlySearches : []) as Prisma.InputJsonValue }, update: { fetchedAt: new Date() } });
    }
    if (args.tagMode === "replace" && ids.length) await tx.alphaSeoSavedKeywordTagAssignment.deleteMany({ where: { savedKeywordId: { in: ids } } });
    for (const tag of tags) {
      const tagRow = await tx.alphaSeoSavedKeywordTag.upsert({ where: { projectId_normalizedName: { projectId: context.projectId, normalizedName: tag.normalizedName } }, create: { projectId: context.projectId, ...tag }, update: { name: tag.name }, select: { id: true } });
      for (const savedKeywordId of ids) await tx.alphaSeoSavedKeywordTagAssignment.upsert({ where: { savedKeywordId_tagId: { savedKeywordId, tagId: tagRow.id } }, create: { savedKeywordId, tagId: tagRow.id }, update: {} });
    }
    return ids;
  });
  return { projectId: context.projectId, savedCount: savedIds.length, savedKeywordIds: savedIds, tags: tags.map((tag) => tag.name), tagMode: args.tagMode ?? "append", locationCode, languageCode };
}

async function researchKeywords(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const seeds = (args.seeds as Array<Record<string, unknown>>).map((seed) => String(seed.seed));
  const results: unknown[] = [];
  for (const seed of seeds) {
    const payload = { keyword: seed, location_code: context.project.locationCode, language_code: context.project.languageCode, limit: args.resultLimit ?? 150, include_clickstream_data: args.includeClickstreamData === true };
    try {
      const response = await provider({ context, operation: "KEYWORD_RESEARCH", path: "dataforseo_labs/google/related_keywords/live", payload, approvedMicros: args.approvedCostMicrosUsd, parse: (rows) => mapDataForSeoKeywordItems(rows, "related") });
      results.push({ seed, ok: true, rows: response.data, cached: response.cached, costUsd: response.costUsd });
    } catch (error) {
      results.push({ seed, ok: false, error: error instanceof Error ? error.message : "UPSTREAM_ERROR" });
    }
  }
  return { results };
}

async function domainTool(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const requestedScope = args.scope === "exact" ? "exact_url" : (args.scope as "domain" | "subdomains" | "subfolder" | undefined);
  const normalized = normalizeSeoTarget(stringArg(args, "domain"), requestedScope ?? "domain");
  const locationCode = typeof args.locationCode === "number" ? args.locationCode : context.project.locationCode;
  const languageCode = typeof args.languageCode === "string" ? args.languageCode : context.project.languageCode;
  if (name === "get_domain_overview") {
    const payload = { target: normalized.hostname, location_code: locationCode, language_code: languageCode };
    const response = await provider({ context, operation: "DOMAIN_OVERVIEW", path: "dataforseo_labs/google/domain_rank_overview/live", payload, approvedMicros: args.approvedCostMicrosUsd, parse: (rows) => record(rows[0]) });
    return { target: normalized.displayTarget, scope: normalized.scope, overview: response.data, cached: response.cached, costUsd: response.costUsd };
  }
  const payload = { target: normalized.hostname, location_code: locationCode, language_code: languageCode, limit: numberArg(args, "limit", 50), order_by: ["ranked_serp_element.serp_item.etv,desc"] };
  const response = await provider({ context, operation: "DOMAIN_KEYWORDS", path: "dataforseo_labs/google/ranked_keywords/live", payload, approvedMicros: args.approvedCostMicrosUsd, parse: itemsFromResults });
  return { target: normalized.displayTarget, scope: normalized.scope, suggestions: response.data, cached: response.cached, costUsd: response.costUsd };
}

async function backlinksTool(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const requestedScope = args.scope === "exact" ? "exact_url" : (args.scope as "domain" | "subdomains" | "subfolder" | undefined);
  const normalized = normalizeSeoTarget(stringArg(args, "target"), requestedScope ?? "domain");
  const base = { target: normalized.apiTarget, include_subdomains: normalized.includeSubdomains, include_indirect_links: true, exclude_internal_backlinks: true, backlinks_status_type: "live", rank_scale: "one_hundred" };
  if (name === "get_backlinks_overview") {
    const response = await provider({ context, operation: "BACKLINKS_OVERVIEW", path: "backlinks/summary/live", payload: base, approvedMicros: args.approvedCostMicrosUsd, parse: (rows) => record(rows[0]) });
    return { target: normalized.displayTarget, scope: normalized.scope, overview: response.data, cached: response.cached, costUsd: response.costUsd };
  }
  const view = String(args.view ?? "backlinks");
  const path = view === "referring_domains" ? "backlinks/referring_domains/live" : view === "pages" ? "backlinks/domain_pages_summary/live" : "backlinks/backlinks/live";
  const operation = view === "referring_domains" ? "BACKLINKS_DOMAINS" : view === "pages" ? "BACKLINKS_PAGES" : "BACKLINKS_ROWS";
  const page = numberArg(args, "page", 1);
  const limit = numberArg(args, "limit", 100);
  const payload = { ...base, limit, offset: (page - 1) * limit, ...(view === "backlinks" ? { mode: "one_per_domain" } : {}) };
  const response = await provider({ context, operation, path, payload, approvedMicros: args.approvedCostMicrosUsd, parse: (rows) => { const root = record(rows[0]); return { rows: Array.isArray(root.items) ? root.items : [], total: typeof root.total_count === "number" ? root.total_count : null }; } });
  return { target: normalized.displayTarget, scope: normalized.scope, view, ...response.data, page, limit, cached: response.cached, costUsd: response.costUsd };
}

async function serp(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const payload = { keyword: stringArg(args, "keyword"), location_code: typeof args.locationCode === "number" ? args.locationCode : context.project.locationCode, language_code: typeof args.languageCode === "string" ? args.languageCode : context.project.languageCode, device: args.device ?? "desktop", os: args.device === "mobile" ? "android" : "windows", depth: args.depth ?? 100 };
  const result = await provider({ context, operation: "SERP_ANALYSIS", path: "serp/google/organic/live/advanced", payload, approvedMicros: args.approvedCostMicrosUsd, parse: mapSerpItems });
  return { keyword: payload.keyword, results: result.data, cached: result.cached, costUsd: result.costUsd };
}

async function rankTool(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const mutating = ["create_rank_tracker", "add_rank_tracking_keywords", "remove_rank_tracking_keywords", "run_rank_tracker"].includes(name);
  const context = await projectContext(args, identity, mutating ? "EDITOR" : "VIEWER");
  if (name === "create_rank_tracker") {
    const rawDomain = optionalString(args, "domain") ?? context.project.domain;
    if (!rawDomain) throw new Error("RANK_DOMAIN_REQUIRED");
    return createRankConfig({ projectId: context.projectId, domain: normalizeRankDomain(rawDomain), locationCode: typeof args.locationCode === "number" ? args.locationCode : context.project.locationCode, locationName: optionalString(args, "locationName") ?? context.project.locationName, languageCode: optionalString(args, "languageCode") ?? context.project.languageCode, devices: String(args.devices ?? "mobile").toUpperCase(), serpDepth: numberArg(args, "serpDepth", 40), scheduleInterval: String(args.scheduleInterval ?? "manual").toUpperCase() as "MANUAL" | "DAILY" | "WEEKLY" | "MONTHLY" });
  }
  const trackerId = optionalString(args, "trackerId");
  if (name === "get_rank_tracker") return trackerId ? getRankResults(context.projectId, trackerId, numberArg(args, "limit", 200), numberArg(args, "compareDays", 7)) : listRankConfigs(context.projectId);
  if (!trackerId) throw new Error("RANK_CONFIG_NOT_FOUND");
  if (name === "add_rank_tracking_keywords") return addRankKeywords({ projectId: context.projectId, configId: trackerId, keywords: stringList(args, "keywords") });
  if (name === "remove_rank_tracking_keywords") return removeRankKeywords({ projectId: context.projectId, configId: trackerId, keywordIds: stringList(args, "keywordIds") });
  const estimate = await estimateRankRun({ projectId: context.projectId, configId: trackerId });
  if (name === "estimate_rank_tracker_cost") return { ...estimate, trackerId, costCredits: estimate.estimatedUnits, costUsd: estimate.estimatedMicrosUsd / 1_000_000, additionalKeywordCount: args.additionalKeywordCount ?? 0 };
  const ceiling = numberArg(args, "maxCostCredits");
  if (ceiling < estimate.estimatedUnits) throw new Error("RANK_COST_APPROVAL_REQUIRED");
  await approveRankRunCost({ projectId: context.projectId, configId: trackerId, userId: context.userId, requestHash: estimate.requestHash });
  return triggerRankRun({ projectId: context.projectId, configId: trackerId, userId: context.userId, approvalRequestHash: estimate.requestHash, trigger: "MANUAL" });
}

async function genericResearch(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const market = { location_code: typeof args.locationCode === "number" ? args.locationCode : context.project.locationCode, language_code: typeof args.languageCode === "string" ? args.languageCode : context.project.languageCode };
  let path: string;
  let operation: string;
  let payload: Record<string, unknown>;
  switch (name) {
    case "get_ranked_keywords": path = "dataforseo_labs/google/ranked_keywords/live"; operation = "DOMAIN_KEYWORDS"; payload = { target: stringArg(args, "target"), ...market, limit: args.limit ?? 50, offset: (numberArg(args, "page", 1) - 1) * numberArg(args, "limit", 50) }; break;
    case "find_serp_competitors": path = "dataforseo_labs/google/serp_competitors/live"; operation = "SERP_COMPETITORS"; payload = { keywords: args.keywords, ...market, limit: args.limit ?? 50 }; break;
    case "search_local_businesses": path = "business_data/business_listings/search/live"; operation = "LOCAL_BUSINESS_SEARCH"; payload = { title: args.title, categories: args.categories, location_coordinate: args.locationCoordinate, limit: args.limit ?? 50, offset: args.offset ?? 0 }; break;
    case "get_local_serp_results": path = "serp/google/maps/live/advanced"; operation = "LOCAL_SERP"; payload = { keyword: args.keyword, location_coordinate: args.locationCoordinate, language_code: args.languageCode ?? context.project.languageCode, depth: args.depth ?? 20 }; break;
    case "get_google_business_questions": path = "business_data/google/questions_and_answers/live"; operation = "BUSINESS_QUESTIONS"; payload = { keyword: args.businessName ?? args.cid ?? args.placeId, location_coordinate: args.locationCoordinate, language_code: args.languageCode ?? context.project.languageCode, depth: args.depth ?? 20 }; break;
    case "get_business_profile": path = "business_data/google/my_business_info/live"; operation = "BUSINESS_PROFILE"; payload = { keyword: args.businessName, ...(args.locationCoordinate ? { location_coordinate: args.locationCoordinate } : { location_code: args.locationCode ?? context.project.locationCode }), language_code: args.languageCode ?? context.project.languageCode }; break;
    case "get_keyword_metrics": path = "keywords_data/google_ads/search_volume/live"; operation = "KEYWORD_METRICS"; payload = { keywords: args.keywords, ...market }; break;
    default: throw new Error("TOOL_NOT_IMPLEMENTED");
  }
  const units = name === "get_keyword_metrics" ? (args.keywords as unknown[]).length : 1;
  const result = await provider({ context, operation, path, payload, units, approvedMicros: args.approvedCostMicrosUsd, parse: itemsFromResults });
  return { rows: result.data, cached: result.cached, costUsd: result.costUsd };
}

function dataForSeoAuth(): string {
  const direct = process.env.DATAFORSEO_API_KEY?.trim();
  if (direct) return direct.startsWith("Basic ") ? direct : `Basic ${direct}`;
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new Error("DATAFORSEO_NOT_CONFIGURED");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function rawDataForSeo(path: string, method: "GET" | "POST", payload?: Record<string, unknown>) {
  const response = await fetch(`https://api.dataforseo.com/v3/${path}`, { method, headers: { Authorization: dataForSeoAuth(), "Content-Type": "application/json" }, ...(payload ? { body: JSON.stringify([payload]) } : {}), signal: AbortSignal.timeout(60_000), cache: "no-store" });
  if (!response.ok) throw new Error(`DATAFORSEO_${response.status}`);
  const body = record(await response.json());
  const tasks = Array.isArray(body.tasks) ? body.tasks.map(record) : [];
  const task = tasks[0];
  if (!task) throw new Error("DATAFORSEO_INVALID_RESPONSE");
  return task;
}

async function businessTask(name: "get_business_reviews" | "get_business_updates", args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const reviews = name === "get_business_reviews";
  const endpoint = reviews ? (args.includeOtherSources ? "extended_reviews" : "reviews") : "my_business_updates";
  const operation = reviews ? "BUSINESS_REVIEWS" : "BUSINESS_UPDATES";
  const payload = { keyword: args.businessName, cid: args.cid, place_id: args.placeId, ...(args.locationCoordinate ? { location_coordinate: args.locationCoordinate } : { location_code: args.locationCode ?? context.project.locationCode }), language_code: args.languageCode ?? context.project.languageCode, depth: args.depth ?? 20, priority: 2, ...(reviews && !args.includeOtherSources && args.sortBy ? { sort_by: args.sortBy } : {}) };
  await approveProviderIfPresented(context, operation, payload, 1, args.approvedCostMicrosUsd);
  const requestHash = alphaSeoCacheKey(context.projectId, operation, payload);
  const idempotencyKey = alphaSeoIdempotencyKey(context.projectId, operation, payload);
  const lease = await acquireAlphaSeoMutex({ projectId: context.projectId, operation: "DATAFORSEO_ASYNC_MUTEX", key: idempotencyKey, leaseMs: 90_000 });
  if (!lease) throw new Error("ALPHA_SEO_OPERATION_IN_PROGRESS");
  try {
    let run = await db.alphaSeoExternalOperationRun.findUnique({
      where: { idempotencyKey },
      select: { id: true, status: true, result: true, actualMicrosUsd: true },
    });
    const saved = record(run?.result);
    const existingRun = Boolean(run);
    if (run?.status === "COMPLETED" && typeof saved.taskId === "string") return { ...saved, cached: true };

    if (!run) {
      run = await db.alphaSeoExternalOperationRun.create({
        data: { projectId: context.projectId, requestedById: context.userId, provider: "DATAFORSEO", operation, target: typeof payload.keyword === "string" ? payload.keyword : null, request: payload as Prisma.InputJsonValue, requestHash, idempotencyKey, status: "PENDING", estimatedUnits: 1, estimatedMicrosUsd: estimateAlphaSeoProviderCost(operation, 1).estimatedMicrosUsd },
        select: { id: true, status: true, result: true, actualMicrosUsd: true },
      });
    }
    let taskId = typeof saved.taskId === "string" ? saved.taskId : null;
    let costUsd = (run.actualMicrosUsd ?? 0) / 1_000_000;
    if (!taskId) {
      if (existingRun) throw new Error("DATAFORSEO_TASK_POST_STATE_UNKNOWN");
      await db.alphaSeoExternalOperationRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: new Date(), result: { status: "posting" } } });
      const posted = await rawDataForSeo(`business_data/google/${endpoint}/task_post`, "POST", payload);
      taskId = typeof posted.id === "string" ? posted.id : null;
      if (!taskId) throw new Error("DATAFORSEO_TASK_NOT_CREATED");
      costUsd = typeof posted.cost === "number" ? posted.cost : 0;
      await db.alphaSeoExternalOperationRun.update({
        where: { id: run.id },
        data: { status: "RUNNING", startedAt: new Date(), result: { taskId, status: "pending" }, actualUnits: 1, actualMicrosUsd: Math.round(costUsd * 1_000_000) },
      });
    }
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const task = await rawDataForSeo(`business_data/google/${endpoint}/task_get/${encodeURIComponent(taskId)}`, "GET");
      if (task.status_code === 20000) {
        const completed = { taskId, status: "completed", result: Array.isArray(task.result) ? task.result[0] ?? null : null, costUsd };
        await db.alphaSeoExternalOperationRun.update({ where: { id: run.id }, data: { status: "COMPLETED", result: completed, completedAt: new Date() } });
        return completed;
      }
      if (task.status_code !== 20100 && task.status_code !== 40601) throw new Error("DATAFORSEO_TASK_FAILED");
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    return { taskId, status: "pending", retry: `Repita ${name} com os mesmos parâmetros; o mesmo taskId será consultado sem novo task_post.`, costUsd };
  } finally {
    await releaseAlphaSeoMutex(lease);
  }
}

async function categories(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity);
  const operation = "BUSINESS_CATEGORIES";
  const cacheKeyHash = alphaSeoCacheKey(context.projectId, operation, {});
  const loadCache = () => db.alphaSeoProviderCache.findUnique({
    where: { projectId_provider_operation_cacheKeyHash: { projectId: context.projectId, provider: "DATAFORSEO", operation, cacheKeyHash } },
    select: { payload: true, expiresAt: true },
  });
  const cached = await loadCache();
  let all = cached && cached.expiresAt > new Date() && Array.isArray(cached.payload) ? cached.payload.map(record) : null;
  if (!all) {
    const lease = await acquireAlphaSeoMutex({ projectId: context.projectId, operation: "DATAFORSEO_CATEGORIES_MUTEX", key: cacheKeyHash, leaseMs: 60_000 });
    if (!lease) throw new Error("ALPHA_SEO_OPERATION_IN_PROGRESS");
    try {
      const afterLock = await loadCache();
      if (afterLock && afterLock.expiresAt > new Date() && Array.isArray(afterLock.payload)) all = afterLock.payload.map(record);
      else {
        const task = await rawDataForSeo("business_data/business_listings/categories", "GET");
        all = Array.isArray(task.result) ? task.result.map(record) : [];
        await db.alphaSeoProviderCache.upsert({
          where: { projectId_provider_operation_cacheKeyHash: { projectId: context.projectId, provider: "DATAFORSEO", operation, cacheKeyHash } },
          create: { projectId: context.projectId, provider: "DATAFORSEO", operation, cacheKeyHash, payload: all as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86_400_000) },
          update: { payload: all as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86_400_000) },
        });
      }
    } finally {
      await releaseAlphaSeoMutex(lease);
    }
  }
  const search = optionalString(args, "search")?.toLocaleLowerCase("pt-BR");
  const filtered = search ? all.filter((row) => String(row.category_name ?? "").toLocaleLowerCase("pt-BR").includes(search)) : all;
  const offset = numberArg(args, "offset", 0);
  const limit = numberArg(args, "limit", 50);
  return { rows: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit, hasMore: offset + limit < filtered.length, nextOffset: offset + limit < filtered.length ? offset + limit : null };
}

async function localGrid(args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, "EDITOR");
  const size = numberArg(args, "gridSize", 3);
  const radiusKm = numberArg(args, "radiusKm", 2);
  const centerLat = numberArg(args, "centerLatitude");
  const centerLng = numberArg(args, "centerLongitude");
  const points: Array<{ latitude: number; longitude: number }> = [];
  const half = (size - 1) / 2;
  for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) points.push({ latitude: centerLat + ((row - half) * radiusKm) / 111, longitude: centerLng + ((col - half) * radiusKm) / (111 * Math.max(0.2, Math.cos((centerLat * Math.PI) / 180))) });
  await approveProviderIfPresented(context, "LOCAL_RANK_GRID", { keyword: args.keyword, target: args.target, points }, points.length, args.approvedCostMicrosUsd);
  const rows = [];
  for (const point of points) {
    const payload = { keyword: args.keyword, location_coordinate: `${point.latitude},${point.longitude},100`, language_code: args.languageCode ?? context.project.languageCode, depth: 20 };
    const result = await provider({ context, operation: "LOCAL_RANK_GRID", path: "serp/google/maps/live/advanced", payload, units: 1, approvedMicros: args.approvedCostMicrosUsd, parse: itemsFromResults });
    const position = result.data.findIndex((item) => JSON.stringify(item).toLocaleLowerCase("pt-BR").includes(String(args.target).toLocaleLowerCase("pt-BR")));
    rows.push({ ...point, position: position >= 0 ? position + 1 : null, resultsChecked: result.data.length });
  }
  return { keyword: args.keyword, target: args.target, gridSize: size, rows };
}

async function googleConnection(projectId: string, product: "GSC" | "GA4") {
  if (product === "GSC") {
    const connection = await db.alphaSeoGscConnection.findUnique({ where: { projectId }, include: { grant: { select: { id: true, userId: true, revokedAt: true } } } });
    if (!connection || connection.grant.revokedAt) throw new Error("GSC_NOT_CONNECTED");
    return { connection, token: await getGoogleAccessToken(connection.grant.id, connection.grant.userId) };
  }
  const connection = await db.alphaSeoGa4Connection.findUnique({ where: { projectId }, include: { grant: { select: { id: true, userId: true, revokedAt: true } } } });
  if (!connection || connection.grant.revokedAt) throw new Error("GA4_NOT_CONNECTED");
  return { connection, token: await getGoogleAccessToken(connection.grant.id, connection.grant.userId) };
}

async function gsc(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity);
  const auth = await googleConnection(context.projectId, "GSC");
  if (!("siteUrl" in auth.connection)) throw new Error("GSC_NOT_CONNECTED");
  if (name === "inspect_urls") {
    const results = [];
    for (const url of stringList(args, "urls")) {
      try { results.push({ url, ok: true, result: await inspectGscUrl(auth.token, auth.connection.siteUrl, url) }); }
      catch (error) { results.push({ url, ok: false, error: error instanceof Error ? error.message : "GSC_ERROR" }); }
    }
    return { results };
  }
  const rows = await queryGsc(auth.token, { siteUrl: auth.connection.siteUrl, startDate: stringArg(args, "startDate"), endDate: stringArg(args, "endDate"), dimensions: args.dimensions as ("date" | "query" | "page" | "country" | "device" | "searchAppearance")[], filters: args.filters as never[], rowLimit: numberArg(args, "rowLimit", 1_000), startRow: numberArg(args, "startRow", 0) });
  return { siteUrl: auth.connection.siteUrl, rows, totals: searchTotals(rows), strikingDistance: strikingDistance(rows), pagination: { startRow: args.startRow ?? 0, limit: args.rowLimit ?? 1_000, hasMore: rows.length === (args.rowLimit ?? 1_000), nextStartRow: rows.length === (args.rowLimit ?? 1_000) ? Number(args.startRow ?? 0) + rows.length : null } };
}

const GA4_NAME_TO_REPORT: Partial<Record<AlphaSeoMcpToolName, (typeof GA4_REPORTS)[number]>> = {
  get_google_analytics_organic_landing_pages: "organic_landing_pages", get_google_analytics_page_performance: "page_performance", get_google_analytics_key_events: "key_events", get_search_opportunities: "search_opportunities", get_google_analytics_organic_overview: "organic_overview", get_google_analytics_traffic_acquisition: "traffic_acquisition", get_google_analytics_measurement_health: "measurement_health", get_google_analytics_ecommerce_performance: "ecommerce_performance", get_google_analytics_site_search: "site_search", get_google_analytics_audience_breakdown: "audience_breakdown",
};

async function ga4(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity);
  const auth = await googleConnection(context.projectId, "GA4");
  if (!("propertyId" in auth.connection)) throw new Error("GA4_NOT_CONNECTED");
  const report = GA4_NAME_TO_REPORT[name];
  if (!report) throw new Error("GA4_REPORT_INVALID");
  return runGa4Report(auth.token, { propertyId: auth.connection.propertyId, report, startDate: stringArg(args, "startDate"), endDate: stringArg(args, "endDate"), limit: numberArg(args, "limit", 50) });
}

async function auditTool(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity) {
  const context = await projectContext(args, identity, name === "run_site_audit" ? "EDITOR" : "VIEWER");
  if (name === "run_site_audit") return startSiteAudit({ projectId: context.projectId, userId: context.userId, startUrl: stringArg(args, "startUrl"), config: { maxPages: numberArg(args, "maxPages", 50), lighthouseStrategy: (args.lighthouseStrategy as "AUTO" | "NONE") ?? "AUTO" } });
  const auditId = stringArg(args, "auditId");
  if (name === "get_audit_status") return getSiteAuditStatus(context.projectId, auditId);
  const result = await getSiteAuditResults({ projectId: context.projectId, auditId, page: numberArg(args, "page", 1), limit: numberArg(args, "limit", 50), ...(name === "get_audit_issues" && args.issueType ? { issueType: String(args.issueType) } : {}), ...(name === "get_audit_issues" && args.severity ? { severity: args.severity as "CRITICAL" | "WARNING" | "INFO" } : {}) });
  return name === "get_audit_issues" ? { audit: result.audit, issues: result.issues, pagination: { page: result.pagination.page, limit: result.pagination.limit, total: result.pagination.issuesTotal, hasMore: result.pagination.page * result.pagination.limit < result.pagination.issuesTotal } } : { audit: result.audit, pages: result.pages, lighthouse: result.lighthouse, pagination: { page: result.pagination.page, limit: result.pagination.limit, total: result.pagination.pagesTotal, hasMore: result.pagination.page * result.pagination.limit < result.pagination.pagesTotal } };
}

export async function executeAlphaSeoMcpTool(name: AlphaSeoMcpToolName, args: Args, identity: AlphaSeoMcpIdentity): Promise<unknown> {
  if (name === "whoami") return whoami(identity);
  if (name === "list_projects") return listProjects(args, identity);
  if (name === "create_project") return createProject(args, identity);
  if (name === "get_project_context") return getContext(args, identity);
  if (name === "update_project_context") return updateContext(args, identity);
  if (name === "list_saved_keywords") return listSaved(args, identity);
  if (name === "save_keywords") return saveKeywords(args, identity);
  if (name === "research_keywords") return researchKeywords(args, identity);
  if (name === "get_domain_overview" || name === "get_domain_keyword_suggestions") return domainTool(name, args, identity);
  if (name === "get_backlinks_overview" || name === "get_backlinks_profile") return backlinksTool(name, args, identity);
  if (name === "get_serp_results") return serp(args, identity);
  if (["create_rank_tracker", "get_rank_tracker", "add_rank_tracking_keywords", "remove_rank_tracking_keywords", "estimate_rank_tracker_cost", "run_rank_tracker"].includes(name)) return rankTool(name, args, identity);
  if (["get_ranked_keywords", "find_serp_competitors", "search_local_businesses", "get_local_serp_results", "get_google_business_questions", "get_business_profile", "get_keyword_metrics"].includes(name)) return genericResearch(name, args, identity);
  if (name === "get_business_reviews" || name === "get_business_updates") return businessTask(name, args, identity);
  if (name === "list_business_categories") return categories(args, identity);
  if (name === "get_local_rank_grid") return localGrid(args, identity);
  if (name === "get_search_console_performance" || name === "inspect_urls") return gsc(name, args, identity);
  if (GA4_NAME_TO_REPORT[name]) return ga4(name, args, identity);
  if (["run_site_audit", "get_audit_status", "get_audit_issues", "get_audit_pages"].includes(name)) return auditTool(name, args, identity);
  throw new Error(`TOOL_NOT_IMPLEMENTED:${name}`);
}

export function toolRequestHash(projectId: string, tool: string, args: Args): string {
  return alphaSeoCacheKey(projectId, `MCP:${tool}`, args);
}
