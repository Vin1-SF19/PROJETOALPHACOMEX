"use client";

import { useEffect, useRef } from "react";
import { pusherClient } from "@/lib/pusher";
import { useNotasNotificacoes } from "@/store/useNotasNotificacoes";
import {
  canalNotasDoUsuario,
  NOTA_COMPARTILHADA_EVENT,
  NOTA_MENCAO_EVENT,
  NOTA_COMENTARIO_EVENT,
  NOTA_PERMISSAO_ALTERADA_EVENT,
  NOTA_VERSAO_RESTAURADA_EVENT,
  NOTA_LEMBRETE_EVENT,
  type NotaNotificacaoPayload,
} from "@/lib/notas/notificacoes";

export function useNotasNotifications(userId: number) {
  const adicionarNotificacao = useNotasNotificacoes((s) => s.adicionarNotificacao);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!pusherClient) return;
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const canal = pusherClient.subscribe(canalNotasDoUsuario(userId));
    const eventos = [
      NOTA_COMPARTILHADA_EVENT,
      NOTA_MENCAO_EVENT,
      NOTA_COMENTARIO_EVENT,
      NOTA_PERMISSAO_ALTERADA_EVENT,
      NOTA_VERSAO_RESTAURADA_EVENT,
      NOTA_LEMBRETE_EVENT,
    ];

    const handler = (payload: NotaNotificacaoPayload) => adicionarNotificacao(payload);
    for (const evento of eventos) canal.bind(evento, handler);

    return () => {
      for (const evento of eventos) canal.unbind(evento, handler);
      pusherClient.unsubscribe(canalNotasDoUsuario(userId));
    };
  }, [userId, adicionarNotificacao]);
}
