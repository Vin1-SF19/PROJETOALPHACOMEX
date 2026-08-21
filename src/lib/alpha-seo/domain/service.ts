import "server-only";

import { z } from "zod";
import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { executeAlphaSeoDataForSeo } from "@/lib/alpha-seo/dataforseo/operations";
import { buildUrlPrefixFilter, normalizeSeoTarget } from "@/lib/alpha-seo/dataforseo/target";
import { dataForSeoScopeSchema } from "@/lib/alpha-seo/dataforseo/schemas";

const base = z.object({ projectId: z.string().min(1), domain: z.string().min(1).max(2048), scope: dataForSeoScopeSchema.default("domain"), locationCode: z.number().int().positive().optional(), languageCode: z.string().min(2).max(8).optional() });
const page = base.extend({ page: z.number().int().positive().default(1), limit: z.number().int().min(1).max(200).default(100), search: z.string().trim().max(200).optional(), sortOrder: z.enum(["asc", "desc"]).default("desc"), sortField: z.enum(["rank", "traffic", "volume", "keywords"]).default("traffic"), filters: z.object({ include: z.string().trim().max(100).optional(), exclude: z.string().trim().max(100).optional(), minVolume: z.number().nonnegative().optional(), maxVolume: z.number().nonnegative().optional(), minRank: z.number().nonnegative().optional(), maxRank: z.number().nonnegative().optional() }).default({}) });
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function str(value: unknown) { return typeof value === "string" ? value : null; }
function joinFilters(clauses: unknown[][]): unknown[] { return clauses.flatMap((clause, index) => index === 0 ? [clause] : ["and", clause]); }
function domainFilters(filters: z.infer<typeof page>["filters"], search?: string): unknown[][] { const clauses: unknown[][] = []; if (filters.include) clauses.push(["keyword_data.keyword", "like", `%${filters.include}%`]); if (filters.exclude) clauses.push(["keyword_data.keyword", "not_like", `%${filters.exclude}%`]); if (search) clauses.push(["keyword_data.keyword", "like", `%${search}%`]); if (filters.minVolume != null) clauses.push(["keyword_data.keyword_info.search_volume", ">=", filters.minVolume]); if (filters.maxVolume != null) clauses.push(["keyword_data.keyword_info.search_volume", "<=", filters.maxVolume]); if (filters.minRank != null) clauses.push(["ranked_serp_element.serp_item.rank_absolute", ">=", filters.minRank]); if (filters.maxRank != null) clauses.push(["ranked_serp_element.serp_item.rank_absolute", "<=", filters.maxRank]); return clauses; }

async function context(input: z.infer<typeof base>) { const access = await requireAlphaSeoProjectAccess({ projectId: input.projectId, action: "seo:execute", minimumRole: "EDITOR" }); const project = await db.alphaSeoProject.findUniqueOrThrow({ where: { id: input.projectId }, select: { locationCode: true, languageCode: true } }); return { access, locationCode: input.locationCode ?? project.locationCode, languageCode: input.languageCode ?? project.languageCode, target: normalizeSeoTarget(input.domain, input.scope) }; }

export async function getAlphaSeoDomainOverview(input: unknown) {
  const parsed = base.parse(input); const ctx = await context(parsed);
  const response = await executeAlphaSeoDataForSeo({ access: ctx.access, operation: "DOMAIN_OVERVIEW", path: "dataforseo_labs/google/domain_rank_overview/live", payload: { target: ctx.target.hostname, location_code: ctx.locationCode, language_code: ctx.languageCode }, parse: (results) => record(results[0]) });
  const metrics = record(response.data.metrics); const organic = record(metrics.organic);
  return { domain: ctx.target.hostname, scope: ctx.target.scope, displayTarget: ctx.target.displayTarget, organicTraffic: num(organic.etv), organicKeywords: num(organic.count), backlinks: null, referringDomains: null, hasData: (num(organic.count) ?? 0) > 0, fetchedAt: new Date().toISOString(), cached: response.cached };
}

export async function listAlphaSeoDomainKeywords(input: unknown) {
  const parsed = page.parse(input); const ctx = await context(parsed); const offset = (parsed.page - 1) * parsed.limit; const scopeFilter = buildUrlPrefixFilter("ranked_serp_element.serp_item.url", ctx.target); const filters = joinFilters([...(scopeFilter.length ? [scopeFilter] : []), ...domainFilters(parsed.filters, parsed.search)]);
  const response = await executeAlphaSeoDataForSeo({ access: ctx.access, operation: "DOMAIN_KEYWORDS", path: "dataforseo_labs/google/ranked_keywords/live", payload: { target: ctx.target.hostname, location_code: ctx.locationCode, language_code: ctx.languageCode, limit: parsed.limit, offset, order_by: [`ranked_serp_element.serp_item.${parsed.sortField === "rank" ? "rank_absolute" : parsed.sortField === "volume" ? "search_volume" : "etv"},${parsed.sortOrder}`], ...(filters.length ? { filters } : {}) }, parse: (results) => { const root = record(results[0]); return { items: Array.isArray(root.items) ? root.items : [], totalCount: num(root.total_count) }; } });
  const keywords = response.data.items.flatMap((raw) => { const item = record(raw); const data = record(item.keyword_data); const info = record(data.keyword_info); const props = record(data.keyword_properties); const ranked = record(item.ranked_serp_element); const serp = record(ranked.serp_item); const keyword = str(data.keyword ?? item.keyword); if (!keyword) return []; return [{ keyword, position: num(serp.rank_absolute ?? ranked.rank_absolute), searchVolume: num(info.search_volume), traffic: num(serp.etv ?? ranked.etv), cpc: num(info.cpc), url: str(serp.url ?? ranked.url), keywordDifficulty: num(props.keyword_difficulty ?? info.keyword_difficulty) }]; });
  return { domain: ctx.target.hostname, page: parsed.page, pageSize: parsed.limit, totalCount: response.data.totalCount, hasMore: response.data.totalCount == null ? keywords.length === parsed.limit : offset + keywords.length < response.data.totalCount, keywords, fetchedAt: new Date().toISOString() };
}

export async function getAlphaSeoDomainKeywordSuggestions(input: unknown) {
  const parsed = base.parse(input);
  const result = await listAlphaSeoDomainKeywords({
    ...parsed,
    page: 1,
    limit: 100,
    sortField: "traffic",
    sortOrder: "desc",
    filters: {},
  });
  return result.keywords.map(({ keyword, position, searchVolume, traffic, cpc, keywordDifficulty }) => ({
    keyword,
    position,
    searchVolume,
    traffic,
    cpc,
    keywordDifficulty,
  }));
}

export async function listAlphaSeoDomainPages(input: unknown) {
  const parsed = page.parse(input); const ctx = await context(parsed); const offset = (parsed.page - 1) * parsed.limit; const scopeFilter = buildUrlPrefixFilter("page", ctx.target);
  const response = await executeAlphaSeoDataForSeo({ access: ctx.access, operation: "DOMAIN_PAGES", path: "dataforseo_labs/google/relevant_pages/live", payload: { target: ctx.target.hostname, location_code: ctx.locationCode, language_code: ctx.languageCode, limit: parsed.limit, offset, order_by: [`metrics.organic.${parsed.sortField === "keywords" ? "count" : "etv"},${parsed.sortOrder}`], ...(scopeFilter.length ? { filters: [scopeFilter] } : {}) }, parse: (results) => { const root = record(results[0]); return { items: Array.isArray(root.items) ? root.items : [], totalCount: num(root.total_count) }; } });
  const pages = response.data.items.map((raw) => { const item = record(raw); const metrics = record(item.metrics); const organic = record(metrics.organic); return { url: str(item.page ?? item.url), traffic: num(organic.etv), keywords: num(organic.count) }; });
  return { domain: ctx.target.hostname, page: parsed.page, pageSize: parsed.limit, totalCount: response.data.totalCount, hasMore: response.data.totalCount == null ? pages.length === parsed.limit : offset + pages.length < response.data.totalCount, pages, fetchedAt: new Date().toISOString() };
}
