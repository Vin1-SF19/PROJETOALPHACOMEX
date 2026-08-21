import "server-only";

import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { alphaSeoCacheKey, alphaSeoIdempotencyKey } from "@/lib/alpha-seo/operation-policy";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { approveAlphaSeoProviderCost, assertAlphaSeoProviderCostApproved, estimateAlphaSeoProviderCost, executeAlphaSeoDataForSeo } from "@/lib/alpha-seo/dataforseo/operations";
import { dedupeKeywordRows, mapDataForSeoKeywordItems, mapSerpItems, normalizeKeyword } from "./mappers";
import { keywordCostApprovalSchema, keywordResearchInputSchema, keywordSerpInputSchema, type AlphaSeoKeywordRow } from "./schemas";

function resolveResearchPath(mode: "related" | "suggestions" | "ideas") {
  return `dataforseo_labs/google/${mode === "related" ? "related_keywords" : mode === "suggestions" ? "keyword_suggestions" : "keyword_ideas"}/live`;
}

function researchPayload(input: { seeds: string[]; mode: "related" | "suggestions" | "ideas"; locationCode: number; languageCode: string; limit: number; clickstream: boolean }) {
  return {
    ...(input.mode === "ideas" ? { keywords: input.seeds } : { keyword: input.seeds[0] }),
    location_code: input.locationCode,
    language_code: input.languageCode,
    limit: input.limit,
    include_clickstream_data: input.clickstream,
  };
}

export async function estimateKeywordResearchCost(input: unknown) {
  const parsed = keywordResearchInputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:read" });
  const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: parsed.projectId }, select: { locationCode: true, languageCode: true } });
  const seeds = [...new Set(parsed.keywords.map(normalizeKeyword))];
  const mode = parsed.mode === "auto" ? (seeds.length > 1 ? "ideas" : "related") : parsed.mode;
  const payload = researchPayload({ seeds, mode, locationCode: parsed.locationCode ?? project.locationCode, languageCode: parsed.languageCode ?? project.languageCode, limit: parsed.resultLimit, clickstream: parsed.clickstream });
  return { ...estimateAlphaSeoProviderCost("KEYWORD_RESEARCH", mode === "ideas" ? 1 : seeds.length), requestHash: alphaSeoCacheKey(access.projectId, "KEYWORD_RESEARCH", payload) };
}

export async function approveKeywordResearchCost(input: unknown) {
  const { request } = keywordCostApprovalSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: request.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: request.projectId }, select: { locationCode: true, languageCode: true } });
  const seeds = [...new Set(request.keywords.map(normalizeKeyword))];
  const mode = request.mode === "auto" ? (seeds.length > 1 ? "ideas" : "related") : request.mode;
  const payload = researchPayload({ seeds, mode, locationCode: request.locationCode ?? project.locationCode, languageCode: request.languageCode ?? project.languageCode, limit: request.resultLimit, clickstream: request.clickstream });
  return approveAlphaSeoProviderCost(access, "KEYWORD_RESEARCH", payload, mode === "ideas" ? 1 : seeds.length);
}

export async function researchAlphaSeoKeywords(input: unknown) {
  const parsed = keywordResearchInputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: parsed.projectId }, select: { locationCode: true, languageCode: true } });
  const seeds = [...new Set(parsed.keywords.map(normalizeKeyword))];
  const locationCode = parsed.locationCode ?? project.locationCode;
  const languageCode = parsed.languageCode ?? project.languageCode;
  const modes: ("related" | "suggestions" | "ideas")[] = parsed.mode === "auto" ? (seeds.length > 1 ? ["ideas"] : ["related", "suggestions", "ideas"]) : [parsed.mode];
  const request = { ...parsed, keywords: seeds, locationCode, languageCode, modes };
  const requestHash = alphaSeoCacheKey(parsed.projectId, "KEYWORD_RESEARCH", request);
  const idempotencyKey = alphaSeoIdempotencyKey(parsed.projectId, "KEYWORD_RESEARCH_RUN", request);
  const prior = await db.alphaSeoKeywordResearchRun.findUnique({ where: { idempotencyKey }, select: { id: true, status: true, result: true } });
  if (prior?.status === "COMPLETED" && prior.result !== null) return { runId: prior.id, rows: prior.result, cached: true };
  const estimateUnits = modes.reduce((total, mode) => total + (mode === "ideas" ? 1 : seeds.length), 0);
  await assertAlphaSeoProviderCostApproved(access, "KEYWORD_RESEARCH", researchPayload({ seeds, mode: modes[0], locationCode, languageCode, limit: parsed.resultLimit, clickstream: parsed.clickstream }), estimateUnits);
  const run = prior ?? await db.alphaSeoKeywordResearchRun.create({
    data: { projectId: parsed.projectId, requestedById: access.userId, mode: parsed.mode.toUpperCase(), locationCode, languageCode, includeClickstream: parsed.clickstream, seeds, request: request as Prisma.InputJsonValue, requestHash, idempotencyKey, estimatedUnits: estimateUnits, estimatedMicrosUsd: estimateAlphaSeoProviderCost("KEYWORD_RESEARCH", estimateUnits).estimatedMicrosUsd },
    select: { id: true },
  });
  await db.alphaSeoKeywordResearchRun.update({ where: { id: run.id }, data: { status: "RUNNING", startedAt: new Date() } });
  const collected: AlphaSeoKeywordRow[] = [];
  let actualUsd = 0;
  try {
    for (const mode of modes) {
      const payloads = mode === "ideas" ? [researchPayload({ seeds, mode, locationCode, languageCode, limit: parsed.resultLimit, clickstream: parsed.clickstream })] : seeds.map((seed) => researchPayload({ seeds: [seed], mode, locationCode, languageCode, limit: parsed.resultLimit, clickstream: parsed.clickstream }));
      for (const payload of payloads) {
        const response = await executeAlphaSeoDataForSeo({ access, operation: "KEYWORD_RESEARCH", path: resolveResearchPath(mode), payload, units: 1, parse: (results) => mapDataForSeoKeywordItems(results, mode) });
        collected.push(...response.data);
        actualUsd += response.costUsd;
      }
      if (parsed.mode === "auto" && dedupeKeywordRows(collected, parsed.resultLimit).filter((row) => !seeds.includes(row.keyword)).length >= 5) break;
    }
    const rows = dedupeKeywordRows(collected, parsed.resultLimit);
    await db.alphaSeoKeywordResearchRun.update({ where: { id: run.id }, data: { status: "COMPLETED", result: rows as unknown as Prisma.InputJsonValue, actualUnits: estimateUnits, actualMicrosUsd: Math.round(actualUsd * 1_000_000), completedAt: new Date() } });
    return { runId: run.id, rows, cached: false };
  } catch (error) {
    await db.alphaSeoKeywordResearchRun.update({ where: { id: run.id }, data: { status: "FAILED", partialResult: collected as unknown as Prisma.InputJsonValue, errorCode: error instanceof Error ? error.name : "UPSTREAM_ERROR", completedAt: new Date() } });
    throw error;
  }
}

export async function getAlphaSeoSerpAnalysis(input: unknown) {
  const parsed = keywordSerpInputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: parsed.projectId }, select: { locationCode: true, languageCode: true } });
  const payload = { keyword: normalizeKeyword(parsed.keyword), location_code: parsed.locationCode ?? project.locationCode, language_code: parsed.languageCode ?? project.languageCode, device: "desktop", os: "windows", depth: 100 };
  const result = await executeAlphaSeoDataForSeo({ access, operation: "SERP_ANALYSIS", path: "serp/google/organic/live/advanced", payload, cacheTtlSeconds: 43_200, parse: mapSerpItems });
  return { requestedKeyword: payload.keyword, items: result.data, reason: result.data.length === 0 ? "no_organic_results" : undefined, cached: result.cached };
}
