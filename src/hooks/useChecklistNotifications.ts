"use client";
import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
/** Única assinatura no shell; a recuperação usa o poller global já existente. */
export function useChecklistNotifications(usuarioId: number, enabled: boolean) {
  useEffect(() => {
    if (window !== window.top) return;
    const store = useChecklistNotificacoes.getState();
    store.iniciar(enabled ? usuarioId : 0);
    if (!enabled || !usuarioId) return;
    const client = pusherClient;
    const callback = () => window.dispatchEvent(new Event("alpha-checklist-recovery"));
    const channel = client?.subscribe("private-checklist-docs");
    channel?.bind("checklist-evento", callback);
    client?.connection.bind("connected", callback);
    return () => {
      channel?.unbind("checklist-evento", callback);
      client?.connection.unbind("connected", callback);
    };
  }, [usuarioId, enabled]);
}
