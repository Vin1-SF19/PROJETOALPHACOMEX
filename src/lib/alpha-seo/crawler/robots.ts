import "server-only";

import { XMLParser } from "fast-xml-parser";
import { safeCrawlerFetch } from "./fetch";
import { isSameCrawlOrigin, normalizeCrawlUrl, type DnsResolver } from "./url-policy";

export interface RobotsPolicy {
  isAllowed(url: string): boolean;
  sitemaps: string[];
  raw: string | null;
}

export function parseRobotsTxt(origin: string, raw: string | null, userAgent = "AlphaSEO-Audit"): RobotsPolicy {
  if (!raw) return { isAllowed: () => true, sitemaps: [], raw };
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  const sitemaps: string[] = [];
  let current: (typeof groups)[number] | null = null;
  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const split = line.indexOf(":");
    if (split < 0) continue;
    const key = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();
    if (key === "sitemap") { try { sitemaps.push(normalizeCrawlUrl(value, origin)); } catch { /* invalid sitemap */ } continue; }
    if (key === "user-agent") {
      if (!current || current.rules.length > 0) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const ua = userAgent.toLowerCase();
  const matching = groups.filter((group) => group.agents.some((agent) => agent === "*" || ua.includes(agent)));
  return {
    raw, sitemaps,
    isAllowed(url: string) {
      const path = `${new URL(url).pathname}${new URL(url).search}`;
      const rules = matching.flatMap((group) => group.rules).filter((rule) => rule.path && path.startsWith(rule.path));
      rules.sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
      return rules[0]?.allow ?? true;
    },
  };
}

export async function discoverAuditUrls(input: { origin: string; maxPages: number; resolver?: DnsResolver; fetcher?: typeof fetch; heartbeat?: () => Promise<void> }) {
  let robotsRaw: string | null = null;
  try { robotsRaw = (await safeCrawlerFetch({ url: `${input.origin}/robots.txt`, resolver: input.resolver, fetcher: input.fetcher, maxBytes: 512_000, timeoutMs: 10_000 })).body; } catch { robotsRaw = null; }
  const robots = parseRobotsTxt(input.origin, robotsRaw);
  const queue = [...new Set([...robots.sitemaps, `${input.origin}/sitemap.xml`])].map((url) => ({ url, depth: 0 }));
  const visited = new Set<string>();
  const urls = new Set<string>();
  const parser = new XMLParser({ ignoreAttributes: false });
  while (queue.length && visited.size < 300 && urls.size < input.maxPages * 20) {
    await input.heartbeat?.();
    const entry = queue.shift()!;
    if (visited.has(entry.url) || entry.depth > 3 || !isSameCrawlOrigin(entry.url, input.origin)) continue;
    visited.add(entry.url);
    try {
      const response = await safeCrawlerFetch({ url: entry.url, resolver: input.resolver, fetcher: input.fetcher, maxBytes: 10 * 1024 * 1024, timeoutMs: 15_000 });
      if (response.status < 200 || response.status >= 300 || response.redirectUrl) continue;
      const parsed = parser.parse(response.body) as unknown;
      const root = isRecord(parsed) ? parsed : {};
      const urlset = isRecord(root.urlset) ? root.urlset : {};
      const sitemapindex = isRecord(root.sitemapindex) ? root.sitemapindex : {};
      for (const value of listEntries(urlset.url)) {
        const loc = isRecord(value) ? value.loc : undefined;
        if (typeof loc !== "string") continue;
        const normalized = normalizeCrawlUrl(loc, response.url);
        if (isSameCrawlOrigin(normalized, input.origin) && robots.isAllowed(normalized)) urls.add(normalized);
      }
      for (const value of listEntries(sitemapindex.sitemap)) {
        const loc = isRecord(value) ? value.loc : undefined;
        if (typeof loc !== "string") continue;
        const normalized = normalizeCrawlUrl(loc, response.url);
        if (isSameCrawlOrigin(normalized, input.origin)) queue.push({ url: normalized, depth: entry.depth + 1 });
      }
    } catch { /* partial discovery is preserved */ }
  }
  return { urls: [...urls].slice(0, input.maxPages), robots };
}

function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function listEntries(value: unknown): unknown[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
