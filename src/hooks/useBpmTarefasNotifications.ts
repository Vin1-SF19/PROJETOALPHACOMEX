"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { pusherClient } from "@/lib/pusher";
import { useBpmTarefasNotificacoes } from "@/store/useBpmTarefasNotificacoes";
import {
  BPM_TAREFA_ALERTA_EVENT, canalTarefasBpmDoUsuario, detalhesAlertaTarefaBpm,
  paginaAlertasTarefasBpmSchema, urlCardAlertaBpm, type AlertaTarefaBpm,
} from "@/lib/bpm/notificacoes-tarefas";

export function useBpmTarefasNotifications(usuarioId: number, abrirModulo: (url: string, label: string) => void) {
  const abrirRef = useRef(abrirModulo);
  useEffect(() => { abrirRef.current = abrirModulo; }, [abrirModulo]);
  useEffect(() => {
    try { if (window !== window.top) return; } catch { return; }
    const store = useBpmTarefasNotificacoes;
    store.getState().iniciarUsuario(usuarioId);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) return;
    const controller = new AbortController();
    const toastIds = new Set<string>();
    const limparToasts = () => { for (const id of toastIds) toast.dismiss(id); toastIds.clear(); };
    let carregando = false;
    let atualizarDepois = false;
    async function atualizar() {
      if (controller.signal.aborted) return;
      if (carregando) { atualizarDepois = true; return; }
      carregando = true;
      try {
        const alertas: AlertaTarefaBpm[] = [];
        let cursor: string | null = null;
        const cursores = new Set<string>();
        do {
          const response = await fetch(`/api/bpm/tarefas/alertas${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
            { cache: "no-store", signal: controller.signal });
          if (response.status === 401 || response.status === 403) {
            if (!controller.signal.aborted) { store.getState().sincronizar(usuarioId, []); limparToasts(); }
            return;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const pagina = paginaAlertasTarefasBpmSchema.parse(await response.json());
          alertas.push(...pagina.alertas);
          cursor = pagina.nextCursor;
          if (cursor && cursores.has(cursor)) throw new Error("Cursor repetido nos alertas de tarefas");
          if (cursor) cursores.add(cursor);
        } while (cursor && !controller.signal.aborted);
        if (controller.signal.aborted) return;
        const idsAtivos = new Set(alertas.map((alerta) => `bpm-alerta:${usuarioId}:${alerta.id}`));
        for (const id of toastIds) if (!idsAtivos.has(id)) { toast.dismiss(id); toastIds.delete(id); }
        for (const alerta of store.getState().sincronizar(usuarioId, alertas)) {
          const toastId = `bpm-alerta:${usuarioId}:${alerta.id}`;
          toastIds.add(toastId);
          toast.info(alerta.titulo, {
            id: toastId, description: detalhesAlertaTarefaBpm(alerta), duration: 10000,
            action: { label: "Abrir tarefa", onClick: () => {
              if (controller.signal.aborted || store.getState().usuarioId !== usuarioId) return;
              store.getState().marcarLida(alerta.id);
              toast.dismiss(toastId);
              abrirRef.current(urlCardAlertaBpm(alerta), "CRM");
            } },
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("[BpmTarefas/notificacoes]", error);
      } finally {
        carregando = false;
        if (atualizarDepois && !controller.signal.aborted) { atualizarDepois = false; void atualizar(); }
      }
    }
    const reconciliar = () => { if (document.visibilityState !== "hidden") void atualizar(); };
    const canalNome = canalTarefasBpmDoUsuario(usuarioId);
    const canal = pusherClient?.subscribe(canalNome);
    canal?.bind(BPM_TAREFA_ALERTA_EVENT, reconciliar);
    canal?.bind("pusher:subscription_succeeded", reconciliar);
    pusherClient?.connection.bind("connected", reconciliar);
    window.addEventListener("focus", reconciliar);
    window.addEventListener("online", reconciliar);
    document.addEventListener("visibilitychange", reconciliar);
    const timer = window.setInterval(reconciliar, 30000);
    void atualizar();
    return () => {
      controller.abort();
      limparToasts();
      window.clearInterval(timer);
      window.removeEventListener("focus", reconciliar);
      window.removeEventListener("online", reconciliar);
      document.removeEventListener("visibilitychange", reconciliar);
      canal?.unbind(BPM_TAREFA_ALERTA_EVENT, reconciliar);
      canal?.unbind("pusher:subscription_succeeded", reconciliar);
      pusherClient?.connection.unbind("connected", reconciliar);
      if (canal) pusherClient?.unsubscribe(canalNome);
      // Inclui logout e troca de usuário; respostas antigas são descartadas pelo abort.
      if (store.getState().usuarioId === usuarioId) store.getState().iniciarUsuario(0);
    };
  }, [usuarioId]);
}
