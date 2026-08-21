import "server-only";

import { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import {
  approveAlphaSeoProviderCost,
  assertAlphaSeoProviderCostApproved,
  estimateAlphaSeoProviderRequest,
  executeAlphaSeoDataForSeo,
} from "@/lib/alpha-seo/dataforseo/operations";
import { mapDataForSeoKeywordItems, normalizeKeyword } from "@/lib/alpha-seo/keywords/mappers";
import {
  deleteSavedKeywordTagInputSchema,
  approveSavedKeywordMetricsInputSchema,
  listSavedKeywordsInputSchema,
  refreshSavedKeywordMetricsInputSchema,
  removeSavedKeywordsInputSchema,
  saveKeywordsInputSchema,
  updateSavedKeywordTagInputSchema,
  updateSavedKeywordTagsInputSchema,
} from "./schemas";

function normalizeTag(value: string): { name: string; normalizedName: string } {
  const name = value.trim().replace(/\s+/g, " ");
  return { name, normalizedName: name.toLocaleLowerCase("pt-BR") };
}
function cpcToMicros(cpc: number | null | undefined): number | null { return cpc == null ? null : Math.round(cpc * 1_000_000); }

export async function saveAlphaSeoKeywords(input: unknown) {
  const parsed = saveKeywordsInputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: parsed.projectId }, select: { locationCode: true, languageCode: true } });
  const locationCode = parsed.locationCode ?? project.locationCode;
  const languageCode = parsed.languageCode ?? project.languageCode;
  const keywords = [...new Map(parsed.keywords.map((value) => [normalizeKeyword(value), value.trim()])).entries()];
  const metrics = new Map(parsed.metrics.map((metric) => [normalizeKeyword(metric.keyword), metric]));
  const tags = [...new Map(parsed.tags.map((value) => { const item = normalizeTag(value); return [item.normalizedName, item]; })).values()];
  return db.$transaction(async (tx) => {
    for (const [normalized, original] of keywords) {
      await tx.alphaSeoSavedKeyword.upsert({
        where: { projectId_normalized_locationCode_languageCode: { projectId: parsed.projectId, normalized, locationCode, languageCode } },
        create: { projectId: parsed.projectId, keyword: original, normalized, locationCode, languageCode },
        update: { keyword: original },
      });
      const metric = metrics.get(normalized);
      if (metric) {
        await tx.alphaSeoKeywordMetric.upsert({
          where: { projectId_normalizedKeyword_locationCode_languageCode: { projectId: parsed.projectId, normalizedKeyword: normalized, locationCode, languageCode } },
          create: { projectId: parsed.projectId, keyword: original, normalizedKeyword: normalized, locationCode, languageCode, searchVolume: metric.searchVolume ?? null, cpcMicros: cpcToMicros(metric.cpc), competition: metric.competition ?? null, keywordDifficulty: metric.keywordDifficulty ?? null, intent: metric.intent ?? null, monthlySearches: (metric.monthlySearches ?? []) as Prisma.InputJsonValue },
          update: { keyword: original, searchVolume: metric.searchVolume ?? null, cpcMicros: cpcToMicros(metric.cpc), competition: metric.competition ?? null, keywordDifficulty: metric.keywordDifficulty ?? null, intent: metric.intent ?? null, monthlySearches: (metric.monthlySearches ?? []) as Prisma.InputJsonValue, fetchedAt: new Date() },
        });
      }
    }
    const saved = await tx.alphaSeoSavedKeyword.findMany({ where: { projectId: parsed.projectId, normalized: { in: keywords.map(([normalized]) => normalized) }, locationCode, languageCode }, select: { id: true }, take: 500 });
    const tagRows: { id: string; name: string; normalizedName: string; color: string | null }[] = [];
    for (const item of tags) {
      tagRows.push(await tx.alphaSeoSavedKeywordTag.upsert({ where: { projectId_normalizedName: { projectId: parsed.projectId, normalizedName: item.normalizedName } }, create: { projectId: parsed.projectId, ...item }, update: { name: item.name }, select: { id: true, name: true, normalizedName: true, color: true } }));
    }
    if (parsed.tagMode === "replace" && saved.length > 0) await tx.alphaSeoSavedKeywordTagAssignment.deleteMany({ where: { savedKeywordId: { in: saved.map((row) => row.id) } } });
    if (tagRows.length > 0 && saved.length > 0) {
      for (const row of saved) for (const tagRow of tagRows) {
        await tx.alphaSeoSavedKeywordTagAssignment.upsert({ where: { savedKeywordId_tagId: { savedKeywordId: row.id, tagId: tagRow.id } }, create: { savedKeywordId: row.id, tagId: tagRow.id }, update: {} });
      }
    }
    return { savedKeywordIds: saved.map((row) => row.id), tags: tagRows };
  });
}

export async function listAlphaSeoSavedKeywords(input: unknown) {
  const parsed = listSavedKeywordsInputSchema.parse(input ?? {});
  await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:read" });
  const textClauses: Prisma.AlphaSeoSavedKeywordWhereInput[] = [];
  if (parsed.search) textClauses.push({ normalized: { contains: normalizeKeyword(parsed.search) } });
  for (const term of parsed.includeTerms) textClauses.push({ normalized: { contains: normalizeKeyword(term) } });
  for (const term of parsed.excludeTerms) textClauses.push({ NOT: { normalized: { contains: normalizeKeyword(term) } } });
  const where: Prisma.AlphaSeoSavedKeywordWhereInput = { projectId: parsed.projectId, AND: textClauses, ...(parsed.tagIds.length ? { tagAssignments: { some: { tagId: { in: parsed.tagIds }, tag: { projectId: parsed.projectId } } } } : {}) };
  const hasMetricFilters = parsed.minVolume != null || parsed.maxVolume != null || parsed.minCpc != null || parsed.maxCpc != null || parsed.minDifficulty != null || parsed.maxDifficulty != null;
  let filteredIds: string[] | null = null;
  let authoritativeTotal: number | null = null;
  if (hasMetricFilters) {
    const conditions: Prisma.Sql[] = [Prisma.sql`sk."projectId" = ${parsed.projectId}`];
    if (parsed.search) conditions.push(Prisma.sql`sk."normalized" LIKE ${`%${normalizeKeyword(parsed.search)}%`}`);
    for (const term of parsed.includeTerms) conditions.push(Prisma.sql`sk."normalized" LIKE ${`%${normalizeKeyword(term)}%`}`);
    for (const term of parsed.excludeTerms) conditions.push(Prisma.sql`sk."normalized" NOT LIKE ${`%${normalizeKeyword(term)}%`}`);
    if (parsed.tagIds.length) conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "AlphaSeoSavedKeywordTagAssignment" assignment
      JOIN "AlphaSeoSavedKeywordTag" tag ON tag."id" = assignment."tagId"
      WHERE assignment."savedKeywordId" = sk."id"
        AND assignment."tagId" IN (${Prisma.join(parsed.tagIds)})
        AND tag."projectId" = ${parsed.projectId}
    )`);
    if (parsed.minVolume != null) conditions.push(Prisma.sql`metric."searchVolume" >= ${parsed.minVolume}`);
    if (parsed.maxVolume != null) conditions.push(Prisma.sql`metric."searchVolume" <= ${parsed.maxVolume}`);
    if (parsed.minCpc != null) conditions.push(Prisma.sql`metric."cpcMicros" >= ${Math.round(parsed.minCpc * 1_000_000)}`);
    if (parsed.maxCpc != null) conditions.push(Prisma.sql`metric."cpcMicros" <= ${Math.round(parsed.maxCpc * 1_000_000)}`);
    if (parsed.minDifficulty != null) conditions.push(Prisma.sql`metric."keywordDifficulty" >= ${parsed.minDifficulty}`);
    if (parsed.maxDifficulty != null) conditions.push(Prisma.sql`metric."keywordDifficulty" <= ${parsed.maxDifficulty}`);
    const fromAndWhere = Prisma.sql`
      FROM "AlphaSeoSavedKeyword" sk
      JOIN "AlphaSeoKeywordMetric" metric
        ON metric."projectId" = sk."projectId"
       AND metric."normalizedKeyword" = sk."normalized"
       AND metric."locationCode" = sk."locationCode"
       AND metric."languageCode" = sk."languageCode"
      WHERE ${Prisma.join(conditions, " AND ")}
    `;
    const orderColumn = parsed.sort === "keyword" ? Prisma.raw('sk."keyword"') : Prisma.raw('sk."createdAt"');
    const orderDirection = parsed.order === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");
    const [ids, countRows] = await Promise.all([
      db.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT sk."id" ${fromAndWhere} ORDER BY ${orderColumn} ${orderDirection}, sk."id" ${orderDirection} LIMIT ${parsed.limit} OFFSET ${(parsed.page - 1) * parsed.limit}`),
      db.$queryRaw<{ total: bigint | number }[]>(Prisma.sql`SELECT COUNT(*) AS total ${fromAndWhere}`),
    ]);
    filteredIds = ids.map((row) => row.id);
    authoritativeTotal = Number(countRows[0]?.total ?? 0);
  }
  const [baseRows, total, tags] = await Promise.all([
    db.alphaSeoSavedKeyword.findMany({ where: filteredIds ? { projectId: parsed.projectId, id: { in: filteredIds } } : where, select: { id: true, keyword: true, normalized: true, locationCode: true, languageCode: true, createdAt: true, tagAssignments: { select: { tag: { select: { id: true, name: true, normalizedName: true, color: true } } }, take: 50 } }, ...(filteredIds ? {} : { orderBy: { [parsed.sort]: parsed.order }, skip: (parsed.page - 1) * parsed.limit, take: parsed.limit }) }),
    authoritativeTotal ?? db.alphaSeoSavedKeyword.count({ where }),
    db.alphaSeoSavedKeywordTag.findMany({ where: { projectId: parsed.projectId }, select: { id: true, name: true, normalizedName: true, color: true, _count: { select: { assignments: true } } }, orderBy: { normalizedName: "asc" }, take: 200 }),
  ]);
  const metrics = await db.alphaSeoKeywordMetric.findMany({ where: { OR: baseRows.map((row) => ({ projectId: parsed.projectId, normalizedKeyword: row.normalized, locationCode: row.locationCode, languageCode: row.languageCode })) }, select: { normalizedKeyword: true, locationCode: true, languageCode: true, searchVolume: true, cpcMicros: true, competition: true, keywordDifficulty: true, intent: true, monthlySearches: true, fetchedAt: true }, take: parsed.limit });
  const metricByKey = new Map(metrics.map((row) => [`${row.normalizedKeyword}:${row.locationCode}:${row.languageCode}`, row]));
  let rows = baseRows.map((row) => { const metric = metricByKey.get(`${row.normalized}:${row.locationCode}:${row.languageCode}`); return { ...row, searchVolume: metric?.searchVolume ?? null, cpc: metric?.cpcMicros == null ? null : metric.cpcMicros / 1_000_000, competition: metric?.competition ?? null, keywordDifficulty: metric?.keywordDifficulty ?? null, intent: metric?.intent ?? null, monthlySearches: metric?.monthlySearches ?? [], fetchedAt: metric?.fetchedAt ?? null, tags: row.tagAssignments.map((assignment) => assignment.tag) }; });
  if (filteredIds) {
    const rowById = new Map(rows.map((row) => [row.id, row]));
    rows = filteredIds.flatMap((id) => {
      const row = rowById.get(id);
      return row ? [row] : [];
    });
  }
  return { rows, tags: tags.map((tagRow) => ({ ...tagRow, keywordCount: tagRow._count.assignments })), pagination: { page: parsed.page, limit: parsed.limit, total, totalPages: Math.ceil(total / parsed.limit) } };
}

export async function updateAlphaSeoSavedKeywordTags(input: unknown) {
  const parsed = updateSavedKeywordTagsInputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  return db.$transaction(async (tx) => {
    const keywords = await tx.alphaSeoSavedKeyword.findMany({ where: { projectId: parsed.projectId, id: { in: [...new Set(parsed.savedKeywordIds)] } }, select: { id: true }, take: 2000 });
    if (keywords.length !== new Set(parsed.savedKeywordIds).size) throw new Error("Uma ou mais palavras-chave não pertencem ao projeto");
    const tagRows: { id: string; name: string; color: string | null }[] = [];
    for (const value of [...new Set(parsed.addTags)]) { const tag = normalizeTag(value); tagRows.push(await tx.alphaSeoSavedKeywordTag.upsert({ where: { projectId_normalizedName: { projectId: parsed.projectId, normalizedName: tag.normalizedName } }, create: { projectId: parsed.projectId, ...tag }, update: { name: tag.name }, select: { id: true, name: true, color: true } })); }
    if (tagRows.length) {
      for (const row of keywords) for (const tagRow of tagRows) {
        await tx.alphaSeoSavedKeywordTagAssignment.upsert({ where: { savedKeywordId_tagId: { savedKeywordId: row.id, tagId: tagRow.id } }, create: { savedKeywordId: row.id, tagId: tagRow.id }, update: {} });
      }
    }
    let removed = 0;
    if (parsed.removeTagIds.length) { const result = await tx.alphaSeoSavedKeywordTagAssignment.deleteMany({ where: { savedKeywordId: { in: keywords.map((row) => row.id) }, tagId: { in: parsed.removeTagIds }, tag: { projectId: parsed.projectId } } }); removed = result.count; }
    return { taggedCount: keywords.length, addedTags: tagRows, removedAssignments: removed };
  });
}

export async function removeAlphaSeoSavedKeywords(input: unknown) {
  const parsed = removeSavedKeywordsInputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const result = await db.alphaSeoSavedKeyword.deleteMany({ where: { projectId: parsed.projectId, id: { in: [...new Set(parsed.savedKeywordIds)] } } });
  return { deletedCount: result.count };
}

export async function updateAlphaSeoSavedKeywordTag(input: unknown) {
  const parsed = updateSavedKeywordTagInputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const data: Prisma.AlphaSeoSavedKeywordTagUpdateManyMutationInput = {};
  if (parsed.name !== undefined) { const normalized = normalizeTag(parsed.name); data.name = normalized.name; data.normalizedName = normalized.normalizedName; }
  if (parsed.color !== undefined) data.color = parsed.color;
  const result = await db.alphaSeoSavedKeywordTag.updateMany({ where: { id: parsed.tagId, projectId: parsed.projectId }, data });
  return { updated: result.count === 1 };
}

export async function deleteAlphaSeoSavedKeywordTag(input: unknown) {
  const parsed = deleteSavedKeywordTagInputSchema.parse(input);
  await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const tag = await db.alphaSeoSavedKeywordTag.findFirst({ where: { id: parsed.tagId, projectId: parsed.projectId }, select: { id: true, _count: { select: { assignments: true } } } });
  if (!tag) return { deleted: false };
  if (tag._count.assignments > 0 && !parsed.force) throw new Error(`A tag está vinculada a ${tag._count.assignments} palavra(s)-chave`);
  await db.alphaSeoSavedKeywordTag.delete({ where: { id: tag.id } });
  return { deleted: true };
}

export async function refreshAlphaSeoSavedKeywordMetrics(input: unknown) {
  const parsed = refreshSavedKeywordMetricsInputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const plan = await buildSavedKeywordMetricsPlan(parsed);
  if (plan.units === 0) return { updated: 0, actualMicrosUsd: 0 };
  await assertAlphaSeoProviderCostApproved(access, "SAVED_KEYWORD_METRICS", plan.request, plan.units);
  let updated = 0;
  let actualMicrosUsd = 0;
  for (const batch of plan.batches) {
    const response = await executeAlphaSeoDataForSeo({
      access,
      operation: "KEYWORD_METRICS",
      path: "keywords_data/google_ads/search_volume/live",
      payload: batch.payload,
      units: batch.rows.length,
      cacheTtlSeconds: 86_400,
      approval: { operation: "SAVED_KEYWORD_METRICS", request: plan.request, units: plan.units },
      parse: (results) => mapDataForSeoKeywordItems(results, "metrics"),
    });
    actualMicrosUsd += Math.round(response.costUsd * 1_000_000);
    for (const metric of response.data) {
      await db.alphaSeoKeywordMetric.upsert({ where: { projectId_normalizedKeyword_locationCode_languageCode: { projectId: parsed.projectId, normalizedKeyword: metric.keyword, locationCode: batch.locationCode, languageCode: batch.languageCode } }, create: { projectId: parsed.projectId, keyword: metric.keyword, normalizedKeyword: metric.keyword, locationCode: batch.locationCode, languageCode: batch.languageCode, searchVolume: metric.searchVolume, cpcMicros: cpcToMicros(metric.cpc), competition: metric.competition, keywordDifficulty: metric.keywordDifficulty, intent: metric.intent, monthlySearches: metric.monthlySearches as Prisma.InputJsonValue }, update: { searchVolume: metric.searchVolume, cpcMicros: cpcToMicros(metric.cpc), competition: metric.competition, keywordDifficulty: metric.keywordDifficulty, intent: metric.intent, monthlySearches: metric.monthlySearches as Prisma.InputJsonValue, fetchedAt: new Date() } });
      updated += 1;
    }
  }
  return { updated, actualMicrosUsd };
}

export async function estimateAlphaSeoSavedKeywordMetricsCost(input: unknown) {
  const parsed = refreshSavedKeywordMetricsInputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:read" });
  const plan = await buildSavedKeywordMetricsPlan(parsed);
  return estimateAlphaSeoProviderRequest(access, "SAVED_KEYWORD_METRICS", plan.request, plan.units);
}

export async function approveAlphaSeoSavedKeywordMetricsCost(input: unknown) {
  const parsed = approveSavedKeywordMetricsInputSchema.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const plan = await buildSavedKeywordMetricsPlan(parsed);
  const estimate = estimateAlphaSeoProviderRequest(access, "SAVED_KEYWORD_METRICS", plan.request, plan.units);
  if (estimate.requestHash !== parsed.requestHash) throw new Error("SAVED_KEYWORD_COST_ESTIMATE_CHANGED");
  return approveAlphaSeoProviderCost(access, "SAVED_KEYWORD_METRICS", plan.request, plan.units);
}

async function buildSavedKeywordMetricsPlan(input: { projectId: string; savedKeywordIds?: string[] }) {
  const rows = await db.alphaSeoSavedKeyword.findMany({
    where: { projectId: input.projectId, ...(input.savedKeywordIds?.length ? { id: { in: [...new Set(input.savedKeywordIds)] } } : {}) },
    orderBy: { id: "asc" },
    select: { id: true, keyword: true, locationCode: true, languageCode: true },
    take: 2000,
  });
  if (input.savedKeywordIds?.length && rows.length !== new Set(input.savedKeywordIds).size) throw new Error("SAVED_KEYWORD_NOT_FOUND");
  const byMarket = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.locationCode}:${row.languageCode}`;
    byMarket.set(key, [...(byMarket.get(key) ?? []), row]);
  }
  const batches = [...byMarket.values()].flatMap((marketRows) => {
    const result: Array<{
      rows: typeof marketRows;
      locationCode: number;
      languageCode: string;
      payload: { keywords: string[]; location_code: number; language_code: string };
    }> = [];
    for (let offset = 0; offset < marketRows.length; offset += 700) {
      const rowsInBatch = marketRows.slice(offset, offset + 700);
      result.push({
        rows: rowsInBatch,
        locationCode: rowsInBatch[0].locationCode,
        languageCode: rowsInBatch[0].languageCode,
        payload: { keywords: rowsInBatch.map((row) => row.keyword), location_code: rowsInBatch[0].locationCode, language_code: rowsInBatch[0].languageCode },
      });
    }
    return result;
  });
  return {
    batches,
    units: rows.length,
    request: { savedKeywordIds: rows.map((row) => row.id) },
  };
}
