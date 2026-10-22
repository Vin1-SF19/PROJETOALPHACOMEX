"use client";
import { useEffect } from "react";
import { resolverTransporteChecklist } from "@/lib/checklist/realtime";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
/** Inicializa o ator; a recuperação pertence ao poller global, mesmo com configuração inválida. */
export function useChecklistNotifications(usuarioId: number, enabled: boolean) {
  const transporte = resolverTransporteChecklist(process.env.NEXT_PUBLIC_CHECKLIST_REALTIME_MODE);
  useEffect(() => {
    if (window !== window.top) return;
    const store = useChecklistNotificacoes.getState();
    store.iniciar(enabled ? usuarioId : 0);
  }, [usuarioId, enabled]);
  return transporte;
}
