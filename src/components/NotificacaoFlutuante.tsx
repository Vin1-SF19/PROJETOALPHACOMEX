"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";

interface MensagemChamadoPendente {
    id?: number;
    texto?: string;
    createdAt?: string;
    nenhum?: boolean;
    autor?: { nome?: string | null } | null;
    chamado?: { id?: number; titulo?: string | null } | null;
}

let audioGlobal: HTMLAudioElement | null = null;
if (typeof window !== "undefined") {
    audioGlobal = new Audio("/sounds/notification.mp3");
    audioGlobal.preload = "auto";
}

export function NotificacaoFlutuante() {
    const { data: session, status } = useSession();
    const adicionarNotificacao = useChamadoNotificacoes((state) => state.adicionarNotificacao);
    const ultimaMsgId = useRef<number | null>(null);
    const isFetching = useRef(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const primeiraCarga = useRef(true); 

    const checkNovasMensagens = useCallback(async () => {
        if (status !== "authenticated" || !session?.user?.id || isFetching.current) return;

        try {
            isFetching.current = true;
            const res = await fetch(`/api/notificacoes?v=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
            });
            
            if (!res.ok) throw new Error();
            const msg = await res.json() as MensagemChamadoPendente;

            if (!msg || msg.nenhum || !msg.id) {
                primeiraCarga.current = false;
                isFetching.current = false;
                return;
            }

            if (primeiraCarga.current) {
                ultimaMsgId.current = msg.id;
                primeiraCarga.current = false;
                return;
            }

            if (msg.id !== ultimaMsgId.current) {
                ultimaMsgId.current = msg.id;
                const chamadoId = msg.chamado?.id;

                if (!Number.isSafeInteger(chamadoId) || !chamadoId || chamadoId <= 0) return;

                if (audioGlobal) {
                    audioGlobal.pause();
                    audioGlobal.currentTime = 0;
                    audioGlobal.volume = 0.5;
                    audioGlobal.play().catch(() => {});
                }

                adicionarNotificacao({
                    chamadoId,
                    titulo: msg.chamado?.titulo?.trim() || "Chamado atualizado",
                    usuario: `${msg.autor?.nome?.trim() || "Nova mensagem"}: ${msg.texto?.trim() || "Você recebeu uma atualização."}`,
                    setor: "",
                    urgencia: "MENSAGEM",
                    createdAt: msg.createdAt || new Date().toISOString(),
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
