"use client";

import { useRef } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { sessaoConfirmaEncerramento } from "@/lib/auth/navegacao-sessao";
import { consultarJsonSessao } from "@/lib/auth/cliente-sessao";
import { useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";

function janelaPrincipal() {
  try { return typeof window !== "undefined" && window === window.top; } catch { return false; }
}

export function Heartbeat() {
  const { data } = useSession();
  const { confirmar, sinalizarIndisponibilidade } = useRecuperacaoSessao();
  const falhas = useRef(0);
  useQuery({
    queryKey: ["alpha-heartbeat"],
    enabled: data !== null && janelaPrincipal(),
    retry: false,
    networkMode: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    refetchInterval: () => Math.min(60_000, 20_000 * 2 ** Math.min(falhas.current, 2)),
    queryFn: async ({ signal }) => {
      try {
        const response = await consultarJsonSessao("/api/heartbeat", { method: "POST", signal });
        if (response.status === 401 || response.status === 403) {
          // Even a JSON/HTML403 from a proxy is only a hint; the Auth.js protocol
          // must confirm actual absence/revocation before the shared logout.
          const session = await confirmar();
          if (sessaoConfirmaEncerramento(session, true)) return false;
          throw new Error("Sinal indisponível");
        }
        if (response.status !== 200 || !response.body || typeof response.body !== "object" || !("success" in response.body) || response.body.success !== true) throw new Error("Sinal indisponível");
        falhas.current = 0;
        return true;
      } catch (error) {
        falhas.current++;
        if (!signal.aborted) sinalizarIndisponibilidade();
        throw error;
      }
    },
  });
  return null;
}
