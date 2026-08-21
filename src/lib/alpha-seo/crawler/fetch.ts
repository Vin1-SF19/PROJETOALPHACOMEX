import "server-only";

import { normalizeCrawlUrl, validateCrawlUrl, type DnsResolver } from "./url-policy";
import { fetchPinnedPublicUrl } from "./pinned-fetch";

export interface SafeFetchResult {
  url: string; status: number; headers: Headers; body: string; bytes: number; responseTimeMs: number; redirectUrl: string | null;
}

export async function safeCrawlerFetch(input: { url: string; resolver?: DnsResolver; fetcher?: typeof fetch; maxBytes?: number; timeoutMs?: number }): Promise<SafeFetchResult> {
  const url = await validateCrawlUrl(input.url, input.resolver);
  const started = Date.now();
  const headers = { "User-Agent": "AlphaSEO-Audit/1.0", Accept: "text/html,application/xhtml+xml,application/xml,text/xml" };
  const response = input.fetcher
    ? await input.fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(input.timeoutMs ?? 15_000), headers })
    : await fetchPinnedPublicUrl({ url, resolver: input.resolver, timeoutMs: input.timeoutMs, maxBytes: input.maxBytes, headers });
  const redirectUrl = response.status >= 300 && response.status < 400 && response.headers.get("location")
    ? await validateCrawlUrl(normalizeCrawlUrl(response.headers.get("location")!, url), input.resolver)
    : null;
  const maxBytes = input.maxBytes ?? 1_048_576;
  if (!response.body) return { url, status: response.status, headers: response.headers, body: "", bytes: 0, responseTimeMs: Date.now() - started, redirectUrl };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new Error("CRAWL_RESPONSE_TOO_LARGE"); }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally { reader.releaseLock(); }
  chunks.push(decoder.decode());
  return { url, status: response.status, headers: response.headers, body: chunks.join(""), bytes, responseTimeMs: Date.now() - started, redirectUrl };
}
