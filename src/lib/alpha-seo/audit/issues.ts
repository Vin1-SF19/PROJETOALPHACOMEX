import { createHash } from "node:crypto";

export const ALPHA_SEO_AUDIT_ISSUES = {
  "blocked-page": "CRITICAL", "server-error": "CRITICAL", "broken-internal-link": "CRITICAL", "missing-title": "CRITICAL",
  "broken-page": "WARNING", "duplicate-title": "WARNING", "duplicate-meta-description": "WARNING", "duplicate-content": "WARNING",
  "missing-meta-description": "WARNING", "missing-h1": "WARNING", "multiple-h1": "WARNING", "redirect-chain": "WARNING",
  "redirect-loop": "WARNING", "canonical-conflict": "WARNING", "thin-content": "WARNING", "images-missing-alt": "WARNING",
  "orphan-page": "WARNING", "no-outgoing-links": "WARNING", "title-too-long": "INFO", "title-too-short": "INFO",
  "meta-description-too-long": "INFO", "meta-description-too-short": "INFO", "heading-order-skip": "INFO", "slow-response": "INFO",
  "noindex-page": "INFO", "canonicalized-page": "INFO", "deep-page": "INFO",
} as const;

export type AlphaSeoAuditIssueId = keyof typeof ALPHA_SEO_AUDIT_ISSUES;

export interface AuditedPage {
  id: string; url: string; statusCode: number | null; redirectUrl: string | null; title: string | null;
  metaDescription: string | null; canonicalUrl: string | null; headerCanonicalUrl: string | null;
  robotsMeta: string | null; xRobotsTag: string | null; h1Count: number; headingOrder: number[];
  wordCount: number; imagesTotal: number; imagesMissingAlt: number; internalLinks: string[]; externalLinkCount: number;
  isIndexable: boolean; crawlDepth: number | null; inSitemap: boolean; contentHash: string | null;
  fetchClass: "OK" | "BLOCKED" | "ERROR"; responseTimeMs: number | null; isHtml: boolean;
}

export interface DetectedAuditIssue { issueType: AlphaSeoAuditIssueId; pageId: string | null; pageUrl: string; details?: Record<string, unknown>; }

export function runPageAuditIssues(page: AuditedPage): DetectedAuditIssue[] {
  const issues: DetectedAuditIssue[] = [];
  const report = (issueType: AlphaSeoAuditIssueId, details?: Record<string, unknown>) => issues.push({ issueType, pageId: page.id, pageUrl: page.url, details });
  if (page.fetchClass === "BLOCKED") { report("blocked-page", { statusCode: page.statusCode }); return issues; }
  if (page.fetchClass === "ERROR") return issues;
  if ((page.statusCode ?? 0) >= 500) { report("server-error", { statusCode: page.statusCode }); return issues; }
  if ((page.statusCode ?? 0) >= 400) { report("broken-page", { statusCode: page.statusCode }); return issues; }
  if ((page.statusCode ?? 0) >= 300) return issues;
  if ((page.responseTimeMs ?? 0) > 1_500) report("slow-response", { responseTimeMs: page.responseTimeMs });
  if (!page.isHtml) return issues;
  if (!page.title) report("missing-title"); else if (page.title.length > 60) report("title-too-long", { length: page.title.length }); else if (page.title.length < 10) report("title-too-short", { length: page.title.length });
  if (!page.metaDescription) report("missing-meta-description"); else if (page.metaDescription.length > 160) report("meta-description-too-long", { length: page.metaDescription.length }); else if (page.metaDescription.length < 70) report("meta-description-too-short", { length: page.metaDescription.length });
  if (page.h1Count === 0) report("missing-h1"); else if (page.h1Count > 1) report("multiple-h1", { h1Count: page.h1Count });
  if (page.headingOrder.some((level, index, all) => index > 0 && level > all[index - 1] + 1)) report("heading-order-skip");
  if (!page.isIndexable) report("noindex-page", { robotsMeta: page.robotsMeta, xRobotsTag: page.xRobotsTag });
  if (page.canonicalUrl && page.headerCanonicalUrl && page.canonicalUrl !== page.headerCanonicalUrl) report("canonical-conflict", { htmlCanonical: page.canonicalUrl, headerCanonical: page.headerCanonicalUrl });
  const canonical = page.canonicalUrl ?? page.headerCanonicalUrl;
  if (canonical && canonical !== page.url) report("canonicalized-page", { canonicalUrl: canonical });
  if (page.isIndexable && page.wordCount < 150) report("thin-content", { wordCount: page.wordCount });
  if (page.imagesMissingAlt > 0) report("images-missing-alt", { imagesMissingAlt: page.imagesMissingAlt, imagesTotal: page.imagesTotal });
  if (page.isIndexable && page.internalLinks.length + page.externalLinkCount === 0) report("no-outgoing-links");
  if (page.crawlDepth !== null && page.crawlDepth >= 5) report("deep-page", { crawlDepth: page.crawlDepth });
  return issues;
}

export function runMultipageAuditIssues(pages: AuditedPage[], startUrl: string, crawlCompleted: boolean): DetectedAuditIssue[] {
  const issues: DetectedAuditIssue[] = [];
  const ok = pages.filter((page) => page.fetchClass === "OK" && (page.statusCode ?? 0) >= 200 && (page.statusCode ?? 0) < 300 && page.isIndexable && !(page.canonicalUrl && page.canonicalUrl !== page.url));
  for (const [field, issueType] of [["title", "duplicate-title"], ["metaDescription", "duplicate-meta-description"], ["contentHash", "duplicate-content"]] as const) {
    const groups = new Map<string, AuditedPage[]>();
    for (const page of ok) { const value = page[field]; if (!value) continue; const group = groups.get(value) ?? []; group.push(page); groups.set(value, group); }
    for (const group of groups.values()) if (group.length > 1) for (const page of group) issues.push({ issueType, pageId: page.id, pageUrl: page.url, details: { groupSize: group.length, otherUrls: group.filter((item) => item.id !== page.id).slice(0, 3).map((item) => item.url) } });
  }
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  for (const page of pages) {
    for (const target of page.internalLinks) {
      const targetPage = byUrl.get(target);
      if (targetPage && ((targetPage.statusCode ?? 0) >= 400 || targetPage.fetchClass === "ERROR")) issues.push({ issueType: "broken-internal-link", pageId: page.id, pageUrl: page.url, details: { targetUrl: target, targetStatus: targetPage.statusCode } });
    }
  }
  if (crawlCompleted) {
    const linked = new Set(pages.flatMap((page) => page.internalLinks));
    for (const page of pages) if (page.inSitemap && page.url !== startUrl && !linked.has(page.url)) issues.push({ issueType: "orphan-page", pageId: page.id, pageUrl: page.url });
  }
  issues.push(...findRedirectIssues(pages));
  return issues;
}

function findRedirectIssues(pages: AuditedPage[]): DetectedAuditIssue[] {
  const redirects = new Map(pages.filter((page) => page.redirectUrl && (page.statusCode ?? 0) >= 300 && (page.statusCode ?? 0) < 400).map((page) => [page.url, page]));
  const issues: DetectedAuditIssue[] = [];
  const walked = new Set<string>();
  for (const [url, page] of redirects) {
    if (walked.has(url)) continue;
    const hops = [url]; const seen = new Set(hops); let current = page.redirectUrl; let loop = false;
    while (current && redirects.has(current)) { if (seen.has(current)) { hops.push(current); loop = true; break; } seen.add(current); walked.add(current); hops.push(current); current = redirects.get(current)?.redirectUrl ?? null; }
    if (current && !loop) hops.push(current);
    if (loop) issues.push({ issueType: "redirect-loop", pageId: page.id, pageUrl: url, details: { hops } });
    else if (hops.length > 2) issues.push({ issueType: "redirect-chain", pageId: page.id, pageUrl: url, details: { hops, finalUrl: hops.at(-1) } });
  }
  return issues;
}

export function contentHash(text: string) { return text ? createHash("sha256").update(text).digest("hex") : null; }
