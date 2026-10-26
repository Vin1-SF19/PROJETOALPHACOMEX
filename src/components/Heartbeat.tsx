"use client";

import { useRef } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { sessaoConfirmaEncerramento } from "@/lib/auth/navegacao-sessao";
import { consultarJsonSessao } from "@/lib/auth/cliente-sessao";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { janelaPrincipal, esperaRetryAfter } from "@/lib/painel-polling";
import { useRecuperacaoSessao } from "@/components/auth/SessaoResilienteProvider";

export function Heartbeat() {
  const { data, status } = useSession();
  const identity = sessaoPermiteOperacao(data) ? data?.user?.id : null;
  const { confirmar, sinalizarIndisponibilidade } = useRecuperacaoSessao();
  const estado = useRef({ identity, falhas: 0, next: 0 });
  useQuery({
    queryKey: ["alpha-heartbeat", identity],
    enabled: status === "authenticated" && !!identity && janelaPrincipal(),
    retry: false,
    networkMode: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    refetchInterval: () => Math.min(60_000, 20_000 * 2 ** Math.min(estado.current.falhas, 2)),
    queryFn: async ({ signal }) => {
      if (estado.current.identity !== identity) estado.current = { identity, falhas: 0, next: 0 };
      if (Date.now() < estado.current.next) return false;
      try {
        const response = await consultarJsonSessao("/api/heartbeat", { method: "POST", signal });
        if (signal.aborted) return false;
        estado.current.next = Date.now() + esperaRetryAfter(response.retryAfter);
        if (response.status === 401 || response.status === 403) {
          // Even a JSON/HTML403 from a proxy is only a hint; the Auth.js protocol
          // must confirm actual absence/revocation before the shared logout.
          const session = await confirmar();
          if (sessaoConfirmaEncerramento(session, true)) return false;
          throw new Error("Sinal indisponível");
        }
        if (response.status !== 200 || !response.body || typeof response.body !== "object" || !("success" in response.body) || response.body.success !== true) throw new Error("Sinal indisponível");
        estado.current.falhas = 0;
        return true;
      } catch (error) {
        if (signal.aborted) throw error;
        estado.current.falhas++;
        estado.current.next = Math.max(estado.current.next, Date.now() + Math.min(60_000, 20_000 * 2 ** Math.min(estado.current.falhas, 2)));
        if (!signal.aborted) sinalizarIndisponibilidade();
        throw error;
      }
    },
  });
  return null;
}
