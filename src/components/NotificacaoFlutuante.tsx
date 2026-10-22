"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { z } from "zod";
import { checklistPaginaEventosSchema } from "@/lib/checklist/client/notificacoes";
import { useChecklistNotificacoes } from "@/store/useChecklistNotificacoes";
import { useChamadoNotificacoes } from "@/store/useChamadoNotificacoes";
import type { ChamadoMensagemPayload } from "@/lib/chamados/notificacoes";
interface Resposta {
  checklist?: unknown;
  notificacoes?: ChamadoMensagemPayload[];
  feedbacksPendentes?: Array<{ chamadoId: number; titulo: string; closedAt: string }>;
}
/** Poller global existente: agrega chamados e checklist, sem timer no widget. */
export function NotificacaoFlutuante() {
  const { data: session, status } = useSession();
  const usuarioId = Number(session?.user?.id ?? 0);
  useEffect(() => {
    if (status !== "authenticated" || !usuarioId || window !== window.top) return;
    let stopped = false,
      running = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const delivered = new Set<number>(),
      controller = new AbortController();
    async function poll() {
      if (stopped || running) return;
      running = true;
      try {
        const response = await fetch(`/api/notificacoes?v=${Date.now()}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
        });
        if (!response.ok) throw new Error("Notificações indisponíveis");
        const data: Resposta = await response.json();
        if (stopped) return;
        let page = checklistPaginaEventosSchema.safeParse(data.checklist);
        while (page.success && !stopped) {
          useChecklistNotificacoes.getState().receber(usuarioId, page.data.items);
          if (!page.data.nextCursor || useChecklistNotificacoes.getState().usuarioId !== usuarioId) break;
          const url = `/api/checklist/eventos?naoLidos=true&limit=100&cursor=${encodeURIComponent(JSON.stringify(page.data.nextCursor))}`;
          const recovery = await fetch(url, { cache: "no-store", signal: controller.signal });
          if (!recovery.ok) break;
          const envelope = z.object({ ok: z.boolean(), data: z.unknown().optional() }).safeParse(await recovery.json());
          if (!envelope.success || !envelope.data.ok) break;
          page = checklistPaginaEventosSchema.safeParse(envelope.data.data);
        }
        if (stopped) return;
        const chamados = useChamadoNotificacoes.getState();
        chamados.sincronizarFeedbacksPendentes(data.feedbacksPendentes ?? []);
        for (const msg of [...(data.notificacoes ?? [])].reverse()) {
          if (delivered.has(msg.mensagemId)) continue;
          delivered.add(msg.mensagemId);
          chamados.adicionarNotificacao({
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
        /* Existing global recovery retries without clearing a confirmed collection. */
      } finally {
        running = false;
        if (!stopped) timer = setTimeout(() => void poll(), document.hidden ? 30000 : 6000);
      }
    }
    const recover = () => {
      clearTimeout(timer);
      void poll();
    };
    const focus = () => {
      if (!document.hidden) recover();
    };
    window.addEventListener("alpha-checklist-recovery", recover);
    window.addEventListener("focus", focus);
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("alpha-checklist-recovery", recover);
      window.removeEventListener("focus", focus);
    };
  }, [usuarioId, status]);
  return null;
}
