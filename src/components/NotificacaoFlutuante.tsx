"use client";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { consultarJsonPainel, ConsultaPainelIndisponivel, janelaPrincipal } from "@/lib/painel-polling";
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
  const usuarioId = sessaoPermiteOperacao(session) ? Number(session?.user?.id ?? 0) : 0;
  const lastIdentity = useRef<number | null>(null);
  useEffect(() => {
    if (!janelaPrincipal()) return;
    if (status === "unauthenticated" || (usuarioId && lastIdentity.current !== usuarioId)) {
      useChamadoNotificacoes.setState({ notificacoes: [], feedbacksPendentes: [] });
      useChecklistNotificacoes.getState().iniciar(usuarioId);
      lastIdentity.current = usuarioId;
    }
    if (status !== "authenticated" || !usuarioId) return;
    let stopped = false,
      running = false,
      failures = 0,
      next = 0,
      timer: ReturnType<typeof setTimeout> | undefined;
    const delivered = new Set<number>(),
      controller = new AbortController();
    async function poll() {
      if (stopped || running) return;
      if (Date.now() < next) { clearTimeout(timer); timer = setTimeout(() => void poll(), next - Date.now()); return; }
      running = true;
      try {
        const data = await consultarJsonPainel("/api/notificacoes", controller.signal) as Resposta;
        if (stopped) return;
        let page = checklistPaginaEventosSchema.safeParse(data.checklist);
        while (page.success && !stopped) {
          useChecklistNotificacoes.getState().receber(usuarioId, page.data.items);
          if (!page.data.nextCursor || useChecklistNotificacoes.getState().usuarioId !== usuarioId) break;
          const url = `/api/checklist/eventos?naoLidos=true&limit=100&cursor=${encodeURIComponent(JSON.stringify(page.data.nextCursor))}`;
          const envelope = z.object({ ok: z.boolean(), data: z.unknown().optional() }).safeParse(await consultarJsonPainel(url, controller.signal));
          if (!envelope.success || !envelope.data.ok) break;
          page = checklistPaginaEventosSchema.safeParse(envelope.data.data);
        }
        if (stopped) return;
        failures = 0;
        next = 0;
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
      } catch (error) {
        if (!stopped) {
          failures++;
          next = Date.now() + Math.max(Math.min(60_000, 6000 * 2 ** Math.min(failures - 1, 4)),
            error instanceof ConsultaPainelIndisponivel ? error.retryAfterMs : 0);
        }
        /* Keep the confirmed collection and cursor during temporary failure. */
      } finally {
        running = false;
        if (!stopped) timer = setTimeout(() => void poll(), Math.max(document.hidden ? 30000 : 6000, next - Date.now()));
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
    window.addEventListener("online", focus);
    document.addEventListener("visibilitychange", focus);
    void poll();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("alpha-checklist-recovery", recover);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [usuarioId, status]);
  return null;
}
