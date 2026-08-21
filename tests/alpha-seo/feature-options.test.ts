import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Alpha SEO advanced feature options", () => {
  const consoleSource = readFileSync(
    resolve("src/components/AlphaSEO/shared/FeatureConsole.tsx"),
    "utf8",
  );
  const aiSource = readFileSync(
    resolve("src/lib/alpha-seo/ai-visibility/service.ts"),
    "utf8",
  );

  it("exposes keyword modes, limits, clickstream and market", () => {
    for (const token of [
      'value="related"',
      'value="suggestions"',
      'value="ideas"',
      "resultLimit",
      "clickstream",
      "locationCode",
      "languageCode",
    ]) {
      expect(consoleSource).toContain(token);
    }
  });

  it("exposes audit size and Lighthouse strategy", () => {
    expect(consoleSource).toContain("auditPages");
    expect(consoleSource).toContain("lighthouseStrategy");
    expect(consoleSource).toContain('value="NONE"');
  });

  it("preserves brand domain, competitors, country and web search in the AI contract", () => {
    for (const token of ["brandName", "competitors", "webSearch", "country", "domain"]) {
      expect(consoleSource).toContain(token);
    }
    expect(aiSource).toContain("country: z.string()");
    expect(aiSource).toContain("domain: z.string()");
  });
});
