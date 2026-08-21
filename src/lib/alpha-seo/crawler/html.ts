import { contentHash, type AuditedPage } from "@/lib/alpha-seo/audit/issues";
import { isSameCrawlOrigin, normalizeCrawlUrl } from "./url-policy";
import type { SafeFetchResult } from "./fetch";

export function analyzeAuditResponse(input: SafeFetchResult & { pageId: string; origin: string; depth: number | null; inSitemap: boolean }): AuditedPage & { images: Array<{ src: string | null; alt: string | null }>; headings: Record<string, number>; hasStructuredData: boolean; hreflangTags: string[]; ogTitle: string | null; ogDescription: string | null; ogImage: string | null } {
  const contentType = input.headers.get("content-type")?.toLowerCase() ?? "";
  const isHtml = contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
  const snippet = input.body.slice(0, 4_000).toLowerCase();
  const blocked = [401, 403, 429].includes(input.status) || !!input.headers.get("cf-mitigated") || (input.status === 503 && ["just a moment", "challenge-platform", "verifying you are human"].some((marker) => snippet.includes(marker)));
  const fetchClass = blocked ? "BLOCKED" as const : input.status === 0 ? "ERROR" as const : "OK" as const;
  const empty = { images: [], headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }, hasStructuredData: false, hreflangTags: [], ogTitle: null, ogDescription: null, ogImage: null };
  const base = { id: input.pageId, url: input.url, statusCode: input.status, redirectUrl: input.redirectUrl, responseTimeMs: input.responseTimeMs, crawlDepth: input.depth, inSitemap: input.inSitemap, fetchClass, isHtml };
  if (!isHtml || fetchClass !== "OK" || input.status >= 300) return { ...base, title: null, metaDescription: null, canonicalUrl: null, headerCanonicalUrl: parseHeaderCanonical(input.headers.get("link"), input.url), robotsMeta: null, xRobotsTag: input.headers.get("x-robots-tag"), h1Count: 0, headingOrder: [], wordCount: 0, imagesTotal: 0, imagesMissingAlt: 0, internalLinks: [], externalLinkCount: 0, isIndexable: false, contentHash: null, ...empty };
  const html = input.body;
  const title = extractFirstText(html, "title");
  const metaDescription = extractMeta(html, "name", "description");
  const robotsMeta = extractMeta(html, "name", "robots");
  const canonicalRaw = extractLink(html, "canonical", "href");
  const canonicalUrl = canonicalRaw ? safeNormalize(canonicalRaw, input.url) : null;
  const xRobotsTag = input.headers.get("x-robots-tag");
  const headingOrder = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`h${level}`, headingOrder.filter((value) => value === level).length]));
  const images = [...html.matchAll(/<img\b([^>]*)>/gi)].map((match) => ({ src: attr(match[1], "src"), alt: hasAttr(match[1], "alt") ? attr(match[1], "alt") ?? "" : null }));
  const links = [...html.matchAll(/<a\b([^>]*)>/gi)].flatMap((match) => { const href = attr(match[1], "href"); if (!href || /^(?:javascript:|mailto:|tel:|#)/i.test(href)) return []; const url = safeNormalize(href, input.url); return url ? [url] : []; });
  const internalLinks = [...new Set(links.filter((url) => isSameCrawlOrigin(url, input.origin)))];
  const externalLinkCount = new Set(links.filter((url) => !isSameCrawlOrigin(url, input.origin))).size;
  const visible = decodeHtml(html.replace(/<(?:script|style|noscript|svg)\b[\s\S]*?<\/(?:script|style|noscript|svg)>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const directives = `${robotsMeta ?? ""},${xRobotsTag ?? ""}`.toLowerCase();
  return {
    ...base, title, metaDescription, canonicalUrl, headerCanonicalUrl: parseHeaderCanonical(input.headers.get("link"), input.url), robotsMeta, xRobotsTag,
    h1Count: headings.h1, headingOrder, wordCount: visible ? visible.split(/\s+/).length : 0,
    imagesTotal: images.length, imagesMissingAlt: images.filter((image) => image.alt === null).length,
    internalLinks, externalLinkCount, isIndexable: !directives.includes("noindex"), contentHash: contentHash(visible), images, headings,
    hasStructuredData: /<script\b[^>]*type=["']application\/ld\+json["']/i.test(html),
    hreflangTags: [...html.matchAll(/<link\b([^>]*)>/gi)].filter((match) => /\brel=["']alternate["']/i.test(match[1])).flatMap((match) => attr(match[1], "hreflang") ?? []),
    ogTitle: extractMeta(html, "property", "og:title"), ogDescription: extractMeta(html, "property", "og:description"), ogImage: extractMeta(html, "property", "og:image"),
  };
}

function extractFirstText(html: string, tag: string) { const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")); return match ? decodeHtml(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null : null; }
function extractMeta(html: string, key: string, value: string) { for (const match of html.matchAll(/<meta\b([^>]*)>/gi)) if (attr(match[1], key)?.toLowerCase() === value) return attr(match[1], "content")?.trim() || null; return null; }
function extractLink(html: string, rel: string, field: string) { for (const match of html.matchAll(/<link\b([^>]*)>/gi)) if ((attr(match[1], "rel") ?? "").toLowerCase().split(/\s+/).includes(rel)) return attr(match[1], field); return null; }
function attr(source: string, name: string) { return source.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"))?.[2] ?? source.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*([^\\s>]+)`, "i"))?.[1] ?? null; }
function hasAttr(source: string, name: string) { return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, "i").test(source); }
function safeNormalize(raw: string, base: string) { try { return normalizeCrawlUrl(raw, base); } catch { return null; } }
function parseHeaderCanonical(header: string | null, base: string) { if (!header) return null; for (const part of header.split(",")) { const match = part.match(/<([^>]+)>\s*;([^]*)/); if (match && /rel\s*=\s*["']?canonical/i.test(match[2])) return safeNormalize(match[1], base); } return null; }
function decodeHtml(value: string) { return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'"); }
