import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("sanitized per-instance resilience observations", () => {
  it("aggregates repeated failures without confusing occurrences with requests", async () => {
    vi.resetModules(); vi.useFakeTimers();
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { registrarMetricaBanco } = await import("@/lib/db-observability");
    const metric = { component: "auth", phase: "admission", outcome: "saturated", pending: 8, limit: 8 } as const;
    registrarMetricaBanco(metric);
    registrarMetricaBanco(metric);
    registrarMetricaBanco(metric);
    expect(log).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(30_000);
    registrarMetricaBanco(metric);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[1][1]).toMatchObject({ occurrences: 3, scope: "instance", pending: 8, limit: 8 });
    expect(Object.keys(log.mock.calls[1][1])).not.toEqual(expect.arrayContaining(["userId", "query", "url", "token"]));
  });
});
