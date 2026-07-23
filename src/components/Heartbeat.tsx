"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { deveEncerrarSessaoPorHeartbeat } from "@/lib/auth/navegacao-sessao";

export function Heartbeat() {
  const { status } = useSession();
  const teveSessaoAutenticada = useRef(status === "authenticated");

  useEffect(() => {
    if (status === "authenticated") {
      teveSessaoAutenticada.current = true;
    }
  }, [status]);

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

        if (
          deveEncerrarSessaoPorHeartbeat(
            response.status,
            teveSessaoAutenticada.current,
          ) &&
          !controller.signal.aborted
        ) {
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
