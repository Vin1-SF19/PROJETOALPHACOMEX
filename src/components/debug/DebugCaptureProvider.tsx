"use client";

import { useEffect } from "react";
import { createDebugEvent, emitDebugEvent, installDebugBus } from "@/lib/debug/error-bus";
import type { DebugLevel, DebugSource } from "@/lib/debug/error-types";
import { initDebugStoreCapture, useDebugStore } from "@/store/useDebugStore";

type ConsoleMethod = "log" | "info" | "warn" | "error";

function shouldCaptureConsole(level: DebugLevel): boolean {
  if (level === "error") return true;
  if (level === "warn") return true;
  return process.env.NODE_ENV === "development";
}

export function DebugCaptureProvider() {
  const enabled = useDebugStore((state) => state.events.length >= 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window !== window.top) return;
    } catch {
      return;
    }

    installDebugBus();
    const stopStoreCapture = initDebugStoreCapture();

    const originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    const patchConsole = (method: ConsoleMethod, level: DebugLevel, source: DebugSource) => {
      if (!shouldCaptureConsole(level)) return;
      const original = originalConsole[method];
      (console as Record<ConsoleMethod, unknown>)[method] = (...args: unknown[]) => {
        original(...args);
        emitDebugEvent(
          createDebugEvent(
            level,
            source,
            args.length === 1 ? args[0] : args,
            { meta: { args: args.slice(0, 10) } },
          ),
        );
      };
    };

    patchConsole("log", "info", "console");
    patchConsole("info", "info", "console");
    patchConsole("warn", "warn", "console");
    patchConsole("error", "error", "console");

    const onWindowError = (event: ErrorEvent) => {
      emitDebugEvent(
        createDebugEvent("error", "unhandlederror", event.message || "Erro global desconhecido", {
          stack: event.error?.stack,
          meta: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          },
        }),
      );
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      emitDebugEvent(
        createDebugEvent(
          "error",
          "unhandledrejection",
          reason instanceof Error ? reason.message : "Promise rejeitada sem tratamento",
          {
            stack: reason instanceof Error ? reason.stack : undefined,
            meta: { reason },
          },
        ),
      );
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      stopStoreCapture();
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      (console as Record<ConsoleMethod, unknown>).log = originalConsole.log;
      (console as Record<ConsoleMethod, unknown>).info = originalConsole.info;
      (console as Record<ConsoleMethod, unknown>).warn = originalConsole.warn;
      (console as Record<ConsoleMethod, unknown>).error = originalConsole.error;
    };
  }, [enabled]);

  return null;
}
