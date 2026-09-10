"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { ChamadoMensagemPayload } from "@/lib/chamados/notificacoes";
import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";

interface RespostaNotificacoesChamados {
    notificacoes?: ChamadoMensagemPayload[];
}

export function NotificacaoFlutuante() {
    const { data: session, status } = useSession();
    const adicionarNotificacao = useChamadoNotificacoes((state) => state.adicionarNotificacao);
    const idsEntreguesRef = useRef(new Set<number>());
    const isFetching = useRef(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const checkNovasMensagens = useCallback(async () => {
        if (status !== "authenticated" || !session?.user?.id || isFetching.current) return;
        try {
            if (window !== window.top) return;
        } catch {
            return;
        }

        try {
            isFetching.current = true;
            const res = await fetch(`/api/notificacoes?v=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            
            if (!res.ok) throw new Error();
            const resposta = await res.json() as RespostaNotificacoesChamados;
            const mensagensDaMaisAntigaParaNova = [...(resposta.notificacoes ?? [])].reverse();
            for (const msg of mensagensDaMaisAntigaParaNova) {
                if (idsEntreguesRef.current.has(msg.mensagemId)) continue;
                idsEntreguesRef.current.add(msg.mensagemId);
                adicionarNotificacao({
                    id: `mensagem-${msg.mensagemId}`,
                    chamadoId: msg.chamadoId,
                    titulo: msg.titulo,
                    usuario: `${msg.autorNome}: ${msg.texto}`,
                    setor: "",
                    urgencia: "MENSAGEM",
                    createdAt: msg.createdAt,
                });
            }
        } catch {
        } finally {
            isFetching.current = false;
            const delay = document.hidden ? 30000 : 6000;
            timeoutRef.current = setTimeout(checkNovasMensagens, delay);
        }
    }, [adicionarNotificacao, session, status]);

    useEffect(() => {
        if (status === "authenticated") {
            checkNovasMensagens();
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [status, checkNovasMensagens]);

    return null;
}
