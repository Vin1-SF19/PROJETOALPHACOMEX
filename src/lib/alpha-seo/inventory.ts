import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".jsonc", ".md", ".html"]);

const manifestEntrySchema = z.object({
  file: z.string().min(1),
  name: z.string().min(1),
});

export const alphaSeoSourceManifestSchema = z.object({
  manifestVersion: z.literal(2),
  capturedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.object({
    label: z.literal("local-source/open-seo-main"),
    basename: z.literal("open-seo-main"),
    absolutePathRedacted: z.literal(true),
    hashAlgorithm: z.literal("sha256"),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    hashedFiles: z.number().int().positive(),
  }),
  counts: z.object({
    routes: z.number().int().nonnegative(),
    serverFunctionFiles: z.number().int().nonnegative(),
    serverFunctionExports: z.number().int().nonnegative(),
    mcpRegisteredTools: z.number().int().nonnegative(),
    skills: z.number().int().nonnegative(),
    auditIssueIds: z.number().int().nonnegative(),
    tests: z.number().int().nonnegative(),
    functionalSchemas: z.number().int().nonnegative(),
    jobsAndCron: z.number().int().nonnegative(),
    exportsAndSettings: z.number().int().nonnegative(),
  }),
  routes: z.array(manifestEntrySchema),
  serverFunctions: z.array(z.object({ file: z.string(), exports: z.array(z.string()) })),
  mcp: z.object({
    registeredTools: z.array(z.object({ symbol: z.string(), name: z.string(), file: z.string() })),
    reconciliation: z.object({
      source: z.literal(46),
      ported: z.number().int().nonnegative(),
      missing: z.array(z.string()),
      unexpected: z.array(z.string()),
      parity: z.string(),
      status: z.enum(["source-authoritative-pass", "source-contract-drift"]),
      historicalClaim: z.literal(48),
      historicalUnnamedGap: z.literal(2),
      historicalGapBlocking: z.literal(false),
      note: z.string(),
    }),
  }),
  skills: z.array(manifestEntrySchema),
  skillReconciliation: z.object({ scoutClaim: z.literal(8), actual: z.number(), status: z.literal("source-registry-authoritative") }),
  auditIssueIds: z.array(z.string()),
  auditIssueReconciliation: z.object({ scoutClaim: z.literal(26), actual: z.number(), status: z.literal("source-registry-authoritative") }),
  jobsAndCron: z.array(z.object({ name: z.string(), schedule: z.string().optional(), file: z.string() })),
  functionalSchemas: z.array(z.object({ file: z.string(), exports: z.array(z.string()) })),
  tests: z.array(z.string()),
  exportsAndSettings: z.array(z.string()),
  exclusions: z.array(z.object({ category: z.string(), disposition: z.enum(["infra-substituted", "explicitly-non-seo"]), reason: z.string() })),
});

export type AlphaSeoSourceManifest = z.infer<typeof alphaSeoSourceManifestSchema>;

// Frozen from the 46 explicit `register(...)` calls in the supplied checkout.
// This named set, not the historical unnamed count of 48, is the executable
// source contract. A removed/renamed registration is therefore detectable.
export const OPEN_SEO_MCP_SOURCE_TOOL_NAMES = [
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

export function reconcileMcpSourceTools(portedNames: readonly string[]) {
  const expected = new Set<string>(OPEN_SEO_MCP_SOURCE_TOOL_NAMES);
  const ported = new Set(portedNames);
  const missing = [...expected].filter((name) => !ported.has(name)).sort();
  const unexpected = [...ported].filter((name) => !expected.has(name)).sort();
  const pass = missing.length === 0 && unexpected.length === 0 && ported.size === OPEN_SEO_MCP_SOURCE_TOOL_NAMES.length;
  return {
    source: 46 as const,
    ported: ported.size,
    missing,
    unexpected,
    parity: `${ported.size}/46`,
    status: pass ? "source-authoritative-pass" as const : "source-contract-drift" as const,
    historicalClaim: 48 as const,
    historicalUnnamedGap: 2 as const,
    historicalGapBlocking: false as const,
    note: pass
      ? "All 46 named registrations from the executable source registry are present. The historical unnamed 48−46 gap is informational only."
      : `Named source contract drift: ${missing.length} missing and ${unexpected.length} unexpected registration(s).`,
  };
}

function portable(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join("/");
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const output: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if ([".git", "node_modules", "dist", ".wrangler"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(absolute));
    else if (!entry.name.startsWith(".env")) output.push(absolute);
  }
  return output;
}

async function existingFiles(root: string): Promise<string[]> {
  const candidates = ["src", "plugins/openseo/skills", "package.json", "wrangler.jsonc"];
  const output: string[] = [];
  for (const candidate of candidates) {
    const absolute = path.join(root, candidate);
    const stat = await fs.stat(absolute).catch(() => null);
    if (!stat) continue;
    output.push(...(stat.isDirectory() ? await walk(absolute) : [absolute]));
  }
  return output.sort((a, b) => portable(root, a).localeCompare(portable(root, b)));
}

function exportedValues(source: string): string[] {
  const values = new Set<string>();
  const pattern = /^export\s+(?:default\s+)?(?:async\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const match of source.matchAll(pattern)) values.add(match[1]);
  return [...values].sort();
}

function toolNameForSymbol(source: string, symbol: string): string | null {
  const start = source.search(new RegExp(`export\\s+const\\s+${symbol}\\b`));
  if (start < 0) return null;
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\nexport\s+(?:const|function|class)\s+/);
  const block = next < 0 ? rest : rest.slice(0, next + 1);
  const direct = block.match(/\bname\s*:\s*["']([^"']+)["']/)?.[1];
  if (direct) return direct;
  const factory = block.match(new RegExp(`export\\s+const\\s+${symbol}\\s*=\\s*([A-Za-z_$][\\w$]*)\\(`))?.[1];
  if (!factory) return null;
  const factoryStart = source.search(new RegExp(`(?:export\\s+)?function\\s+${factory}\\b`));
  return factoryStart < 0 ? null : source.slice(factoryStart).match(/\bname\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
}

export async function buildAlphaSeoSourceManifest(sourceRoot: string): Promise<AlphaSeoSourceManifest> {
  const basename = path.basename(path.resolve(sourceRoot));
  if (basename !== "open-seo-main") throw new Error("Source root must resolve to the open-seo-main checkout");
  const files = await existingFiles(sourceRoot);
  if (files.length === 0) throw new Error("OpenSEO source checkout is empty or unavailable");

  const contents = new Map<string, string>();
  const hash = createHash("sha256");
  for (const file of files) {
    const relative = portable(sourceRoot, file);
    const bytes = await fs.readFile(file);
    hash.update(relative).update("\0").update(bytes).update("\0");
    if (textExtensions.has(path.extname(file).toLowerCase())) contents.set(relative, bytes.toString("utf8"));
  }

  const routes: Array<{ file: string; name: string }> = [];
  for (const [file, source] of contents) {
    if (!file.startsWith("src/routes/")) continue;
    for (const match of source.matchAll(/createFileRoute\(\s*["']([^"']+)["']\s*,?\s*\)/g)) routes.push({ file, name: match[1] });
    if (file === "src/routes/__root.tsx" && /createRootRoute/.test(source)) routes.push({ file, name: "<root-route>" });
  }
  routes.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));

  const serverFunctions = [...contents]
    .filter(([file]) => /^src\/serverFunctions\/[^/]+\.(?:ts|tsx)$/.test(file))
    .map(([file, source]) => ({ file, exports: exportedValues(source) }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const mcpServer = contents.get("src/server/mcp/server.ts") ?? "";
  const registeredSymbols = [...mcpServer.matchAll(/\bregister\(\s*([A-Za-z_$][\w$]*)\s*\);/g)].map((match) => match[1]);
  const toolFiles = [...contents].filter(([file]) => file.startsWith("src/server/mcp/tools/") && !file.includes(".test.") && !file.includes(".spec."));
  if (new Set(registeredSymbols).size !== registeredSymbols.length) throw new Error("Duplicate MCP registration symbol in source registry");
  const registeredTools = registeredSymbols.map((symbol) => {
    for (const [file, source] of toolFiles) {
      const name = toolNameForSymbol(source, symbol);
      if (name) return { symbol, name, file };
    }
    throw new Error(`MCP registration ${symbol} has no named source definition`);
  });
  const registeredNames = registeredTools.map((tool) => tool.name);
  if (new Set(registeredNames).size !== registeredNames.length) throw new Error("Duplicate MCP tool name in source registry");
  const mcpReconciliation = reconcileMcpSourceTools(registeredNames);

  const skills: Array<{ file: string; name: string }> = [];
  for (const [file, source] of contents) {
    if (!/^plugins\/openseo\/skills\/[^/]+\/SKILL\.md$/.test(file)) continue;
    const declared = source.match(/^name:\s*["']?([^\r\n"']+)/m)?.[1]?.trim();
    skills.push({ file, name: declared || file.split("/").at(-2) || file });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));

  const auditSource = contents.get("src/shared/audit-issues.ts") ?? "";
  const registryBlock = auditSource.match(/AUDIT_ISSUE_TYPES\s*=\s*\{([\s\S]*?)\}\s*as const/)?.[1] ?? "";
  const auditIssueIds = [...registryBlock.matchAll(/^\s*["']([^"']+)["']\s*:\s*\{/gm)].map((match) => match[1]).sort();

  const jobsAndCron: Array<{ name: string; schedule?: string; file: string }> = [];
  const wrangler = contents.get("wrangler.jsonc") ?? "";
  for (const match of wrangler.matchAll(/"name"\s*:\s*"([^"]+-workflow)"[\s\S]*?"class_name"\s*:\s*"([^"]+)"/g)) {
    jobsAndCron.push({ name: `${match[1]}:${match[2]}`, file: "wrangler.jsonc" });
  }
  const cronList = wrangler.match(/"crons"\s*:\s*\[([^\]]+)\]/)?.[1] ?? "";
  for (const match of cronList.matchAll(/"([^"]+)"/g)) jobsAndCron.push({ name: `scheduled-handler:${match[1]}`, schedule: match[1], file: "src/server.ts" });
  for (const name of ["runScheduledRankChecks", "reconcileStaleAudits", "purgeExpiredData"]) {
    if ((contents.get("src/server.ts") ?? "").includes(name)) jobsAndCron.push({ name, file: "src/server.ts" });
  }
  jobsAndCron.sort((a, b) => a.name.localeCompare(b.name));

  const functionalSchemas = [...contents]
    .filter(([file]) => (file.startsWith("src/types/schemas/") || file.startsWith("src/db/")) && /(?:schema|Schema)/.test(file))
    .filter(([file]) => !file.includes(".test.") && !file.includes(".spec."))
    .map(([file, source]) => ({ file, exports: exportedValues(source).filter((name) => file.startsWith("src/db/") || /schema/i.test(name)) }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const tests = files.map((file) => portable(sourceRoot, file)).filter((file) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)).sort();
  const exportsAndSettings = files.map((file) => portable(sourceRoot, file)).filter((file) => {
    if (!file.startsWith("src/")) return false;
    return /(?:^|\/)(?:exports?|settings)(?:\/|\.|-)|(?:Export|Settings|exportToSheets)/.test(file);
  }).sort();

  return alphaSeoSourceManifestSchema.parse({
    manifestVersion: 2,
    capturedOn: process.env.ALPHA_SEO_INVENTORY_DATE ?? "2026-08-20",
    source: { label: "local-source/open-seo-main", basename: "open-seo-main", absolutePathRedacted: true, hashAlgorithm: "sha256", hash: hash.digest("hex"), hashedFiles: files.length },
    counts: {
      routes: routes.length,
      serverFunctionFiles: serverFunctions.length,
      serverFunctionExports: serverFunctions.reduce((sum, entry) => sum + entry.exports.length, 0),
      mcpRegisteredTools: registeredTools.length,
      skills: skills.length,
      auditIssueIds: auditIssueIds.length,
      tests: tests.length,
      functionalSchemas: functionalSchemas.length,
      jobsAndCron: jobsAndCron.length,
      exportsAndSettings: exportsAndSettings.length,
    },
    routes,
    serverFunctions,
    mcp: {
      registeredTools,
      reconciliation: mcpReconciliation,
    },
    skills,
    skillReconciliation: { scoutClaim: 8, actual: skills.length, status: "source-registry-authoritative" },
    auditIssueIds,
    auditIssueReconciliation: { scoutClaim: 26, actual: auditIssueIds.length, status: "source-registry-authoritative" },
    jobsAndCron,
    functionalSchemas,
    tests,
    exportsAndSettings,
    exclusions: [
      { category: "independent-auth-and-workspaces", disposition: "infra-substituted", reason: "NextAuth v5 and project-scoped Alpha authorization replace Better Auth organization hosting." },
      { category: "hosted-billing-and-checkout", disposition: "infra-substituted", reason: "Internal cost estimation and approval replace hosted checkout and plan gates." },
      { category: "cloudflare-deployment", disposition: "infra-substituted", reason: "Painel Alpha runtime, jobs, cache and locks replace Cloudflare-specific hosting." },
      { category: "marketing-pricing-support-release-pages", disposition: "explicitly-non-seo", reason: "Product marketing and release surfaces are not internal SEO capabilities." },
    ],
  });
}

export function serializeAlphaSeoManifest(manifest: AlphaSeoSourceManifest): string {
  return `${JSON.stringify(alphaSeoSourceManifestSchema.parse(manifest), null, 2)}\n`;
}
