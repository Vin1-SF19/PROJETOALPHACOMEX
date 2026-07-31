'use client';

import { useEffect, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { useChamadoNotificacoes } from '@/store/useChamadoNotificacoes';
import {
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  podeReceberNovosChamados,
  type ChamadoConcluidoPayload,
  type NovoChamadoPayload,
} from '@/lib/chamados/notificacoes';

export function useChamadosNotifications(role: string | undefined, userId: number) {
  const adicionarNotificacao = useChamadoNotificacoes((s) => s.adicionarNotificacao);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!pusherClient) return;
    if (!Number.isSafeInteger(userId) || userId <= 0) return;
    if (subscribedRef.current) return;

    subscribedRef.current = true;
    const cleanups: Array<() => void> = [];

    const playAudio = () => {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.6;
        void audio.play().catch(() => {
          // Autoplay blocked by browser — silent fail
        });
      } catch {
        // Audio API not available
      }
    };

    if (podeReceberNovosChamados(role)) {
      const channel = pusherClient.subscribe(CHAMADOS_ADMIN_CHANNEL);
      const handler = (payload: NovoChamadoPayload) => {
        adicionarNotificacao({
          chamadoId: payload.chamadoId,
          titulo: payload.titulo,
          usuario: payload.usuario,
          setor: payload.setor,
          urgencia: payload.urgencia,
          createdAt: payload.createdAt,
        });
        playAudio();
      };
      channel.bind(NOVO_CHAMADO_EVENT, handler);
      cleanups.push(() => {
        channel.unbind(NOVO_CHAMADO_EVENT, handler);
        pusherClient.unsubscribe(CHAMADOS_ADMIN_CHANNEL);
      });
    }

    const userChannelName = canalChamadosDoUsuario(userId);
    const userChannel = pusherClient.subscribe(userChannelName);
    const concluidoHandler = (payload: ChamadoConcluidoPayload) => {
      adicionarNotificacao({
        chamadoId: payload.chamadoId,
        titulo: payload.titulo,
        usuario: payload.solucao || 'Seu chamado foi concluído.',
        setor: '',
        urgencia: 'CONCLUIDO',
        createdAt: payload.createdAt,
      });
      playAudio();
    };
    userChannel.bind(CHAMADO_CONCLUIDO_EVENT, concluidoHandler);
    cleanups.push(() => {
      userChannel.unbind(CHAMADO_CONCLUIDO_EVENT, concluidoHandler);
      pusherClient.unsubscribe(userChannelName);
    });

    return () => {
      cleanups.forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // ignore cleanup errors on closed connection
        }
      });
      subscribedRef.current = false;
    };
  }, [role, userId, adicionarNotificacao]);
}
