"use server";

import { auth } from "../../../auth";
import { destinoAlertaLeadBpmSchema } from "@/lib/bpm/notificacoes-leads";
import { obterAlertaLeadPendenteBpm, obterDestinoLeadPromovidoBpm } from "@/lib/bpm/notificacoes-leads-server";
import { ListarCardsPipelineBpm } from "@/actions/bpm/Cards";

export async function ObterLeadPendenteNotificacaoBpm(input: unknown) {
  const session = await auth();
  const usuarioId = Number(session?.user?.id);
  const parsed = destinoAlertaLeadBpmSchema.safeParse(input);
  if (!session?.user?.id || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) return { success: false as const, codigo: "NAO_AUTORIZADO" as const, error: "Não autorizado" };
  if (!parsed.success || parsed.data.tipo !== "LEAD_VIRTUAL") return { success: false as const, codigo: "DESTINO_INVALIDO" as const, error: "Destino inválido" };
  const destino = parsed.data;
  try {
    const alerta = await obterAlertaLeadPendenteBpm(usuarioId, destino);
    if (!alerta) {
      const promovido = await obterDestinoLeadPromovidoBpm(usuarioId, destino);
      return promovido ? { success: true as const, tipo: "CARD" as const, destino: promovido }
        : { success: false as const, codigo: "LEITURA_INDISPONIVEL" as const, error: "Lead indisponível ou seu acesso mudou" };
    }
    const cards = await ListarCardsPipelineBpm(destino.pipelineId, [destino.leadId]);
    const card = cards.success ? cards.data.find((card) => card.id === destino.leadId
      && card.origem === destino.origemLead && card.etapaId === alerta.etapaId) : null;
    if (!card) {
      // A promoção pode ter ocorrido entre a leitura da fonte e a projeção do quadro.
      const promovido = await obterDestinoLeadPromovidoBpm(usuarioId, destino);
      if (promovido) return { success: true as const, tipo: "CARD" as const, destino: promovido };
      return cards.success
        ? { success: false as const, codigo: "LEITURA_INDISPONIVEL" as const, error: "Lead indisponível ou seu acesso mudou" }
        : { success: false as const, codigo: "FALHA_CARREGAMENTO" as const, error: "Não foi possível carregar os detalhes do lead. Tente novamente" };
    }
    return { success: true as const, tipo: "LEAD_VIRTUAL" as const, data: card };
  } catch { return { success: false as const, codigo: "FALHA_CARREGAMENTO" as const, error: "Não foi possível abrir o lead. Tente novamente" }; }
}
