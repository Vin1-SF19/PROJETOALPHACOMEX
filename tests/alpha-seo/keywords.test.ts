import { describe, expect, it } from "vitest";
import {
  dedupeKeywordRows,
  mapDataForSeoKeywordItems,
  normalizeKeyword,
} from "@/lib/alpha-seo/keywords/mappers";
import { keywordResearchInputSchema } from "@/lib/alpha-seo/keywords/schemas";

describe("Alpha SEO keyword research", () => {
  it("enforces the source 200-seed limit", () =>
    expect(() =>
      keywordResearchInputSchema.parse({
        projectId: "p",
        keywords: Array.from({ length: 201 }, (_, i) => `k${i}`),
      }),
    ).toThrow());
  it("maps, normalizes and deduplicates provider rows", () => {
    const rows = mapDataForSeoKeywordItems(
      [
        {
          items: [
            {
              keyword_data: {
                keyword: " SEO  Local ",
                keyword_info: { search_volume: 20, cpc: 1.5 },
                keyword_properties: { keyword_difficulty: 30 },
              },
            },
            {
              keyword_data: {
                keyword: "seo local",
                keyword_info: { search_volume: 50 },
              },
            },
          ],
        },
      ],
      "ideas",
    );
    expect(normalizeKeyword(" SEO  Local ")).toBe("seo local");
    expect(dedupeKeywordRows(rows, 10)).toMatchObject([
      { keyword: "seo local", searchVolume: 50 },
    ]);
  });
});
