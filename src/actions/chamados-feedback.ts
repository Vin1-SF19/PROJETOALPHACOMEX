"use server";

import { auth } from "../../auth";
import db from "@/lib/prisma";
import {
  primeiraMensagemZod,
  recusarFeedbackChamadoSchema,
  responderFeedbackChamadoSchema,
  type ResponderFeedbackChamadoInput,
} from "@/lib/chamados/schemas";

export type FeedbackChamadoPendente = {
  chamadoId: number;
  titulo: string;
  closedAt: string;
};

function usuarioIdValido(id: string | undefined): number | null {
  const userId = Number(id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export async function listarFeedbacksPendentesAction(): Promise<{
  success: boolean;
  data?: FeedbackChamadoPendente[];
  error?: string;
}> {
  const session = await auth();
  const userId = usuarioIdValido(session?.user?.id);
  if (!userId) return { success: false, error: "Não autorizado" };

  try {
    const feedbacks = await db.chamadoFeedback.findMany({
      where: {
        status: "PENDENTE",
        chamado: {
          usuarioId: userId,
          status: "CONCLUIDO",
          closedAt: { not: null },
        },
      },
      select: {
        chamadoId: true,
        chamado: {
          select: {
            titulo: true,
            closedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const data = feedbacks.flatMap((feedback) =>
      feedback.chamado.closedAt
        ? [{
            chamadoId: feedback.chamadoId,
            titulo: feedback.chamado.titulo,
            closedAt: feedback.chamado.closedAt.toISOString(),
          }]
        : [],
    );

    return { success: true, data };
  } catch (error) {
    console.error("[chamados-feedback] Falha ao listar pendências", {
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
    return { success: false, error: "Não foi possível carregar os feedbacks pendentes" };
  }
}

export async function recusarFeedbackChamadoAction(chamadoId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  const userId = usuarioIdValido(session?.user?.id);
  if (!userId) return { success: false, error: "Não autorizado" };

  const parsed = recusarFeedbackChamadoSchema.safeParse({ chamadoId });
  if (!parsed.success) return { success: false, error: primeiraMensagemZod(parsed.error) };

  try {
    const recusado = await db.$transaction(async (tx) => {
      const feedback = await tx.chamadoFeedback.findUnique({
        where: { chamadoId: parsed.data.chamadoId },
        select: {
          status: true,
          chamado: { select: { usuarioId: true, status: true } },
        },
      });

      if (!feedback || feedback.chamado.usuarioId !== userId || feedback.chamado.status !== "CONCLUIDO") {
        return { count: 0 };
      }

      return tx.chamadoFeedback.updateMany({
        where: { chamadoId: parsed.data.chamadoId, status: "PENDENTE" },
        data: {
          status: "RECUSADO",
          decidedAt: new Date(),
        },
      });
    }, { isolationLevel: "Serializable" });

    if (recusado.count !== 1) {
      return { success: false, error: "Feedback inexistente, já respondido ou sem permissão" };
    }

    return { success: true };
  } catch (error) {
    console.error("[chamados-feedback] Falha ao recusar feedback", {
      chamadoId: parsed.data.chamadoId,
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
    return { success: false, error: "Não foi possível registrar sua escolha" };
  }
}

export async function responderFeedbackChamadoAction(payload: ResponderFeedbackChamadoInput): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  const userId = usuarioIdValido(session?.user?.id);
  if (!userId) return { success: false, error: "Não autorizado" };

  const parsed = responderFeedbackChamadoSchema.safeParse(payload);
  if (!parsed.success) return { success: false, error: primeiraMensagemZod(parsed.error) };

  try {
    const respondido = await db.$transaction(async (tx) => {
      const feedback = await tx.chamadoFeedback.findUnique({
        where: { chamadoId: parsed.data.chamadoId },
        select: {
          status: true,
          chamado: { select: { usuarioId: true, status: true } },
        },
      });

      if (!feedback || feedback.chamado.usuarioId !== userId || feedback.chamado.status !== "CONCLUIDO") {
        return { count: 0 };
      }

      return tx.chamadoFeedback.updateMany({
        where: { chamadoId: parsed.data.chamadoId, status: "PENDENTE" },
        data: {
          status: "RESPONDIDO",
          notaRapidezResposta: parsed.data.notaRapidezResposta,
          notaPrazoConclusao: parsed.data.notaPrazoConclusao,
          solucionadaComoEsperado: parsed.data.solucionadaComoEsperado,
          comentario: parsed.data.solucionadaComoEsperado ? null : parsed.data.comentario,
          notaQualidadeSolucao: parsed.data.solucionadaComoEsperado
            ? parsed.data.notaQualidadeSolucao
            : null,
          decidedAt: new Date(),
        },
      });
    }, { isolationLevel: "Serializable" });

    if (respondido.count !== 1) {
      return { success: false, error: "Feedback inexistente, já respondido ou sem permissão" };
    }

    return { success: true };
  } catch (error) {
    console.error("[chamados-feedback] Falha ao responder feedback", {
      chamadoId: parsed.data.chamadoId,
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
    return { success: false, error: "Não foi possível salvar o feedback" };
  }
}
