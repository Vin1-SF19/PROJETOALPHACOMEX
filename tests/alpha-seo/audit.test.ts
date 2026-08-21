import { describe, expect, it } from "vitest";
import { ALPHA_SEO_AUDIT_ISSUES, runMultipageAuditIssues, runPageAuditIssues, type AuditedPage } from "@/lib/alpha-seo/audit/issues";

const base = (overrides: Partial<AuditedPage> = {}): AuditedPage => ({
  id: "p", url: "https://badseo.dev/", statusCode: 200, redirectUrl: null, title: "A valid and unique page title", metaDescription: "A useful and unique meta description that is comfortably long enough for a normal search result snippet.", canonicalUrl: null, headerCanonicalUrl: null, robotsMeta: null, xRobotsTag: null, h1Count: 1, headingOrder: [1, 2], wordCount: 300, imagesTotal: 0, imagesMissingAlt: 0, internalLinks: ["https://badseo.dev/next"], externalLinkCount: 0, isIndexable: true, crawlDepth: 0, inSitemap: false, contentHash: "unique", fetchClass: "OK", responseTimeMs: 100, isHtml: true, ...overrides,
});

describe("Alpha SEO audit issue registry", () => {
  it("mantem exatamente os 27 issue IDs autoritativos", () => {
    expect(Object.keys(ALPHA_SEO_AUDIT_ISSUES)).toHaveLength(27);
  });

  it("fixtures badseo/mocks cobrem todos os 27 reporters", () => {
    const pages: AuditedPage[] = [
      base({ id: "blocked", url: "https://badseo.dev/blocked", fetchClass: "BLOCKED", statusCode: 403 }),
      base({ id: "server", url: "https://badseo.dev/server", statusCode: 500 }),
      base({ id: "broken", url: "https://badseo.dev/broken", statusCode: 404, inSitemap: true }),
      base({ id: "missing", url: "https://badseo.dev/missing", title: null, metaDescription: null, h1Count: 0, wordCount: 10, internalLinks: [], externalLinkCount: 0, imagesTotal: 2, imagesMissingAlt: 1 }),
      base({ id: "long", url: "https://badseo.dev/long", title: "L".repeat(61), metaDescription: "M".repeat(161), h1Count: 2, headingOrder: [1, 3], isIndexable: false, robotsMeta: "noindex", canonicalUrl: "https://badseo.dev/canonical", headerCanonicalUrl: "https://badseo.dev/other", crawlDepth: 5, responseTimeMs: 1_501 }),
      base({ id: "short", url: "https://badseo.dev/short", title: "Short", metaDescription: "Too short", contentHash: "short" }),
      base({ id: "dup1", url: "https://badseo.dev/dup1", title: "Duplicate page title here", metaDescription: "Duplicate description long enough to pass the single page length reporter and trigger cross-page duplicate checks.", contentHash: "same" }),
      base({ id: "dup2", url: "https://badseo.dev/dup2", title: "Duplicate page title here", metaDescription: "Duplicate description long enough to pass the single page length reporter and trigger cross-page duplicate checks.", contentHash: "same", inSitemap: true }),
      base({ id: "r1", url: "https://badseo.dev/r1", statusCode: 301, redirectUrl: "https://badseo.dev/r2", isHtml: false }),
      base({ id: "r2", url: "https://badseo.dev/r2", statusCode: 302, redirectUrl: "https://badseo.dev/end", isHtml: false }),
      base({ id: "loop", url: "https://badseo.dev/loop", statusCode: 301, redirectUrl: "https://badseo.dev/loop", isHtml: false }),
      base({ id: "linker", url: "https://badseo.dev/linker", internalLinks: ["https://badseo.dev/broken"] }),
    ];
    const detected = [...pages.flatMap(runPageAuditIssues), ...runMultipageAuditIssues(pages, "https://badseo.dev/", true)];
    const ids = new Set(detected.map((issue) => issue.issueType));
    expect([...ids].sort()).toEqual(Object.keys(ALPHA_SEO_AUDIT_ISSUES).sort());
  });
});
