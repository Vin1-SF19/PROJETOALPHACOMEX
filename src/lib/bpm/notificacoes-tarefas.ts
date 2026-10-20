import { z } from "zod";
import { bpmCardIdSchema } from "@/lib/validations/bpm";

export const BPM_TAREFA_USUARIO_CHANNEL_PREFIX = "private-bpm-tarefas-usuario-";
export const BPM_TAREFA_ALERTA_EVENT = "tarefa-alerta";
export const canalTarefasBpmDoUsuario = (usuarioId: number) => `${BPM_TAREFA_USUARIO_CHANNEL_PREFIX}${usuarioId}`;

export function extrairUsuarioIdCanalTarefasBpm(canal: string): number | null {
  const sufixo = canal.slice(BPM_TAREFA_USUARIO_CHANNEL_PREFIX.length);
  const id = Number(sufixo);
  return canal.startsWith(BPM_TAREFA_USUARIO_CHANNEL_PREFIX) && /^[1-9]\d*$/.test(sufixo)
    && Number.isSafeInteger(id) ? id : null;
}

export const alertaTarefaBpmSchema = z.object({
  id: z.string(), tarefaId: z.string(), cardId: z.string(), pipelineId: z.string(),
  titulo: z.string(), descricao: z.string().nullable(), tipo: z.string(), prioridade: z.string(),
  empresaNome: z.string(), pipelineNome: z.string(), etapaNome: z.string(), responsavelNome: z.string(),
  alertaEm: z.string().datetime(), prazo: z.string().datetime().nullable(),
});
export type AlertaTarefaBpm = z.infer<typeof alertaTarefaBpmSchema>;
export const paginaAlertasTarefasBpmSchema = z.object({
  alertas: z.array(alertaTarefaBpmSchema), nextCursor: z.string().nullable(),
});

export function urlCardAlertaBpm(alerta: Pick<AlertaTarefaBpm, "pipelineId" | "cardId">) {
  return `/PainelAlpha/AlphaCRM/pipeline/${encodeURIComponent(alerta.pipelineId)}?cardId=${encodeURIComponent(alerta.cardId)}`;
}

function momento(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function detalhesAlertaTarefaBpm(alerta: AlertaTarefaBpm) {
  return [
    `Alerta: ${momento(alerta.alertaEm)} (Brasília)`,
    alerta.prazo ? `Prazo: ${momento(alerta.prazo)} (Brasília)` : "Sem prazo definido",
    `${alerta.empresaNome} · ${alerta.pipelineNome} · ${alerta.etapaNome}`,
    `Tipo: ${alerta.tipo.replaceAll("_", " ")} · Prioridade: ${alerta.prioridade}`,
    `Responsável: ${alerta.responsavelNome}`,
    alerta.descricao,
  ].filter(Boolean).join("\n");
}

export const BPM_CARD_ABRIR_EVENT = "ALPHA_CRM_ABRIR_CARD";
export const BPM_CARD_PRONTO_EVENT = "ALPHA_CRM_CARD_PRONTO";
export const BPM_CARD_ABERTO_EVENT = "ALPHA_CRM_CARD_ABERTO";
export const intencaoCardBpmSchema = z.object({ cardId: bpmCardIdSchema, pipelineId: z.string().min(1).max(200) });
export type IntencaoCardBpm = z.infer<typeof intencaoCardBpmSchema>;
export function intencaoCardBpmDaUrl(url: string): IntencaoCardBpm | null {
  try {
    const destino = new URL(url, "https://painel.local");
    const pipeline = /^\/PainelAlpha\/AlphaCRM\/pipeline\/([^/]+)$/.exec(destino.pathname);
    if (destino.origin !== "https://painel.local" || !pipeline) return null;
    const parsed = intencaoCardBpmSchema.safeParse({ cardId: destino.searchParams.get("cardId"), pipelineId: decodeURIComponent(pipeline[1]) });
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
