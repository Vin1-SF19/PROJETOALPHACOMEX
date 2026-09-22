import type { SetStateAction } from "react";

export function criarEstadoEditor() {
  const valores = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  return {
    initialize<T>(key: string, value: T): T {
      if (!valores.has(key)) valores.set(key, value);
      return valores.get(key) as T;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    read<T>(key: string, initial: T): T {
      return valores.has(key) ? valores.get(key) as T : initial;
    },
    write<T>(key: string, initial: T, action: SetStateAction<T>) {
      const previous = valores.has(key) ? valores.get(key) as T : initial;
      const next = typeof action === "function"
        ? (action as (value: T) => T)(previous) : action;
      valores.set(key, next);
      if (!Object.is(previous, next)) listeners.forEach((listener) => listener());
    },
  };
}
