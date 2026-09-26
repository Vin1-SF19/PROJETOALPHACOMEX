import { afterEach, describe, expect, test, vi } from "vitest";
import { createDebugEvent, emitDebugEvent, reportDebugError, subscribeDebugEvents } from "@/lib/debug/error-bus";

describe("debug error bus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });


  test("creates sanitized event from Error", () => {
    const event = createDebugEvent("error", "custom", new Error("falhou"), {
      stack: "stack\n".repeat(2000),
      meta: { token: "123456", ok: true },
    });

    expect(event.level).toBe("error");
    expect(event.source).toBe("custom");
    expect(event.message).toBe("falhou");
    expect(event.stack?.length).toBeLessThanOrEqual(8000);
    expect(event.meta?.token).toBe("[oculto]");
    expect(event.meta?.ok).toBe(true);
  });


  test("reportDebugError emits event in a window environment", () => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      CustomEvent: class {
        constructor(public type: string, public init?: { detail?: unknown }) {}
      },
    });
    const listener = vi.fn();
    const unsubscribe = subscribeDebugEvents(listener);

    reportDebugError("erro manual", { source: "api", meta: { code: 500 } });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ message: "erro manual" }));
    unsubscribe();
  });
});
