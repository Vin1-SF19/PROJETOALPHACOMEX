'use client';

import { useEffect, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { useChamadoNotificacoes } from '@/store/useChamadoNotificacoes';
import type { NovoChamadoPayload } from '@/actions/chamados';

const ADMIN_ROLES = ['Admin', 'CEO'];
const CHANNEL = 'private-admin-chamados';
const EVENT = 'novo-chamado';

export function useAdminChamadosNotifications(role: string | undefined) {
  const adicionarNotificacao = useChamadoNotificacoes((s) => s.adicionarNotificacao);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!role || !ADMIN_ROLES.includes(role)) return;
    if (!pusherClient) return;
    if (subscribedRef.current) return;

    subscribedRef.current = true;
    const channel = pusherClient.subscribe(CHANNEL);

    channel.bind(EVENT, (payload: NovoChamadoPayload) => {
      adicionarNotificacao({
        chamadoId: payload.chamadoId,
        titulo: payload.titulo,
        usuario: payload.usuario,
        setor: payload.setor,
        urgencia: payload.urgencia,
        createdAt: payload.createdAt,
      });

      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.6;
        void audio.play().catch(() => {
          // Autoplay blocked by browser — silent fail
        });
      } catch {
        // Audio API not available
      }
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
  }, [role, adicionarNotificacao]);
}
