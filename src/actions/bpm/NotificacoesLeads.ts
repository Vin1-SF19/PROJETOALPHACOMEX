"use server";

import { auth } from "../../../auth";
import { destinoAlertaLeadBpmSchema } from "@/lib/bpm/notificacoes-leads";
import { obterAlertaLeadPendenteBpm } from "@/lib/bpm/notificacoes-leads-server";
import { ListarCardsPipelineBpm } from "@/actions/bpm/Cards";

export async function ObterLeadPendenteNotificacaoBpm(input: unknown) {
  const session = await auth();
  const usuarioId = Number(session?.user?.id);
  const parsed = destinoAlertaLeadBpmSchema.safeParse(input);
  if (!session?.user?.id || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) return { success: false as const, error: "Não autorizado" };
  if (!parsed.success || parsed.data.tipo !== "LEAD_VIRTUAL") return { success: false as const, error: "Destino inválido" };
  const destino = parsed.data;
  try {
    const alerta = await obterAlertaLeadPendenteBpm(usuarioId, destino);
    if (!alerta) return { success: false as const, error: "Lead não está mais disponível ou seu acesso mudou" };
    const cards = await ListarCardsPipelineBpm(destino.pipelineId, [destino.leadId]);
    const card = cards.success ? cards.data.find((card) => card.id === destino.leadId
      && card.origem === destino.origemLead && card.etapaId === alerta.etapaId) : null;
    if (!card) return { success: false as const, error: "Lead não está mais disponível" };
    return { success: true as const, data: card };
  } catch { return { success: false as const, error: "Não foi possível abrir o lead" }; }
}
