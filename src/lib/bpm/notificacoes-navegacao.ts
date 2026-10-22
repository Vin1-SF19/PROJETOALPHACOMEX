import { z } from "zod";
import { intencaoCardBpmSchema } from "@/lib/bpm/notificacoes-tarefas";

const identificador = z.string().trim().min(1).max(200);
export const intencaoNotificacaoBpmSchema = z.union([
  intencaoCardBpmSchema.extend({ recepcaoId: identificador.optional(), leadId: z.never().optional(), origemLead: z.never().optional() }),
  z.object({ pipelineId: identificador, origemLead: z.enum(["instagram", "noloss"]), leadId: identificador,
    cardId: z.never().optional(), tarefaId: z.never().optional(), recepcaoId: z.never().optional() }),
]);
export type IntencaoNotificacaoBpm = z.infer<typeof intencaoNotificacaoBpmSchema>;
export function intencaoNotificacaoBpmDaUrl(url: string): IntencaoNotificacaoBpm | null {
  try {
    const destino = new URL(url, "https://painel.local");
    const pipeline = /^\/PainelAlpha\/AlphaCRM\/pipeline\/([^/]+)$/.exec(destino.pathname);
    if (destino.origin !== "https://painel.local" || !pipeline) return null;
    const objeto: Record<string, unknown> = { pipelineId: decodeURIComponent(pipeline[1]) };
    for (const key of ["cardId", "tarefaId", "recepcaoId", "origemLead", "leadId"]) {
      if (destino.searchParams.has(key)) {
        if (destino.searchParams.getAll(key).length !== 1) return null;
        objeto[key] = destino.searchParams.get(key);
      }
    }
    const resultado = intencaoNotificacaoBpmSchema.safeParse(objeto);
    return resultado.success ? resultado.data : null;
  } catch { return null; }
}
export function mesmaIntencaoNotificacaoBpm(a: IntencaoNotificacaoBpm, b: IntencaoNotificacaoBpm): boolean {
  return a.pipelineId === b.pipelineId && a.cardId === b.cardId && a.tarefaId === b.tarefaId
    && a.recepcaoId === b.recepcaoId && a.leadId === b.leadId && a.origemLead === b.origemLead;
}

export const BPM_LEADS_RECONCILIAR_EVENT = "ALPHA_CRM_LEADS_RECONCILIAR";
export function solicitarReconciliacaoLeadsBpm() {
  if (typeof window === "undefined") return;
  if (window.parent !== window) window.parent.postMessage({ type: BPM_LEADS_RECONCILIAR_EVENT }, window.location.origin);
  else window.dispatchEvent(new Event(BPM_LEADS_RECONCILIAR_EVENT));
}
