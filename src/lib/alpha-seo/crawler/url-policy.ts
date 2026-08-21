import "server-only";

import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set(["localhost", "metadata", "metadata.google.internal", "169.254.169.254", "100.100.100.200"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".localdomain", ".internal", ".home.arpa"];

export type DnsResolver = (hostname: string) => Promise<readonly string[]>;

export async function defaultDnsResolver(hostname: string): Promise<readonly string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

const NON_PUBLIC_IPV4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) NON_PUBLIC_IPV4.addSubnet(network, prefix, "ipv4");
const NON_PUBLIC_IPV6 = new BlockList();
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["::", 96], ["::ffff:0:0", 96], ["64:ff9b::", 96],
  ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) NON_PUBLIC_IPV6.addSubnet(network, prefix, "ipv6");

export function normalizeCrawlUrl(raw: string, base?: string): string {
  const value = base ? new URL(raw, base) : new URL(raw);
  if (value.protocol !== "http:" && value.protocol !== "https:") throw new Error("CRAWL_SCHEME_BLOCKED");
  value.hash = "";
  value.hostname = value.hostname.toLowerCase();
  value.searchParams.sort();
  return value.toString();
}

export function isBlockedIpAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const version = isIP(normalized);
  if (version === 0) return true;
  if (version === 6 && /^(?:::)?ffff:0:/i.test(normalized.replace(/^::/, ""))) return true;
  return version === 4
    ? NON_PUBLIC_IPV4.check(normalized, "ipv4")
    : NON_PUBLIC_IPV6.check(normalized, "ipv6");
}

export async function validateCrawlUrl(raw: string, resolver: DnsResolver = defaultDnsResolver): Promise<string> {
  const url = normalizeCrawlUrl(raw);
  const hostname = urlHostname(url);
  if (BLOCKED_HOSTS.has(hostname) || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) throw new Error("CRAWL_HOST_BLOCKED");
  if (isIP(hostname)) {
    if (isBlockedIpAddress(hostname)) throw new Error("CRAWL_ADDRESS_BLOCKED");
    return url;
  }
  let addresses: readonly string[];
  try { addresses = await resolver(hostname); } catch { throw new Error("CRAWL_DNS_FAILED"); }
  if (addresses.length === 0) throw new Error("CRAWL_DNS_FAILED");
  if (addresses.some(isBlockedIpAddress)) throw new Error("CRAWL_ADDRESS_BLOCKED");
  return url;
}

export function isSameCrawlOrigin(candidate: string, origin: string): boolean {
  try {
    const a = new URL(candidate); const b = new URL(origin);
    const hostA = a.hostname.toLowerCase().replace(/^www\./, "");
    const hostB = b.hostname.toLowerCase().replace(/^www\./, "");
    if (hostA !== hostB) return false;
    if (a.protocol === b.protocol) return effectivePort(a) === effectivePort(b);
    return b.protocol === "http:" && a.protocol === "https:" && effectivePort(b) === "80" && effectivePort(a) === "443";
  } catch { return false; }
}

export async function resolveSafeRedirects(input: { url: string; resolver?: DnsResolver; fetcher?: typeof fetch; maxHops?: number; timeoutMs?: number }) {
  let current = await validateCrawlUrl(input.url, input.resolver);
  for (let hop = 0; hop < (input.maxHops ?? 5); hop += 1) {
    const response = input.fetcher
      ? await input.fetcher(current, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(input.timeoutMs ?? 10_000), headers: { "User-Agent": "AlphaSEO-Audit/1.0" } })
      : await (await import("./pinned-fetch")).fetchPinnedPublicUrl({ url: current, method: "HEAD", resolver: input.resolver, timeoutMs: input.timeoutMs ?? 10_000, maxBytes: 1_024, headers: { "User-Agent": "AlphaSEO-Audit/1.0" } });
    if (response.status < 300 || response.status >= 400) return current;
    const location = response.headers.get("location");
    if (!location) return current;
    current = await validateCrawlUrl(normalizeCrawlUrl(location, current), input.resolver);
  }
  throw new Error("CRAWL_REDIRECT_LIMIT");
}

function urlHostname(url: string) { return new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, ""); }
function effectivePort(url: URL) { return url.port || (url.protocol === "https:" ? "443" : "80"); }
