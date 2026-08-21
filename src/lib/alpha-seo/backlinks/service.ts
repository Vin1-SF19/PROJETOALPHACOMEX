import "server-only";
import { z } from "zod";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { executeAlphaSeoDataForSeo } from "@/lib/alpha-seo/dataforseo/operations";
import { buildUrlPrefixFilter, normalizeSeoTarget } from "@/lib/alpha-seo/dataforseo/target";
import { dataForSeoScopeSchema } from "@/lib/alpha-seo/dataforseo/schemas";

const base = z.object({ projectId: z.string().min(1), target: z.string().min(1).max(2048), scope: dataForSeoScopeSchema.default("domain") });
const list = base.extend({ page: z.number().int().positive().default(1), limit: z.union([z.literal(50), z.literal(100), z.literal(200)]).default(100), sortField: z.enum(["rank", "domain_from_rank", "backlinks", "referring_domains", "first_seen"]).default("rank"), sortOrder: z.enum(["asc", "desc"]).default("desc"), filters: z.object({ include: z.string().trim().max(100).optional(), exclude: z.string().trim().max(100).optional(), minRank: z.number().min(0).max(1000).optional(), maxRank: z.number().min(0).max(1000).optional(), hideLost: z.boolean().default(false), hideBroken: z.boolean().default(false) }).default({ hideLost: false, hideBroken: false }), mode: z.enum(["one_per_domain", "as_is"]).default("one_per_domain"), hideSpam: z.boolean().default(true), spamThreshold: z.number().min(0).max(100).default(40) });
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function num(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function common(target: ReturnType<typeof normalizeSeoTarget>) { return { target: target.apiTarget, include_subdomains: target.includeSubdomains, include_indirect_links: true, exclude_internal_backlinks: true, backlinks_status_type: "live", rank_scale: "one_hundred" }; }
function joined(clauses: unknown[][]): unknown[] { return clauses.flatMap((clause, index) => index === 0 ? [clause] : ["and", clause]); }
function text(value: unknown) { return typeof value === "string" ? value : null; }

export async function getAlphaSeoBacklinksOverview(input: unknown) {
  const parsed = base.parse(input);
  const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" });
  const target = normalizeSeoTarget(parsed.target, parsed.scope);
  const response = await executeAlphaSeoDataForSeo({ access, operation: "BACKLINKS_OVERVIEW", path: "backlinks/summary/live", payload: common(target), parse: (results) => record(results[0]) });
  const row = response.data;
  let historyRows: Record<string, unknown>[] = [];
  let historyCached = true;
  if (target.scope !== "subfolder") {
    const dateTo = new Date();
    const dateFrom = new Date(dateTo);
    dateFrom.setUTCFullYear(dateFrom.getUTCFullYear() - 1);
    const history = await executeAlphaSeoDataForSeo({
      access,
      operation: "BACKLINKS_HISTORY",
      path: "backlinks/history/live",
      payload: {
        target: target.apiTarget,
        date_from: dateFrom.toISOString().slice(0, 10),
        date_to: dateTo.toISOString().slice(0, 10),
        rank_scale: "one_hundred",
      },
      parse: (results) => {
        const root = record(results[0]);
        return (Array.isArray(root.items) ? root.items : results).map(record);
      },
    });
    historyRows = history.data;
    historyCached = history.cached;
  }
  const trends = historyRows.flatMap((item) => {
    const date = text(item.date);
    return date ? [{ date, backlinks: num(item.backlinks), referringDomains: num(item.referring_domains), rank: num(item.rank) }] : [];
  });
  const newLostTrends = historyRows.flatMap((item) => {
    const date = text(item.date);
    return date ? [{ date, newBacklinks: num(item.new_backlinks), lostBacklinks: num(item.lost_backlinks), newReferringDomains: num(item.new_referring_domains ?? item.new_reffering_domains), lostReferringDomains: num(item.lost_referring_domains ?? item.lost_reffering_domains) }] : [];
  });
  return {
    target: target.apiTarget,
    displayTarget: target.displayTarget,
    scope: target.scope,
    scopeNote: target.scope === "domain" ? "O resumo exclui subdomínios; o histórico do provedor inclui subdomínios." : target.scope === "subfolder" ? "O provedor não oferece histórico filtrado por subpasta." : null,
    summary: { rank: num(row.rank), backlinks: num(row.backlinks), referringPages: num(row.referring_pages), referringDomains: num(row.referring_domains), brokenBacklinks: num(row.broken_backlinks), brokenPages: num(row.broken_pages), backlinksSpamScore: num(row.backlinks_spam_score), newBacklinks: num(row.new_backlinks), lostBacklinks: num(row.lost_backlinks), newReferringDomains: num(row.new_referring_domains ?? row.new_reffering_domains), lostReferringDomains: num(row.lost_referring_domains ?? row.lost_reffering_domains) },
    trends,
    newLostTrends,
    fetchedAt: new Date().toISOString(),
    cached: response.cached && historyCached,
  };
}

async function listRows(input: unknown, kind: "rows" | "domains" | "pages") { const parsed = list.parse(input); const access = await requireAlphaSeoProjectAccess({ projectId: parsed.projectId, action: "seo:execute", minimumRole: "EDITOR" }); const target = normalizeSeoTarget(parsed.target, parsed.scope); if (kind === "domains" && target.scope === "subfolder") throw new Error("Domínios referentes não suportam escopo subfolder"); const offset = (parsed.page - 1) * parsed.limit; const field = kind === "pages" ? "url" : "url_to"; const scope = buildUrlPrefixFilter(field, target); const filterClauses: unknown[][] = [...(scope.length ? [scope] : [])]; if (parsed.filters.include) filterClauses.push([kind === "domains" ? "domain" : field, "like", `%${parsed.filters.include}%`]); if (parsed.filters.exclude) filterClauses.push([kind === "domains" ? "domain" : field, "not_like", `%${parsed.filters.exclude}%`]); if (parsed.filters.minRank != null) filterClauses.push(["rank", ">=", parsed.filters.minRank]); if (parsed.filters.maxRank != null) filterClauses.push(["rank", "<=", parsed.filters.maxRank]); if (parsed.filters.hideLost) filterClauses.push(["is_lost", "=", false]); if (parsed.filters.hideBroken) filterClauses.push(["is_broken", "=", false]); if (parsed.hideSpam) filterClauses.push([kind === "domains" ? "backlinks_spam_score" : "backlink_spam_score", "<=", parsed.spamThreshold]); const filters = joined(filterClauses); const operation = kind === "rows" ? "BACKLINKS_ROWS" : kind === "domains" ? "BACKLINKS_DOMAINS" : "BACKLINKS_PAGES"; const path = kind === "rows" ? "backlinks/backlinks/live" : kind === "domains" ? "backlinks/referring_domains/live" : "backlinks/domain_pages_summary/live"; const response = await executeAlphaSeoDataForSeo({ access, operation, path, payload: { ...common(target), limit: parsed.limit, offset, order_by: [`${parsed.sortField},${parsed.sortOrder}`], ...(kind === "rows" ? { mode: parsed.mode } : {}), ...(filters.length ? { filters } : {}) }, parse: (results) => { const root = record(results[0]); return { rows: Array.isArray(root.items) ? root.items : [], totalCount: num(root.total_count) }; } }); return { rows: response.data.rows, totalCount: response.data.totalCount, page: parsed.page, pageSize: parsed.limit, hasMore: response.data.totalCount == null ? response.data.rows.length === parsed.limit : offset + response.data.rows.length < response.data.totalCount, cached: response.cached }; }
export async function listAlphaSeoBacklinks(input: unknown) { return listRows(input, "rows"); }
export async function listAlphaSeoReferringDomains(input: unknown) { return listRows(input, "domains"); }
export async function listAlphaSeoTopPages(input: unknown) { return listRows(input, "pages"); }
