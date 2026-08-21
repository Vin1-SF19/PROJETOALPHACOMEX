import { describe, expect, it } from "vitest";
import { normalizeSeoTarget } from "@/lib/alpha-seo/dataforseo/target";
describe("Alpha SEO backlink targeting", () => {
  it("rejects query strings for exact URLs", () =>
    expect(() =>
      normalizeSeoTarget("https://example.com/a?x=1", "exact_url"),
    ).toThrow());
});
