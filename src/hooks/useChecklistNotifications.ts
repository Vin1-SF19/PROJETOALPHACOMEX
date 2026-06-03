'use client';

import { useEffect, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { useChecklistNotificacoes } from '@/store/useChecklistNotificacoes';

type NovoDocumentoPayload = {
  documentoId: string;
  itemId: string;
  itemDescricao: string;
  empresaId: string;
  razaoSocial: string;
  nomeCliente: string;
  nomeArquivo: string;
  criadoEm: string;
};

const CHECKLIST_ROLES = ['Admin', 'CEO', 'OPERACIONAL'];
const CHANNEL = 'private-checklist-docs';
const EVENT = 'novo-documento-cliente';

export function useChecklistNotifications(role: string | undefined) {
  const adicionarNotificacao = useChecklistNotificacoes((s) => s.adicionarNotificacao);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!role || !CHECKLIST_ROLES.includes(role)) return;
    if (!pusherClient) return;
    if (subscribedRef.current) return;

    subscribedRef.current = true;
    const channel = pusherClient.subscribe(CHANNEL);

    channel.bind(EVENT, (payload: NovoDocumentoPayload) => {
      adicionarNotificacao({
        documentoId: payload.documentoId,
        itemDescricao: payload.itemDescricao,
        empresaId: payload.empresaId,
        razaoSocial: payload.razaoSocial,
        nomeCliente: payload.nomeCliente,
        nomeArquivo: payload.nomeArquivo,
        criadoEm: payload.criadoEm,
      });

      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        void audio.play().catch(() => {});
      } catch {
        // Audio API not available
      }
    });

    return () => {
      try {
        channel.unbind(EVENT);
        pusherClient.unsubscribe(CHANNEL);
      } catch {
        // ignore cleanup errors
      }
      subscribedRef.current = false;
    };
  }, [role, adicionarNotificacao]);
}
