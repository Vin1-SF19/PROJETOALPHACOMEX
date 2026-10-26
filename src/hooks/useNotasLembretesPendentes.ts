"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { VerificarLembretesPendentes } from "@/actions/NotasLembretes";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { janelaPrincipal } from "@/lib/painel-polling";

const INTERVALO_CHECAGEM_MS = 5 * 60 * 1000;

/** The action also writes and notifies: no retries on failure or focus. */
export function useNotasLembretesPendentes(ativo = true) {
  const { data: session, status } = useSession();
  const identity = sessaoPermiteOperacao(session) ? session?.user?.id : null;
  const running = useRef(false);
  useEffect(() => {
    if (!ativo || !identity || status !== "authenticated" || !janelaPrincipal()) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      if (stopped) return;
      if (running.current || document.hidden || navigator.onLine === false) {
        timer = setTimeout(() => void check(), INTERVALO_CHECAGEM_MS);
        return;
      }
      running.current = true;
      try {
        const result = await VerificarLembretesPendentes();
        if (!stopped && !result.success) toast.error("Lembretes indisponíveis. Suas notas foram mantidas.", { id: "notas-lembretes-indisponiveis" });
      } catch {
        if (!stopped) toast.error("Não foi possível verificar os lembretes. Suas notas foram mantidas.", { id: "notas-lembretes-indisponiveis" });
      } finally {
        running.current = false;
        if (!stopped) timer = setTimeout(() => void check(), INTERVALO_CHECAGEM_MS);
      }
    }
    void check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [ativo, identity, status]);
}
