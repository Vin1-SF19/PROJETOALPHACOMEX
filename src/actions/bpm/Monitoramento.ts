"use server";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { resolverInicioCicloNaEtapa } from "@/lib/bpm/agendar-reuniao";
import { calcularProximaRecorrencia } from "@/lib/bpm/automacoes/agenda";
import { gatilhoConfigSchema } from "@/lib/bpm/automacoes/central-schemas";
import { CHAVE_AUTOMACAO_REVISAO_MONITORAMENTO, etapaEhMonitoramento } from "@/lib/bpm/monitoramento";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";

/** Data efetiva do agendamento; calcula o primeiro ciclo antes do cron materializar a agenda. */
export async function ObterProximaVerificacaoMonitoramentoBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { id: true, pipelineId: true, etapaId: true, createdAt: true, status: true, etapa: { select: { nome: true } } },
    });
    if (!card || !etapaEhMonitoramento(card.etapa.nome)) {
      return { success: false as const, error: "Card fora de Monitoramento" };
    }
    const automacao = await db.bpmAutomacao.findFirst({
      where: { pipelineId: card.pipelineId, chave: CHAVE_AUTOMACAO_REVISAO_MONITORAMENTO },
      select: { ativa: true, versoes: { where: { status: "ATIVA" }, orderBy: { versao: "desc" }, take: 1,
        select: { id: true, gatilhoConfigJson: true, timezone: true } } },
    });
    const versao = automacao?.versoes[0];
    if (!automacao?.ativa || !versao || card.status !== "ATIVO") {
      return { success: true as const, data: { proximaVerificacaoEm: null, ativa: false } };
    }
    const historicos = await db.bpmCardHistorico.findMany({
      where: { cardId: card.id, acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO", "MOVIDO_AUTOMACAO"] } },
      select: { createdAt: true, valorNovoJson: true }, orderBy: { createdAt: "desc" },
    });
    const inicio = resolverInicioCicloNaEtapa(card.etapaId, card.createdAt, historicos);
    const config = gatilhoConfigSchema.parse(JSON.parse(versao.gatilhoConfigJson));
    if (!config.recorrencia) return { success: true as const, data: { proximaVerificacaoEm: null, ativa: true } };
    const chaveAgendamento = config.recorrencia.ancora === "ENTRADA_ETAPA"
      ? `recorrencia:${versao.id}:${card.id}:${inicio.getTime()}`
      : `recorrencia:${versao.id}:${card.id}`;
    const agenda = await db.bpmAutomacaoAgenda.findFirst({
      where: { cardId: card.id, automacaoVersaoId: versao.id, ativo: true, tipo: "RECORRENTE", chaveAgendamento },
      select: { proximaExecucaoEm: true },
    });
    if (agenda) return { success: true as const, data: { proximaVerificacaoEm: agenda.proximaExecucaoEm.toISOString(), ativa: true } };
    const proxima = calcularProximaRecorrencia(config.recorrencia, inicio, versao.timezone);
    return { success: true as const, data: { proximaVerificacaoEm: proxima?.toISOString() ?? null, ativa: true } };
  } catch (error) {
    console.error("[ObterProximaVerificacaoMonitoramentoBpm]", error);
    return { success: false as const, error: "Não foi possível consultar a próxima verificação." };
  }
}
