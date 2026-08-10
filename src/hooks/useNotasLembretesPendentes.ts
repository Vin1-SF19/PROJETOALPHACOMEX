"use client";

import { useEffect } from "react";
import { VerificarLembretesPendentes } from "@/actions/NotasLembretes";

const INTERVALO_CHECAGEM_MS = 5 * 60 * 1000; // 5min — sem cron real, checagem em runtime enquanto o painel está aberto

/**
 * Dispara a checagem de lembretes vencidos ao montar e periodicamente enquanto o painel
 * estiver aberto. Sem infraestrutura de cron confirmada no projeto — mesma decisão já tomada
 * para VideoIntrodutorioConfig (ver decisions.md). Notificação real acontece via Pusher dentro
 * da própria Server Action.
 */
export function useNotasLembretesPendentes(ativo: boolean = true) {
  useEffect(() => {
    if (!ativo) return;

    void VerificarLembretesPendentes();
    const intervalo = setInterval(() => {
      void VerificarLembretesPendentes();
    }, INTERVALO_CHECAGEM_MS);

    return () => clearInterval(intervalo);
  }, [ativo]);
}
