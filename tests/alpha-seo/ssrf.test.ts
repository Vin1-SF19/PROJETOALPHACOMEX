import { describe, expect, it, vi } from "vitest";
import { isBlockedIpAddress, resolveSafeRedirects, validateCrawlUrl } from "@/lib/alpha-seo/crawler/url-policy";
import { safeCrawlerFetch } from "@/lib/alpha-seo/crawler/fetch";
import { fetchPinnedPublicUrl } from "@/lib/alpha-seo/crawler/pinned-fetch";
import { assertPublicHttpUrl } from "@/lib/alpha-seo/sam/safe-url";

describe("Alpha SEO crawler SSRF", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.20.1.1", "192.168.1.2", "100.64.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "::1", "fd00::1", "fe80::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:0:7f00:1"])("bloqueia endereco privado ou reservado %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it("bloqueia hostname que resolve para rede privada e aceita publico", async () => {
    await expect(validateCrawlUrl("http://internal.example", async () => ["10.0.0.8"])).rejects.toThrow("CRAWL_ADDRESS_BLOCKED");
    await expect(validateCrawlUrl("https://example.com/a#x", async () => ["93.184.216.34"])).resolves.toBe("https://example.com/a");
  });

  it("revalida DNS de cada redirect", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://metadata.internal/latest" } }));
    const resolver = async (hostname: string) => hostname === "example.com" ? ["93.184.216.34"] : ["169.254.169.254"];
    await expect(resolveSafeRedirects({ url: "https://example.com", resolver, fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("interrompe resposta acima do limite sem chamada externa real", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("123456", { status: 200, headers: { "content-type": "text/html" } }));
    await expect(safeCrawlerFetch({ url: "https://example.com", resolver: async () => ["93.184.216.34"], fetcher, maxBytes: 5 })).rejects.toThrow("CRAWL_RESPONSE_TOO_LARGE");
  });

  it("recusa resposta DNS mista antes de abrir a conexão fixada", async () => {
    await expect(fetchPinnedPublicUrl({
      url: "https://example.com",
      resolver: async () => ["93.184.216.34", "127.0.0.1"],
    })).rejects.toThrow("CRAWL_ADDRESS_BLOCKED");
  });

  it("aplica a mesma política ao leitor de páginas do SAM", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1/admin")).rejects.toThrow("URL_NOT_ALLOWED");
    await expect(assertPublicHttpUrl("https://example.com:8443/page")).rejects.toThrow("URL_NOT_ALLOWED");
  });
});
