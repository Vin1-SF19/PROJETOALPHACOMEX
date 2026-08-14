"use server";

import { revalidatePath } from "next/cache";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import {
  calcularProximoFollowUpStandby,
  etapaEhStandbyFollowUp,
} from "@/lib/bpm/novos-leads";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { interromperStandbyFollowUpSchema } from "@/lib/validations/bpm";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type HistoricoEntrada = {
  createdAt: Date;
  valorNovoJson: string | null;
};

function resolverEntradaAtualEmStandby(
  etapaId: string,
  createdAt: Date,
  historicos: HistoricoEntrada[],
): Date {
  for (const historico of historicos) {
    if (!historico.valorNovoJson) continue;
    try {
      const valor = JSON.parse(historico.valorNovoJson) as { etapaId?: unknown };
      if (valor.etapaId === etapaId) return historico.createdAt;
    } catch {
      // Históricos antigos corrompidos não impedem o card de ser operado.
    }
  }
  return createdAt;
}

export async function ObterEstadoStandbyFollowUpBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "visualizar");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        etapaId: true,
        createdAt: true,
        standbyFollowUpUltimoEm: true,
        standbyFollowUpInterrompidoEm: true,
        etapa: { select: { nome: true } },
      },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (!etapaEhStandbyFollowUp(card.etapa.nome)) {
      return { success: false, error: "O card não está em Standby - Follow Up" };
    }
    const historicos = await db.bpmCardHistorico.findMany({
      where: { cardId, acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO"] } },
      select: { createdAt: true, valorNovoJson: true },
      orderBy: { createdAt: "desc" },
    });
    const entradaEmStandby = resolverEntradaAtualEmStandby(card.etapaId, card.createdAt, historicos);
    return {
      success: true,
      data: {
        ativo: card.standbyFollowUpInterrompidoEm === null,
        entradaEmStandby,
        ultimoFollowUpEm: card.standbyFollowUpUltimoEm,
        interrompidoEm: card.standbyFollowUpInterrompidoEm,
        proximoFollowUpEm: card.standbyFollowUpInterrompidoEm
          ? null
          : calcularProximoFollowUpStandby(entradaEmStandby, card.standbyFollowUpUltimoEm),
      },
    };
  } catch (error) {
    console.error("[ObterEstadoStandbyFollowUpBpm]", error);
    return {
      success: false,
      error: error instanceof Error && error.message === "Não autorizado"
        ? "Não autorizado"
        : "Erro ao consultar o follow-up semanal",
    };
  }
}

/**
 * NoLoss: quando o lead pede para não receber mais follow-ups, a automação é
 * encerrada permanentemente. Não existe retomada automática ou por este fluxo.
 */
export async function InterromperStandbyFollowUpBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    const parsed = interromperStandbyFollowUpSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, motivo } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const resultado = await db.$transaction(async (tx) => {
      const card = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: {
          pipelineId: true,
          etapaId: true,
          status: true,
          updatedAt: true,
          standbyFollowUpInterrompidoEm: true,
          etapa: { select: { nome: true } },
        },
      });
      if (!card) throw new Error("STANDBY_NEGOCIO:Card não encontrado.");
      if (!etapaEhStandbyFollowUp(card.etapa.nome)) {
        throw new Error("STANDBY_NEGOCIO:O follow-up semanal só pode ser interrompido em Standby - Follow Up.");
      }
      if (card.status !== "ATIVO") {
        throw new Error("STANDBY_NEGOCIO:O follow-up só pode ser interrompido em um card ativo.");
      }
      if (card.standbyFollowUpInterrompidoEm) {
        throw new Error("STANDBY_NEGOCIO:O follow-up deste card já foi interrompido permanentemente.");
      }

      // Revalida o ownership dentro da transação: permissões podem mudar entre
      // o precheck e a persistência.
      await exigirAcessoBpmCard(
        cardId,
        userId,
        session.user.role ?? null,
        "editarCard",
        tx,
      );

      const interrompidoEm = new Date();
      const atualizacao = await tx.bpmCard.updateMany({
        where: {
          id: cardId,
          etapaId: card.etapaId,
          status: "ATIVO",
          updatedAt: card.updatedAt,
          standbyFollowUpInterrompidoEm: null,
        },
        data: { standbyFollowUpInterrompidoEm: interrompidoEm },
      });
      if (atualizacao.count !== 1) throw new Error("STANDBY_CONFLITO");

      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "STANDBY_FOLLOW_UP_INTERROMPIDO",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ motivo, interrompidoEm: interrompidoEm.toISOString() }),
        },
      });
      return { pipelineId: card.pipelineId };
    });

    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/pipeline/${resultado.pipelineId}`);
    revalidatePath(`${ROTA_BASE}/card/${cardId}`);
    await notificarPipelineBpm({
      pipelineId: resultado.pipelineId,
      cardId,
      tipo: "CARD_ATUALIZADO",
    });
    return { success: true };
  } catch (error) {
    console.error("[InterromperStandbyFollowUpBpm]", error);
    const mensagem = error instanceof Error ? error.message : "";
    const erro = mensagem === "Não autorizado"
      ? "Não autorizado"
      : mensagem === "STANDBY_CONFLITO"
        ? "O card mudou enquanto era atualizado. Recarregue e tente novamente."
        : mensagem.startsWith("STANDBY_NEGOCIO:")
          ? mensagem.slice("STANDBY_NEGOCIO:".length)
          : "Erro ao interromper o follow-up semanal";
    return { success: false, error: erro };
  }
}
