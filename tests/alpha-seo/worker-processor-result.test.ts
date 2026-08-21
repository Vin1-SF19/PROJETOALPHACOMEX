import { describe, expect, it } from "vitest";
import { classifyAlphaSeoProcessorResult } from "@/lib/alpha-seo/jobs/processor-result";
import { rankRunRetryError } from "@/lib/alpha-seo/rank-tracking/contracts";

describe("Alpha SEO worker processor disposition", () => {
  it("never converts a busy lease skip into success", () => {
    expect(
      classifyAlphaSeoProcessorResult({
        skipped: true,
        retryable: true,
        delayMs: 30_000,
      }),
    ).toEqual({ kind: "defer", delayMs: 30_000 });
  });

  it("only completes skipped work when the processor marks it terminal", () => {
    expect(classifyAlphaSeoProcessorResult({ skipped: true })).toEqual({ kind: "invalid" });
    expect(
      classifyAlphaSeoProcessorResult({ skipped: true, terminal: true }),
    ).toEqual({ kind: "complete" });
  });

  it("preserves queued-provider deferrals", () => {
    expect(
      classifyAlphaSeoProcessorResult({ deferred: true, delayMs: 240_000 }),
    ).toEqual({ kind: "defer", delayMs: 240_000 });
  });

  it("requires retry when a provider produced zero snapshots", () => {
    expect(rankRunRetryError(0, "DATAFORSEO_UNAVAILABLE")).toBe(
      "DATAFORSEO_UNAVAILABLE",
    );
    expect(rankRunRetryError(0, null)).toBe(
      "RANK_PROVIDER_RETURNED_NO_RESULTS",
    );
    expect(rankRunRetryError(1, "partial")).toBeNull();
  });
});
