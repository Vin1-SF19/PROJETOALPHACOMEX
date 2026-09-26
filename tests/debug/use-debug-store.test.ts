import { describe, expect, test } from "vitest";
import { createDebugStore } from "@/store/useDebugStore";
import type { DebugEvent } from "@/lib/debug/error-types";

describe("debug store", () => {
  test("adds events and keeps newest first", () => {
    const store = createDebugStore();
    const first: DebugEvent = { id: "1", ts: "a", level: "error", source: "console", message: "one" };
    const second: DebugEvent = { id: "2", ts: "b", level: "warn", source: "api", message: "two" };

    store.getState().addEvent(first);
    store.getState().addEvent(second);

    expect(store.getState().events.map((event) => event.id)).toEqual(["2", "1"]);
  });

  test("deduplicates events by id", () => {
    const store = createDebugStore();
    const event: DebugEvent = { id: "same", ts: "a", level: "error", source: "console", message: "same" };

    store.getState().addEvent(event);
    store.getState().addEvent(event);

    expect(store.getState().events).toHaveLength(1);
  });

  test("clears events and selection", () => {
    const store = createDebugStore();
    store.getState().addEvent({ id: "1", ts: "a", level: "error", source: "console", message: "one" } satisfies DebugEvent);
    store.getState().select("1");

    store.getState().clear();

    expect(store.getState().events).toHaveLength(0);
    expect(store.getState().selectedId).toBeNull();
  });

  test("toggles open state", () => {
    const store = createDebugStore();

    expect(store.getState().isOpen).toBe(false);
    store.getState().toggle();
    expect(store.getState().isOpen).toBe(true);
    store.getState().toggle();
    expect(store.getState().isOpen).toBe(false);
  });
});
