"use client";

import { useEffect, useRef } from "react";
import { pusherClient } from "@/lib/pusher";

const CHANNEL = "private-parceiros-precadastros";
const EVENT = "novo-pre-cadastro";

export type PreCadastroNotificacao = { id: number; nomeCompleto: string };

export function useParceirosPreCadastroNotifications(
  habilitado: boolean,
  onNovoPreCadastro: (payload: PreCadastroNotificacao) => void,
) {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!habilitado) return;
    if (!pusherClient) return;
    if (subscribedRef.current) return;

    subscribedRef.current = true;
    const channel = pusherClient.subscribe(CHANNEL);

    channel.bind(EVENT, (payload: PreCadastroNotificacao) => {
      onNovoPreCadastro(payload);
    });

    return () => {
      try {
        channel.unbind(EVENT);
        pusherClient.unsubscribe(CHANNEL);
      } catch {
        // ignore cleanup errors on closed connection
      }
      subscribedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habilitado]);
}
