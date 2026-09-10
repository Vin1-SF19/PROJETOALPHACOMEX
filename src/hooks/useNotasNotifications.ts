"use client";

import { useEffect, useRef } from "react";
import { pusherClient } from "@/lib/pusher";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";
import {
  canalNotasDoUsuario,
  NOTA_NOTIFICACAO_EVENTS,
  type NotaNotificacaoPayload,
} from "@/lib/notas/notificacoes";

export function useNotasNotifications(userId: number) {
  const adicionarNotificacao = useNotasNotificacoes((s) => s.adicionarNotificacao);
  const subscribedRef = useRef(false);

  useEffect(() => {
    const client = pusherClient;
    if (!client) return;
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    try {
      if (window !== window.top) return;
    } catch {
      return;
    }
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const canal = client.subscribe(canalNotasDoUsuario(userId));
    const handler = (payload: NotaNotificacaoPayload) => adicionarNotificacao(payload);
    for (const evento of NOTA_NOTIFICACAO_EVENTS) canal.bind(evento, handler);

    return () => {
      try {
        for (const evento of NOTA_NOTIFICACAO_EVENTS) canal.unbind(evento, handler);
        client.unsubscribe(canalNotasDoUsuario(userId));
      } finally {
        subscribedRef.current = false;
      }
    };
  }, [userId, adicionarNotificacao]);
}
