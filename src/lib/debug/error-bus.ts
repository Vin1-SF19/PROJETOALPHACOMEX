import type { DebugEvent, DebugLevel, DebugSource } from "./error-types";
import {
  DEBUG_EVENT_NAME,
  DEBUG_MAX_MESSAGE_LENGTH,
  DEBUG_MAX_STACK_LENGTH,
} from "./error-types";

type DebugListener = (event: DebugEvent) => void;

type DebugBusWindow = Window & {
  __alphaDebugInstalled?: boolean;
};

const DEBUG_LISTENER_KEY = "__alphaDebugListeners";
const debugListeners = new WeakMap<Window, Set<DebugListener>>();

function getDebugListeners(win: Window): Set<DebugListener> {
  let listeners = debugListeners.get(win);
  if (!listeners) {
    listeners = new Set();
    debugListeners.set(win, listeners);
  }
  return listeners;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[objecto profundo]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, DEBUG_MAX_MESSAGE_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, DEBUG_MAX_MESSAGE_LENGTH),
      stack: value.stack?.slice(0, DEBUG_MAX_STACK_LENGTH),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 20)) {
      if (/token|password|senha|secret|api[_-]?key|authorization/i.test(key)) {
        result[key] = "[oculto]";
        continue;
      }
      result[key] = sanitizeValue(item, depth + 1);
    }
    return result;
  }
  return String(value).slice(0, DEBUG_MAX_MESSAGE_LENGTH);
}

export function createDebugEvent(
  level: DebugLevel,
  source: DebugSource,
  message: unknown,
  options?: { stack?: unknown; meta?: Record<string, unknown> },
): DebugEvent {
  const text =
    typeof message === "string"
      ? message
      : message instanceof Error
        ? message.message
        : JSON.stringify(sanitizeValue(message)) ?? "Erro desconhecido";

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: new Date().toISOString(),
    level,
    source,
    message: text.slice(0, DEBUG_MAX_MESSAGE_LENGTH),
    stack: typeof options?.stack === "string" ? options.stack.slice(0, DEBUG_MAX_STACK_LENGTH) : undefined,
    meta: options?.meta ? sanitizeValue(options.meta) as Record<string, unknown> : undefined,
  };
}

export function installDebugBus(): void {
  if (typeof window === "undefined") return;
  const win = window as DebugBusWindow;
  if (win.__alphaDebugInstalled) return;
  win.__alphaDebugInstalled = true;
  getDebugListeners(window);
}

export function subscribeDebugEvents(listener: DebugListener): () => void {
  if (typeof window === "undefined") return () => undefined;
  installDebugBus();
  const listeners = getDebugListeners(window);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitDebugEvent(event: DebugEvent): void {
  if (typeof window === "undefined") return;
  installDebugBus();
  const listeners = getDebugListeners(window);
  const snapshot = Array.from(listeners);
  snapshot.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // O overlay de debug não pode quebrar a aplicação por erro de listener.
    }
  });
  if (typeof window.CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(DEBUG_EVENT_NAME, { detail: event }));
  }
}

export function reportDebugError(
  message: unknown,
  options?: { level?: DebugLevel; source?: DebugSource; stack?: unknown; meta?: Record<string, unknown> },
): void {
  const level = options?.level ?? "error";
  const source = options?.source ?? "custom";
  emitDebugEvent(createDebugEvent(level, source, message, options));
}
