import { describe, expect, it } from "vitest";
import {
  buildUrlPrefixFilter,
  normalizeSeoTarget,
} from "@/lib/alpha-seo/dataforseo/target";
describe("Alpha SEO domain scopes", () => {
  it("supports exact, subfolder, domain and subdomains", () => {
    expect(
      normalizeSeoTarget("https://www.example.com/a", "exact_url").apiTarget,
    ).toBe("https://example.com/a");
    expect(normalizeSeoTarget("example.com/folder", "subfolder").path).toBe(
      "/folder",
    );
    expect(normalizeSeoTarget("example.com", "domain").includeSubdomains).toBe(
      false,
    );
    expect(
      normalizeSeoTarget("example.com", "subdomains").includeSubdomains,
    ).toBe(true);
  });
  it("builds provider prefix filters for subfolder", () =>
    expect(
      buildUrlPrefixFilter(
        "url",
        normalizeSeoTarget("example.com/docs", "subfolder"),
      ),
    ).toEqual(["url", "like", "%://example.com/docs%"]));
});
