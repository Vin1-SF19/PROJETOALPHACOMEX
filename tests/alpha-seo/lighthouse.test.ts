import { describe, expect, it } from "vitest";
import { selectLighthouseSample } from "@/lib/alpha-seo/lighthouse/sample";
import { computeAlphaSeoRetryDelay } from "@/lib/alpha-seo/jobs/queue";
import { serializeLighthousePayload } from "@/lib/alpha-seo/lighthouse/storage";

describe("Alpha SEO Lighthouse e jobs", () => {
  it("seleciona homepage e uma pagina por template, limitado a dez", () => {
    const pages = [{ url: "https://example.com/", statusCode: 200 }, ...Array.from({ length: 15 }, (_, index) => ({ url: `https://example.com/blog/post-number-${index}`, statusCode: 200 }))];
    const sample = selectLighthouseSample(pages, "https://example.com/");
    expect(sample[0]).toBe("https://example.com/");
    expect(sample.length).toBeLessThanOrEqual(10);
  });

  it("aplica backoff exponencial limitado a 30 minutos", () => {
    expect(computeAlphaSeoRetryDelay(1)).toBe(5_000);
    expect(computeAlphaSeoRetryDelay(2)).toBe(10_000);
    expect(computeAlphaSeoRetryDelay(99)).toBe(1_800_000);
  });

  it("serializa payload bruto de forma determinística para storage e export", () => {
    const a = serializeLighthousePayload({ z: 1, nested: { b: 2, a: 1 } });
    const b = serializeLighthousePayload({ nested: { a: 1, b: 2 }, z: 1 });
    expect(Buffer.from(a).toString("utf8")).toBe(Buffer.from(b).toString("utf8"));
    expect(Buffer.from(a).toString("utf8")).toBe('{"nested":{"a":1,"b":2},"z":1}\n');
  });
});
