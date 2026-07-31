"use client";

import { useSyncExternalStore } from "react";

const QUERY_DESKTOP = "(min-width: 1024px)";

function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(QUERY_DESKTOP);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY_DESKTOP).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useAgendaDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
