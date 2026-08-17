"use client";

import { useEffect, useRef } from "react";
import { pusherClient } from "@/lib/pusher";
import { useCalendarioAlphaNotificacoes } from "@/store/useCalendarioAlphaNotificacoes";
import {
  CALENDARIO_ALPHA_COMPROMISSO_EVENT,
  CALENDARIO_ALPHA_SOLICITACAO_RECEBIDA_EVENT,
  CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT,
  canalCalendarioAlphaDoUsuario,
  type CalendarioAlphaCompromissoPayload,
  type CalendarioAlphaSolicitacaoRecebidaPayload,
  type CalendarioAlphaSolicitacaoRespondidaPayload,
} from "@/lib/google-calendar/notificacoes";

/** Espelha `useAdminChamadosNotifications.ts` (mesmo som `/sounds/notification.mp3`). */
export function useCalendarioAlphaNotifications(userId: number) {
  const adicionarCompromisso = useCalendarioAlphaNotificacoes((s) => s.adicionarCompromisso);
  const adicionarSolicitacaoRecebida = useCalendarioAlphaNotificacoes((s) => s.adicionarSolicitacaoRecebida);
  const adicionarSolicitacaoRespondida = useCalendarioAlphaNotificacoes((s) => s.adicionarSolicitacaoRespondida);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!pusherClient) return;
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const playAudio = () => {
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.volume = 0.6;
        void audio.play().catch(() => {
          // Autoplay bloqueado pelo navegador — falha silenciosa
        });
      } catch {
        // Audio API indisponível
      }
    };

    const canal = pusherClient.subscribe(canalCalendarioAlphaDoUsuario(userId));

    const handlerCompromisso = (payload: CalendarioAlphaCompromissoPayload) => {
      adicionarCompromisso(payload);
      playAudio();
    };
    const handlerSolicitacaoRecebida = (payload: CalendarioAlphaSolicitacaoRecebidaPayload) => {
      adicionarSolicitacaoRecebida(payload);
      playAudio();
    };
    const handlerSolicitacaoRespondida = (payload: CalendarioAlphaSolicitacaoRespondidaPayload) => {
      adicionarSolicitacaoRespondida(payload);
      playAudio();
    };

    canal.bind(CALENDARIO_ALPHA_COMPROMISSO_EVENT, handlerCompromisso);
    canal.bind(CALENDARIO_ALPHA_SOLICITACAO_RECEBIDA_EVENT, handlerSolicitacaoRecebida);
    canal.bind(CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT, handlerSolicitacaoRespondida);

    return () => {
      canal.unbind(CALENDARIO_ALPHA_COMPROMISSO_EVENT, handlerCompromisso);
      canal.unbind(CALENDARIO_ALPHA_SOLICITACAO_RECEBIDA_EVENT, handlerSolicitacaoRecebida);
      canal.unbind(CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT, handlerSolicitacaoRespondida);
      pusherClient.unsubscribe(canalCalendarioAlphaDoUsuario(userId));
      subscribedRef.current = false;
    };
  }, [userId, adicionarCompromisso, adicionarSolicitacaoRecebida, adicionarSolicitacaoRespondida]);
}
