import { afterEach, describe, expect, it, vi } from "vitest";
import { resolverPrazosBanco } from "@/lib/db-resilience-config";

afterEach(() => vi.restoreAllMocks());

describe("bounded coordinated server deadlines", () => {
  it("accepts only finite integers and corrects cross-budget relationships", () => {
    expect(resolverPrazosBanco({})).toEqual({ transportMs: 10_000, authMs: 12_000, ssrMs: 20_000 });
    expect(resolverPrazosBanco({ DB_ROUNDTRIP_TIMEOUT_MS: "12000", AUTH_VALIDATION_BUDGET_MS: "3000", PAINEL_SSR_READ_BUDGET_MS: "5000" }))
      .toEqual({ transportMs: 12_000, authMs: 13_000, ssrMs: 14_000 });
  });
  it.each(["", " ", "NaN", "Infinity", "999999", "1.5", "private-token-value"])("rejects invalid override without logging its value: %s", (raw) => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolverPrazosBanco({ DB_ROUNDTRIP_TIMEOUT_MS: raw })).toEqual({ transportMs: 10_000, authMs: 12_000, ssrMs: 20_000 });
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-token-value");
  });
});
