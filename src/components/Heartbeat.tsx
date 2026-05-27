"use client";

import { useEffect } from "react";

export function Heartbeat() {
  useEffect(() => {
    // Não rodar dentro de iframes (abas do PainelAlpha)
    try { if (window !== window.top) return; } catch { return; }

    const controller = new AbortController();

    const enviarSinal = async () => {
      try {
        await fetch("/api/heartbeat", {
          method: "POST",
          signal: controller.signal
        });
      } catch (e: any) {
        if (e.name !== 'AbortError') {
        }
      }
    };

    enviarSinal();
    const intervalo = setInterval(enviarSinal, 20000);

    return () => {
      controller.abort();
      clearInterval(intervalo);
    };
  }, []);

  return null;
}
