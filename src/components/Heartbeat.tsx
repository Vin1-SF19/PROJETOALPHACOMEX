"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export function Heartbeat() {
  useEffect(() => {
    // Não rodar dentro de iframes (abas do PainelAlpha)
    try { if (window !== window.top) return; } catch { return; }

    const controller = new AbortController();

    const enviarSinal = async () => {
      try {
        const response = await fetch("/api/heartbeat", {
          method: "POST",
          signal: controller.signal
        });

        if (response.status === 403 && !controller.signal.aborted) {
          await signOut({ redirectTo: "/" });
        }
      } catch {
        return;
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
