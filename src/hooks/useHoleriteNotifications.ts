'use client';

import { useEffect, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { useHoleriteNotificacoes } from '@/store/useHoleriteNotificacoes';
import type { HoleriteAlertaPayload } from '@/actions/HoleriteAlertas';

const CHANNEL = 'private-holerite-alerts';
const EVENT = 'holerite-alert';

function playHoleriteSound(tipo: 'INICIAL' | 'FINAL') {
  try {
    const play = (vol: number) => {
      const a = new Audio('/sounds/notification.mp3');
      a.volume = vol;
      void a.play().catch(() => {});
    };
    if (tipo === 'FINAL') {
      play(0.9);
      setTimeout(() => play(0.9), 380);
    } else {
      play(0.6);
    }
  } catch {
    // Audio API unavailable
  }
}

export function useHoleriteNotifications(authenticated: boolean) {
  const setAlerta = useHoleriteNotificacoes((s) => s.setAlerta);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!authenticated || !pusherClient || subscribedRef.current) return;

    subscribedRef.current = true;
    const channel = pusherClient.subscribe(CHANNEL);

    channel.bind(EVENT, (payload: HoleriteAlertaPayload) => {
      setAlerta(payload);
      playHoleriteSound(payload.tipo);
    });

    return () => {
      channel.unbind(EVENT);
      pusherClient.unsubscribe(CHANNEL);
      subscribedRef.current = false;
    };
  }, [authenticated, setAlerta]);
}
