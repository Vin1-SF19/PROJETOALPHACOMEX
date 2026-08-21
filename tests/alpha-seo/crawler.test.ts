import { describe, expect, it } from "vitest";
import { analyzeAuditResponse } from "@/lib/alpha-seo/crawler/html";
import { parseRobotsTxt } from "@/lib/alpha-seo/crawler/robots";

describe("Alpha SEO crawler parser", () => {
  it("extrai sinais SEO da fixture badseo em memoria", () => {
    const html = `<!doctype html><html><head><title>BadSEO fixture page title</title><meta name="description" content="A sufficiently long fixture description used to validate extraction without network calls in the crawler test suite."><meta name="robots" content="noindex"><link rel="canonical" href="/canonical"><meta property="og:title" content="OG"><script type="application/ld+json">{}</script></head><body><h1>Main</h1><h3>Skipped</h3><img src="/a.png"><img src="/decorative.png" alt=""><a href="/inside">Inside</a><a href="https://other.test/out">Outside</a></body></html>`;
    const page = analyzeAuditResponse({ pageId: "p", origin: "https://example.com", depth: 2, inSitemap: true, url: "https://example.com/page", status: 200, headers: new Headers({ "content-type": "text/html", "x-robots-tag": "follow" }), body: html, bytes: html.length, responseTimeMs: 25, redirectUrl: null });
    expect(page.title).toBe("BadSEO fixture page title");
    expect(page.canonicalUrl).toBe("https://example.com/canonical");
    expect(page.headingOrder).toEqual([1, 3]);
    expect(page.imagesMissingAlt).toBe(1);
    expect(page.internalLinks).toEqual(["https://example.com/inside"]);
    expect(page.externalLinkCount).toBe(1);
    expect(page.isIndexable).toBe(false);
    expect(page.hasStructuredData).toBe(true);
  });

  it("respeita allow/disallow mais especifico", () => {
    const robots = parseRobotsTxt("https://example.com", "User-agent: *\nDisallow: /private\nAllow: /private/public\nSitemap: /sitemap.xml");
    expect(robots.isAllowed("https://example.com/private/a")).toBe(false);
    expect(robots.isAllowed("https://example.com/private/public/a")).toBe(true);
    expect(robots.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });
});
