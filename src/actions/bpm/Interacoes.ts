"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarInteracaoCardSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "./Cards";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

/**
 * Coluna "Presente" da nova visão de card (Fase 4): registra uma nova interação
 * (ligação) com data/hora/link/observações/resumo. Também gera uma entrada em
 * BpmCardHistorico para manter o feed de atividade do dashboard/perfil da empresa.
 */
export async function CriarInteracaoCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarInteracaoCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, agendadoEm, agendaLink, observacoes, resumo } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const interacao = await db.$transaction(async (tx) => {
      const criada = await tx.bpmInteracaoCard.create({
        data: {
          cardId,
          tipo: "LIGACAO",
          agendadoEm,
          agendaLink,
          observacoes,
          resumo,
          registradoPorId: userId,
        },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "INTERACAO_REGISTRADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ agendadoEm, resumo }),
        },
        tx,
      );
      return criada;
    });

    revalidatePath(`${ROTA_BASE}/card/${cardId}`);
    await notificarPipelineBpm({ cardId, tipo: "INTERACAO_CRIADA" });
    return { success: true, data: interacao };
  } catch (error) {
    console.error("[CriarInteracaoCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao registrar interação";
    return { success: false, error: msg };
  }
}

/** Coluna "Passado": lista as interações já registradas no card, mais recentes primeiro. */
export async function ListarInteracoesCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const interacoes = await db.bpmInteracaoCard.findMany({
      where: { cardId },
      include: { registradoPor: { select: { id: true, nome: true } } },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: interacoes };
  } catch (error) {
    console.error("[ListarInteracoesCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar interações";
    return { success: false, error: msg, data: [] };
  }
}
