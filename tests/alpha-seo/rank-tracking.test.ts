import { describe, expect, it } from "vitest";
import { computeNextRankCheckAt, createRankConfigSchema, estimateRankCost, normalizeRankDomain, normalizeRankKeyword, rankRequestHash } from "@/lib/alpha-seo/rank-tracking/contracts";

describe("Alpha SEO rank tracking contracts", () => {
  it("normaliza dominio/keyword e valida profundidade", () => {
    expect(normalizeRankDomain("https://WWW.Example.COM/path?q=1")).toBe("example.com");
    expect(normalizeRankKeyword("  Frete   Internacional ")).toBe("frete internacional");
    expect(createRankConfigSchema.safeParse({ projectId: "p", domain: "example.com", serpDepth: 15 }).success).toBe(false);
  });

  it("estima keyword x device x profundidade e gera hash deterministico", () => {
    expect(estimateRankCost({ keywordCount: 10, devices: "BOTH", serpDepth: 20 })).toEqual({ estimatedUnits: 20, estimatedMicrosUsd: 84_000 });
    expect(rankRequestHash({ b: 2, a: 1 })).toBe(rankRequestHash({ a: 1, b: 2 }));
  });

  it("avanca do anchor sem drift quando a execucao atrasou", () => {
    const anchor = new Date("2026-08-03T05:30:00.000Z");
    const now = new Date("2026-08-20T12:00:00.000Z");
    expect(computeNextRankCheckAt("WEEKLY", anchor, now).toISOString()).toBe("2026-08-24T05:30:00.000Z");
    expect(computeNextRankCheckAt("DAILY", anchor, now).toISOString()).toBe("2026-08-21T05:30:00.000Z");
  });
});
