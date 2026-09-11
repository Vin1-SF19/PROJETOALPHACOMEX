'use client';

import { useEffect, useRef } from 'react';
import { pusherClient } from '@/lib/pusher';
import { useChamadoNotificacoes } from '@/store/useChamadoNotificacoes';
import {
  CHAMADO_ASSUMIDO_EVENT,
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADO_MENSAGEM_EVENT,
  CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  podeReceberNovosChamados,
  type ChamadoAssumidoPayload,
  type ChamadoConcluidoPayload,
  type ChamadoMensagemPayload,
  type NovoChamadoPayload,
} from '@/lib/chamados/notificacoes';

export function useChamadosNotifications(role: string | undefined, userId: number) {
  const adicionarNotificacao = useChamadoNotificacoes((s) => s.adicionarNotificacao);
  const adicionarFeedbackPendente = useChamadoNotificacoes((s) => s.adicionarFeedbackPendente);
  const subscribedRef = useRef(false);

  useEffect(() => {
    const client = pusherClient;
    if (!client) return;
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

    const mensagemHandler = (payload: ChamadoMensagemPayload) => {
      if (payload.autorId === userId) return;
      adicionarNotificacao({
        id: `mensagem-${payload.mensagemId}`,
        chamadoId: payload.chamadoId,
        titulo: payload.titulo,
        usuario: `${payload.autorNome}: ${payload.texto}`,
        setor: '',
        urgencia: 'MENSAGEM',
        createdAt: payload.createdAt,
      });
      window.dispatchEvent(new Event(CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT));
      playAudio();
    };

    if (podeReceberNovosChamados(role)) {
      const channel = client.subscribe(CHAMADOS_ADMIN_CHANNEL);
      const handler = (payload: NovoChamadoPayload) => {
        adicionarNotificacao({
          chamadoId: payload.chamadoId,
          titulo: payload.titulo,
          usuario: payload.usuario,
          setor: payload.setor,
          urgencia: payload.urgencia,
          createdAt: payload.createdAt,
        });
        window.dispatchEvent(new Event(CHAMADOS_OPERACIONAIS_ATUALIZAR_EVENT));
        playAudio();
      };
      channel.bind(NOVO_CHAMADO_EVENT, handler);
      channel.bind(CHAMADO_MENSAGEM_EVENT, mensagemHandler);
      cleanups.push(() => {
        channel.unbind(NOVO_CHAMADO_EVENT, handler);
        channel.unbind(CHAMADO_MENSAGEM_EVENT, mensagemHandler);
        client.unsubscribe(CHAMADOS_ADMIN_CHANNEL);
      });
    }

    const userChannelName = canalChamadosDoUsuario(userId);
    const userChannel = client.subscribe(userChannelName);
    const concluidoHandler = (payload: ChamadoConcluidoPayload) => {
      adicionarNotificacao({
        chamadoId: payload.chamadoId,
        titulo: payload.titulo,
        usuario: payload.solucao || 'Seu chamado foi concluído.',
        setor: '',
        urgencia: 'CONCLUIDO',
        createdAt: payload.createdAt,
      });
      adicionarFeedbackPendente({
        chamadoId: payload.chamadoId,
        titulo: payload.titulo,
        closedAt: payload.createdAt,
      });
      playAudio();
    };
    userChannel.bind(CHAMADO_CONCLUIDO_EVENT, concluidoHandler);

    const assumidoHandler = (payload: ChamadoAssumidoPayload) => {
      adicionarNotificacao({
        chamadoId: payload.chamadoId,
        titulo: payload.titulo,
        usuario: `${payload.tecnicoNome} assumiu seu chamado e já está resolvendo o problema.`,
        setor: '',
        urgencia: 'EM_ATENDIMENTO',
        createdAt: payload.createdAt,
      });
      playAudio();
    };
    userChannel.bind(CHAMADO_ASSUMIDO_EVENT, assumidoHandler);
    userChannel.bind(CHAMADO_MENSAGEM_EVENT, mensagemHandler);
    cleanups.push(() => {
      userChannel.unbind(CHAMADO_CONCLUIDO_EVENT, concluidoHandler);
      userChannel.unbind(CHAMADO_ASSUMIDO_EVENT, assumidoHandler);
      userChannel.unbind(CHAMADO_MENSAGEM_EVENT, mensagemHandler);
      client.unsubscribe(userChannelName);
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
  }, [role, userId, adicionarFeedbackPendente, adicionarNotificacao]);
}
