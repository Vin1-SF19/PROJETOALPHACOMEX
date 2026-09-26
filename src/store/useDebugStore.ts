"use client";

import { create } from "zustand";
import type { DebugEvent, DebugLevel, DebugSource } from "@/lib/debug/error-types";
import { DEBUG_MAX_EVENTS } from "@/lib/debug/error-types";
import { subscribeDebugEvents } from "@/lib/debug/error-bus";

export type DebugFilterLevel = DebugLevel | "all";
export type DebugFilterSource = DebugSource | "all";

export interface DebugStoreState {
  events: DebugEvent[];
  isOpen: boolean;
  selectedId: string | null;
  levelFilter: DebugFilterLevel;
  sourceFilter: DebugFilterSource;
  addEvent: (event: DebugEvent) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  select: (id: string | null) => void;
  setLevelFilter: (level: DebugFilterLevel) => void;
  setSourceFilter: (source: DebugFilterSource) => void;
}

export function createDebugStore() {
  return create<DebugStoreState>((set) => ({
    events: [],
    isOpen: false,
    selectedId: null,
    levelFilter: "all",
    sourceFilter: "all",
    addEvent: (event) =>
      set((state) => {
        const filtered = state.events.filter((item) => item.id !== event.id);
        return {
          events: [event, ...filtered].slice(0, DEBUG_MAX_EVENTS),
          selectedId: state.selectedId ?? event.id,
        };
      }),
    clear: () => set({ events: [], selectedId: null }),
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    select: (id) => set({ selectedId: id }),
    setLevelFilter: (level) => set({ levelFilter: level }),
    setSourceFilter: (source) => set({ sourceFilter: source }),
  }));
}

export const useDebugStore = createDebugStore();

export function useFilteredDebugEvents() {
  const events = useDebugStore((state) => state.events);
  const levelFilter = useDebugStore((state) => state.levelFilter);
  const sourceFilter = useDebugStore((state) => state.sourceFilter);
  return events.filter(
    (event) =>
      (levelFilter === "all" || event.level === levelFilter) &&
      (sourceFilter === "all" || event.source === sourceFilter),
  );
}

export function initDebugStoreCapture(): () => void {
  const unsubscribe = subscribeDebugEvents((event) => {
    useDebugStore.getState().addEvent(event);
  });
  return unsubscribe;
}
