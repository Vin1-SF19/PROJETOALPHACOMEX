"use client";
import { toast } from "sonner";
import { LeadNotificacaoToast } from "@/components/bpm/notificacoes/LeadNotificacaoToast";
import { paginaAlertasLeadsBpmSchema, urlLeadAlertaBpm, type AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
import { useBpmLeadsNotificacoes as store } from "@/store/useBpmLeadsNotificacoes";

/** Compartilha o lifecycle, canal e relógio já existentes para alertas BPM. */
export function criarNotificacoesLeadsClient(usuarioId: number, signal: AbortSignal,
  abrir: (url: string, label: string) => void) {
  store.getState().iniciarUsuario(usuarioId);
  const toastIds = new Set<string>();
  let emCurso = false;
  let revisao = 0;
  const ativo = () => !signal.aborted && store.getState().usuarioId === usuarioId;
  const limparToasts = () => { for (const id of toastIds) toast.dismiss(id); toastIds.clear(); };
  async function atualizar() {
    revisao += 1;
    if (emCurso || !ativo()) return;
    emCurso = true;
    try {
      let repetir: boolean;
      do {
        const iniciada = revisao;
        const alertas: AlertaLeadBpm[] = [];
        let cursor: string | null = null;
        let snapshot: string | undefined;
        const cursores = new Set<string>();
        do {
          const response = await fetch(`/api/bpm/leads/alertas${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
            { cache: "no-store", signal });
          if (!ativo()) return;
          if (response.status === 401 || response.status === 403) {
            store.getState().sincronizar(usuarioId, []); limparToasts(); return;
          }
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const pagina = paginaAlertasLeadsBpmSchema.parse(await response.json());
          if (snapshot !== undefined && pagina.snapshotEm !== snapshot) throw new Error("Snapshot divergente nos avisos de leads");
          snapshot = pagina.snapshotEm;
          alertas.push(...pagina.alertas);
          cursor = pagina.proximoCursor;
          if (cursor && cursores.has(cursor)) throw new Error("Cursor repetido nos avisos de leads");
          if (cursor) cursores.add(cursor);
        } while (cursor && ativo() && iniciada === revisao);
        if (!ativo()) return;
        repetir = iniciada !== revisao;
        if (repetir) continue; // Evento recebido durante a leitura: não aplica snapshot anterior ao evento.
        const idsAtivos = new Set(alertas.map((a) => `bpm-lead:${usuarioId}:${a.id}`));
        for (const id of toastIds) if (!idsAtivos.has(id)) { toast.dismiss(id); toastIds.delete(id); }
        for (const alerta of store.getState().sincronizar(usuarioId, alertas)) {
          const id = `bpm-lead:${usuarioId}:${alerta.id}`;
          toastIds.add(id);
          toast.custom(() => <LeadNotificacaoToast alerta={alerta} onFechar={() => toast.dismiss(id)} onAbrir={() => {
            if (!ativo()) return;
            toast.dismiss(id);
            abrir(urlLeadAlertaBpm(alerta), "CRM");
          }} />, { id, duration: 15000 });
        }
      } while (repetir && ativo());
    } catch (error) {
      if (!signal.aborted) console.error("[BpmLeads/notificacoes]", error);
    } finally { emCurso = false; }
  }
  return { atualizar, limpar: () => {
    limparToasts();
    if (store.getState().usuarioId === usuarioId) store.getState().iniciarUsuario(0);
  } };
}
