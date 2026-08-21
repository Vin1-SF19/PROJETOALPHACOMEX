export function selectLighthouseSample(pages: Array<{ url: string; statusCode: number | null }>, startUrl: string, limit = 10) {
  const valid = pages.filter((page) => (page.statusCode ?? 0) >= 200 && (page.statusCode ?? 0) < 300);
  const selected = new Set<string>();
  const startKey = canonicalKey(startUrl);
  const start = valid.find((page) => canonicalKey(page.url) === startKey) ?? valid[0];
  if (start) selected.add(start.url);
  const templates = new Set<string>();
  for (const page of valid) {
    if (selected.size >= limit) break;
    const template = urlTemplate(page.url);
    if (templates.has(template)) continue;
    templates.add(template); selected.add(page.url);
  }
  return [...selected];
}
function canonicalKey(raw: string) { const url = new URL(raw); url.protocol = "https:"; url.hostname = url.hostname.replace(/^www\./, "").toLowerCase(); url.hash = ""; if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, ""); return url.toString(); }
function urlTemplate(raw: string) { return new URL(raw).pathname.split("/").map((part) => /^\d+$/.test(part) ? ":id" : /^[0-9a-f-]{36}$/i.test(part) ? ":uuid" : part.includes("-") && part.split("-").length > 2 ? ":slug" : part).join("/"); }
