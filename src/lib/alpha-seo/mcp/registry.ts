import { z } from "zod";
import type { AlphaSeoMcpToolDefinition } from "./types";

export const ALPHA_SEO_MCP_TOOL_NAMES = [
  "whoami",
  "list_projects",
  "create_project",
  "get_project_context",
  "update_project_context",
  "list_saved_keywords",
  "research_keywords",
  "save_keywords",
  "get_domain_overview",
  "get_domain_keyword_suggestions",
  "get_backlinks_overview",
  "get_backlinks_profile",
  "get_serp_results",
  "create_rank_tracker",
  "get_rank_tracker",
  "add_rank_tracking_keywords",
  "remove_rank_tracking_keywords",
  "estimate_rank_tracker_cost",
  "run_rank_tracker",
  "get_ranked_keywords",
  "find_serp_competitors",
  "search_local_businesses",
  "get_local_serp_results",
  "get_google_business_questions",
  "get_business_profile",
  "get_business_reviews",
  "get_business_updates",
  "list_business_categories",
  "get_local_rank_grid",
  "get_keyword_metrics",
  "get_search_console_performance",
  "inspect_urls",
  "get_google_analytics_organic_landing_pages",
  "get_google_analytics_page_performance",
  "get_google_analytics_key_events",
  "get_search_opportunities",
  "get_google_analytics_organic_overview",
  "get_google_analytics_traffic_acquisition",
  "get_google_analytics_measurement_health",
  "get_google_analytics_ecommerce_performance",
  "get_google_analytics_site_search",
  "get_google_analytics_audience_breakdown",
  "run_site_audit",
  "get_audit_status",
  "get_audit_issues",
  "get_audit_pages",
] as const;

export type AlphaSeoMcpToolName = (typeof ALPHA_SEO_MCP_TOOL_NAMES)[number];

const projectId = z.string().trim().min(1).max(100).describe("ID do projeto Alpha SEO autorizado.");
const locationCode = z.number().int().positive().optional();
const languageCode = z.string().trim().min(2).max(8).optional();
const responseFormat = z.enum(["json", "markdown"]).default("json");
const scope = z.enum(["domain", "subdomains", "subfolder", "exact"]).default("domain");
const page = z.number().int().min(1).default(1);
const limit = z.number().int().min(1).max(200).default(50);
const approvedCost = z.number().int().nonnegative().optional().describe("Teto em micros de USD explicitamente aprovado pelo usuário quando a estimativa exigir confirmação.");
const commonOutput = z
  .object({
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    meta: z.object({ tool: z.string(), authKind: z.string(), projectId: z.string().nullable(), truncated: z.boolean().optional() }).strict(),
  })
  .strict();

const empty = z.object({}).strict();
const projectRead = z.object({ projectId, responseFormat }).strict();
const projectList = z.object({ archived: z.boolean().default(false), search: z.string().trim().max(200).optional(), page, limit }).strict();
const createProject = z.object({ name: z.string().trim().min(1).max(120), domain: z.string().trim().max(255).optional(), locationCode, languageCode, locationName: z.string().trim().max(200).optional(), market: z.string().trim().min(2).max(8).default("BR") }).strict();
const memoryUpdate = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("upsertSection"), key: z.string().regex(/^[a-z0-9_-]{2,60}$/), title: z.string().max(100).nullable().optional(), content: z.string().min(1).max(20_000) }).strict(),
  z.object({ kind: z.literal("deleteSection"), key: z.string().regex(/^[a-z0-9_-]{2,60}$/) }).strict(),
  z.object({ kind: z.literal("upsertCompetitor"), domain: z.string().min(1).max(253), name: z.string().max(200).nullable().optional(), notes: z.string().max(5_000).nullable().optional() }).strict(),
  z.object({ kind: z.literal("deleteCompetitor"), domain: z.string().min(1).max(253) }).strict(),
  z.object({ kind: z.literal("upsertKeyPage"), url: z.string().url().max(2_048), role: z.enum(["HUB", "SPOKE", "MONEY", "OTHER"]), topic: z.string().max(300).nullable().optional(), notes: z.string().max(5_000).nullable().optional() }).strict(),
  z.object({ kind: z.literal("deleteKeyPage"), url: z.string().url().max(2_048) }).strict(),
  z.object({ kind: z.literal("appendResearch"), summary: z.string().min(1).max(5_000) }).strict(),
]);
const savedMetric = z.object({ keyword: z.string().trim().min(1).max(700), searchVolume: z.number().int().nonnegative().nullable().optional(), cpc: z.number().nonnegative().nullable().optional(), competition: z.number().min(0).max(1).nullable().optional(), keywordDifficulty: z.number().int().min(0).max(100).nullable().optional(), intent: z.string().max(64).nullable().optional(), monthlySearches: z.array(z.unknown()).max(120).optional() }).strict();
const targetBase = { projectId, target: z.string().trim().min(1).max(2_048), scope, responseFormat, approvedCostMicrosUsd: approvedCost } as const;
const market = { locationCode, languageCode } as const;
const localCoordinate = z.string().regex(/^-?\d{1,2}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?(?:,\d{1,5})?$/).describe("latitude,longitude[,radius_m]");
const dateRange = { startDate: z.string().date(), endDate: z.string().date() } as const;

const schemas: Record<AlphaSeoMcpToolName, z.ZodObject<z.ZodRawShape>> = {
  whoami: empty,
  list_projects: projectList,
  create_project: createProject,
  get_project_context: projectRead,
  update_project_context: z.object({ projectId, updates: z.array(memoryUpdate).min(1).max(25), responseFormat }).strict(),
  list_saved_keywords: z.object({ projectId, search: z.string().trim().max(200).optional(), includeTerms: z.array(z.string().trim().min(1).max(100)).max(20).default([]), excludeTerms: z.array(z.string().trim().min(1).max(100)).max(20).default([]), tagIds: z.array(z.string().min(1)).max(50).default([]), page, limit: z.union([z.literal(50), z.literal(100), z.literal(250)]).default(50), responseFormat }).strict(),
  research_keywords: z.object({ projectId, seeds: z.array(z.object({ seed: z.string().trim().min(1).max(700), ...market }).strict()).min(1).max(5), resultLimit: z.union([z.literal(150), z.literal(300), z.literal(500)]).default(150), includeClickstreamData: z.boolean().default(false), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  save_keywords: z.object({ projectId, keywords: z.array(z.string().trim().min(1).max(700)).min(1).max(500), metrics: z.array(savedMetric).max(500).default([]), tags: z.array(z.string().trim().min(1).max(64)).max(20).default([]), tagMode: z.enum(["append", "replace"]).default("append"), ...market, responseFormat }).strict(),
  get_domain_overview: z.object({ projectId, domain: z.string().min(1).max(2_048), scope, ...market, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_domain_keyword_suggestions: z.object({ projectId, domain: z.string().min(1).max(2_048), scope, ...market, limit, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_backlinks_overview: z.object({ ...targetBase, hideSpam: z.boolean().default(true) }).strict(),
  get_backlinks_profile: z.object({ ...targetBase, view: z.enum(["backlinks", "referring_domains", "pages"]).default("backlinks"), page, limit: z.union([z.literal(50), z.literal(100), z.literal(200)]).default(100), hideSpam: z.boolean().default(true), spamThreshold: z.number().min(0).max(100).default(40) }).strict(),
  get_serp_results: z.object({ projectId, keyword: z.string().trim().min(1).max(700), ...market, device: z.enum(["desktop", "mobile"]).default("desktop"), depth: z.number().int().min(10).max(100).default(100), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  create_rank_tracker: z.object({ projectId, domain: z.string().trim().max(2_048).optional(), ...market, locationName: z.string().trim().max(200).nullable().optional(), devices: z.enum(["desktop", "mobile", "both"]).default("mobile"), serpDepth: z.number().int().min(10).max(100).multipleOf(10).default(40), scheduleInterval: z.enum(["manual", "daily", "weekly", "monthly"]).default("manual"), responseFormat }).strict(),
  get_rank_tracker: z.object({ projectId, trackerId: z.string().min(1).max(100).optional(), compareDays: z.number().int().min(1).max(365).default(7), page, limit, responseFormat }).strict(),
  add_rank_tracking_keywords: z.object({ projectId, trackerId: z.string().min(1).max(100), keywords: z.array(z.string().trim().min(1).max(700)).min(1).max(2_000), maxEstimatedScheduledCheckCredits: z.number().int().positive().optional(), responseFormat }).strict(),
  remove_rank_tracking_keywords: z.object({ projectId, trackerId: z.string().min(1).max(100), keywordIds: z.array(z.string().min(1).max(100)).min(1).max(2_000), responseFormat }).strict(),
  estimate_rank_tracker_cost: z.object({ projectId, trackerId: z.string().min(1).max(100), additionalKeywordCount: z.number().int().min(0).max(1_000).default(0), responseFormat }).strict(),
  run_rank_tracker: z.object({ projectId, trackerId: z.string().min(1).max(100), maxCostCredits: z.number().int().positive(), responseFormat }).strict(),
  get_ranked_keywords: z.object({ projectId, target: z.string().min(1).max(2_048), ...market, page, limit, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  find_serp_competitors: z.object({ projectId, keywords: z.array(z.string().trim().min(1).max(700)).min(1).max(20), ...market, limit, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  search_local_businesses: z.object({ projectId, title: z.string().trim().min(1).max(300).optional(), categories: z.array(z.string().min(1).max(200)).max(20).default([]), locationCoordinate: localCoordinate, limit, offset: z.number().int().min(0).default(0), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_local_serp_results: z.object({ projectId, keyword: z.string().trim().min(1).max(700), locationCoordinate: localCoordinate, languageCode, depth: z.number().int().min(10).max(100).default(20), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_google_business_questions: z.object({ projectId, businessName: z.string().trim().min(1).max(300).optional(), cid: z.string().trim().min(1).max(100).optional(), placeId: z.string().trim().min(1).max(300).optional(), locationCoordinate: localCoordinate, languageCode, depth: z.number().int().min(1).max(100).default(20), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_business_profile: z.object({ projectId, businessName: z.string().trim().min(1).max(300), locationCoordinate: localCoordinate.optional(), locationCode, languageCode, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_business_reviews: z.object({ projectId, businessName: z.string().trim().min(1).max(300).optional(), cid: z.string().trim().min(1).max(100).optional(), placeId: z.string().trim().min(1).max(300).optional(), locationCoordinate: localCoordinate.optional(), locationCode, languageCode, depth: z.number().int().min(1).max(500).default(20), sortBy: z.string().max(100).optional(), includeOtherSources: z.boolean().default(false), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_business_updates: z.object({ projectId, businessName: z.string().trim().min(1).max(300), locationCoordinate: localCoordinate.optional(), locationCode, languageCode, depth: z.number().int().min(1).max(100).default(20), approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  list_business_categories: z.object({ projectId, search: z.string().trim().max(200).optional(), limit, offset: z.number().int().min(0).default(0), responseFormat }).strict(),
  get_local_rank_grid: z.object({ projectId, keyword: z.string().trim().min(1).max(700), target: z.string().trim().min(1).max(300), centerLatitude: z.number().min(-90).max(90), centerLongitude: z.number().min(-180).max(180), gridSize: z.union([z.literal(3), z.literal(5), z.literal(7)]).default(3), radiusKm: z.number().min(0.2).max(50).default(2), languageCode, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_keyword_metrics: z.object({ projectId, keywords: z.array(z.string().trim().min(1).max(700)).min(1).max(700), ...market, approvedCostMicrosUsd: approvedCost, responseFormat }).strict(),
  get_search_console_performance: z.object({ projectId, ...dateRange, dimensions: z.array(z.enum(["date", "query", "page", "country", "device", "searchAppearance"])).max(3).default(["date"]), filters: z.array(z.object({ dimension: z.enum(["query", "page", "country", "device"]), operator: z.enum(["equals", "notEquals", "contains", "notContains", "includingRegex", "excludingRegex"]), expression: z.string().min(1).max(1_000) }).strict()).max(20).default([]), rowLimit: z.number().int().min(1).max(25_000).default(1_000), startRow: z.number().int().min(0).default(0), responseFormat }).strict(),
  inspect_urls: z.object({ projectId, urls: z.array(z.string().url().max(2_048)).min(1).max(20), responseFormat }).strict(),
  get_google_analytics_organic_landing_pages: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_page_performance: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_key_events: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_search_opportunities: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_organic_overview: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_traffic_acquisition: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_measurement_health: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_ecommerce_performance: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_site_search: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  get_google_analytics_audience_breakdown: z.object({ projectId, ...dateRange, limit, responseFormat }).strict(),
  run_site_audit: z.object({ projectId, startUrl: z.string().trim().min(1).max(2_048), maxPages: z.number().int().min(10).max(10_000).default(50), lighthouseStrategy: z.enum(["AUTO", "NONE"]).default("AUTO"), responseFormat }).strict(),
  get_audit_status: z.object({ projectId, auditId: z.string().min(1).max(100), responseFormat }).strict(),
  get_audit_issues: z.object({ projectId, auditId: z.string().min(1).max(100), page, limit, issueType: z.string().min(1).max(100).optional(), severity: z.enum(["CRITICAL", "WARNING", "INFO"]).optional(), responseFormat }).strict(),
  get_audit_pages: z.object({ projectId, auditId: z.string().min(1).max(100), page, limit, responseFormat }).strict(),
};

const titles: Record<AlphaSeoMcpToolName, string> = {
  whoami: "Who am I", list_projects: "List projects", create_project: "Create project", get_project_context: "Get project context", update_project_context: "Update project context", list_saved_keywords: "List saved keywords", research_keywords: "Research keywords (bulk)", save_keywords: "Save keywords", get_domain_overview: "Get domain overview", get_domain_keyword_suggestions: "Get domain keyword opportunities", get_backlinks_overview: "Get backlinks overview", get_backlinks_profile: "Get backlinks profile", get_serp_results: "Get Google SERP results", create_rank_tracker: "Create rank tracker", get_rank_tracker: "Get rank tracker", add_rank_tracking_keywords: "Add rank tracking keywords", remove_rank_tracking_keywords: "Remove rank tracking keywords", estimate_rank_tracker_cost: "Estimate rank tracker cost", run_rank_tracker: "Run rank tracker", get_ranked_keywords: "Get ranked keywords", find_serp_competitors: "Find SERP competitors", search_local_businesses: "Search local businesses", get_local_serp_results: "Get local SERP results", get_google_business_questions: "Get Google business questions", get_business_profile: "Get business profile", get_business_reviews: "Get business reviews", get_business_updates: "Get business updates", list_business_categories: "List business categories", get_local_rank_grid: "Get local rank grid", get_keyword_metrics: "Get keyword metrics", get_search_console_performance: "Get Google Search Console performance", inspect_urls: "Inspect URLs in Google Search Console", get_google_analytics_organic_landing_pages: "Get Google Analytics organic landing pages", get_google_analytics_page_performance: "Get Google Analytics page performance", get_google_analytics_key_events: "Get Google Analytics key events", get_search_opportunities: "Get search opportunities", get_google_analytics_organic_overview: "Get Google Analytics organic overview", get_google_analytics_traffic_acquisition: "Get Google Analytics traffic acquisition", get_google_analytics_measurement_health: "Get Google Analytics measurement health", get_google_analytics_ecommerce_performance: "Get Google Analytics ecommerce performance", get_google_analytics_site_search: "Get Google Analytics site search", get_google_analytics_audience_breakdown: "Get Google Analytics audience breakdown", run_site_audit: "Run site audit", get_audit_status: "Get site audit status", get_audit_issues: "Get site audit issues", get_audit_pages: "Get site audit pages",
};

const editorTools = new Set<AlphaSeoMcpToolName>(["create_project", "update_project_context", "save_keywords", "create_rank_tracker", "add_rank_tracking_keywords", "remove_rank_tracking_keywords", "run_rank_tracker", "run_site_audit"]);
const destructiveTools = new Set<AlphaSeoMcpToolName>(["remove_rank_tracking_keywords"]);
const paidTools = new Set<AlphaSeoMcpToolName>(["research_keywords", "get_domain_overview", "get_domain_keyword_suggestions", "get_backlinks_overview", "get_backlinks_profile", "get_serp_results", "get_ranked_keywords", "find_serp_competitors", "search_local_businesses", "get_local_serp_results", "get_google_business_questions", "get_business_profile", "get_business_reviews", "get_business_updates", "get_local_rank_grid", "get_keyword_metrics", "run_rank_tracker", "run_site_audit"]);

export const alphaSeoMcpTools: AlphaSeoMcpToolDefinition[] = ALPHA_SEO_MCP_TOOL_NAMES.map((name) => ({
  name,
  title: titles[name],
  description: `${titles[name]}. Operação Alpha SEO project-scoped com validação estrita, resposta estruturada, paginação quando aplicável e erros acionáveis. ${paidTools.has(name) ? "Pode consultar provedor externo e registrar custo; operações acima do limiar exigem teto aprovado." : "Não envia segredos ao cliente."}`,
  inputSchema: schemas[name],
  outputSchema: commonOutput,
  requiredRole: editorTools.has(name) ? "EDITOR" : "VIEWER",
  annotations: {
    title: titles[name],
    readOnlyHint: !editorTools.has(name) && !paidTools.has(name),
    destructiveHint: destructiveTools.has(name),
    idempotentHint: !["create_project", "create_rank_tracker", "run_rank_tracker", "run_site_audit"].includes(name),
    openWorldHint: paidTools.has(name) || name.startsWith("get_google_") || name === "get_search_console_performance" || name === "inspect_urls",
  },
  execute: async (args, identity) => (await import("./tool-executor")).executeAlphaSeoMcpTool(name, args, identity),
}));
