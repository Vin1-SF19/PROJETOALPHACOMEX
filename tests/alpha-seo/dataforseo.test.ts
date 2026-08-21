import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  createAlphaSeoDataForSeoClient,
  DataForSeoError,
} from "@/lib/alpha-seo/dataforseo/client";

describe("Alpha SEO DataForSEO client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("keeps Basic credentials server-side and unwraps a successful task", async () => {
    vi.stubEnv("DATAFORSEO_API_KEY", "encoded-secret");
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Basic encoded-secret",
        );
        return new Response(
          JSON.stringify({
            status_code: 20000,
            tasks: [
              { status_code: 20000, cost: 0.01, result: [{ items: [] }] },
            ],
          }),
          { status: 200 },
        );
      },
    );
    const result = await createAlphaSeoDataForSeoClient({
      fetchImpl: fetchImpl as typeof fetch,
      maxAttempts: 1,
    }).live("test/live", { keyword: "seo" });
    expect(result.costUsd).toBe(0.01);
    expect(result.result).toHaveLength(1);
  });
  it("returns an actionable config error without a paid call", async () => {
    vi.stubEnv("DATAFORSEO_API_KEY", "");
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    vi.stubEnv("DATAFORSEO_PASSWORD", "");
    await expect(
      createAlphaSeoDataForSeoClient({
        fetchImpl: vi.fn() as unknown as typeof fetch,
        maxAttempts: 1,
      }).live("test/live", {}),
    ).rejects.toMatchObject({ code: "CONFIG" } satisfies Partial<DataForSeoError>);
  });
});

describe("Alpha SEO DataForSEO paid-call boundary", () => {
  it("serializa requisições idênticas antes de chamar o provedor", () => {
    const source = readFileSync("src/lib/alpha-seo/dataforseo/operations.ts", "utf8");
    expect(source).toContain('operation: "DATAFORSEO_REQUEST_MUTEX"');
    expect(source).toMatch(/acquireAlphaSeoMutex[\s\S]*createAlphaSeoDataForSeoClient\([^)]*\)\.live/);
    expect(source).toMatch(/finally[\s\S]*releaseAlphaSeoMutex\(lease\)/);
  });
});
