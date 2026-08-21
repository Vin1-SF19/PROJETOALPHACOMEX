import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estimateAlphaSeoProviderCost } from "@/lib/alpha-seo/dataforseo/operations";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("Alpha SEO paid operation governance", () => {
  it("requires explicit approval when a metrics refresh exceeds 200 keywords", () => {
    expect(estimateAlphaSeoProviderCost("SAVED_KEYWORD_METRICS", 200).approvalRequired).toBe(false);
    expect(estimateAlphaSeoProviderCost("SAVED_KEYWORD_METRICS", 201).approvalRequired).toBe(true);
    expect(estimateAlphaSeoProviderCost("RANK_KEYWORD_METRICS", 201).approvalRequired).toBe(true);
  });

  it("routes Lighthouse through the central executor and exposes audit cost review", () => {
    const provider = source("src/lib/alpha-seo/lighthouse/provider.ts");
    const audit = source("src/lib/alpha-seo/audit/service.ts");
    const actions = source("src/actions/AlphaSeoAudit.ts");
    expect(provider).toContain("executeAlphaSeoDataForSeo");
    expect(provider).not.toContain("https://api.dataforseo.com");
    expect(audit).toContain("assertAlphaSeoProviderCostApproved");
    expect(actions).toContain("EstimarCustoAuditoriaAlphaSeo");
    expect(actions).toContain("AprovarCustoAuditoriaAlphaSeo");
  });

  it("keeps rank suggestions and metrics out of the direct rank provider", () => {
    const provider = source("src/lib/alpha-seo/rank-tracking/provider.ts");
    const service = source("src/lib/alpha-seo/rank-tracking/service.ts");
    const contracts = source("src/lib/alpha-seo/rank-tracking/contracts.ts");
    expect(provider).not.toContain("keyword_suggestions/live");
    expect(provider).not.toContain("keyword_overview/live");
    expect(service).toContain('operation: "RANK_SUGGESTIONS"');
    expect(service).toContain('operation: "RANK_KEYWORD_METRICS"');
    expect(contracts).not.toMatch(/approveRankCostSchema[\s\S]{0,300}estimatedMicrosUsd/);
  });

  it("requires a server-derived Saved Keywords plan before batches run", () => {
    const service = source("src/lib/alpha-seo/saved-keywords/service.ts");
    const actions = source("src/actions/AlphaSeoSavedKeywords.ts");
    expect(service).toContain("buildSavedKeywordMetricsPlan");
    expect(service).toContain('assertAlphaSeoProviderCostApproved(access, "SAVED_KEYWORD_METRICS"');
    expect(service).toContain('approval: { operation: "SAVED_KEYWORD_METRICS"');
    expect(actions).toContain("EstimarCustoMetricasPalavrasChaveAlphaSeo");
    expect(actions).toContain("AprovarCustoMetricasPalavrasChaveAlphaSeo");
  });

  it("persists real provider cost and scopes idempotency to the cache window", () => {
    const operations = source("src/lib/alpha-seo/dataforseo/operations.ts");
    expect(operations).toContain("actualMicrosUsd = Math.round(provider.costUsd * 1_000_000)");
    expect(operations).toContain("cacheWindow");
    expect(operations).toContain('operation: "DATAFORSEO_REQUEST_MUTEX"');
  });
});
