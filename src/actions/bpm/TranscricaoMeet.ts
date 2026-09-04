"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { sincronizarTranscricaoCardBpm } from "@/lib/bpm/transcricao-reuniao-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const schema = z.object({ cardId: z.string().min(1) });
const salvarResumoSchema = z.object({
  cardId: z.string().min(1),
  resumo: z.string().trim().min(1, "O resumo não pode ficar vazio").max(200_000),
  versaoEsperadaEm: z.coerce.date(),
});

export async function SalvarResumoReuniaoBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };

  const parsed = salvarResumoSchema.safeParse(dados);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Resumo inválido" };
  }

  const userId = Number(session.user.id);
  const { cardId, resumo, versaoEsperadaEm } = parsed.data;
  try {
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { pipelineId: true, updatedAt: true, googleEventId: true, transcricaoReuniao: true },
    });
    if (!card) return { success: false as const, error: "Card não encontrado" };
    if (!card.googleEventId) {
      return { success: false as const, error: "Nenhuma reunião vinculada a este card" };
    }
    if (card.updatedAt.getTime() !== versaoEsperadaEm.getTime()) {
      return { success: false as const, error: "O card mudou enquanto era editado. Recarregue e tente novamente." };
    }

    await db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      const atualizada = await tx.bpmCard.updateMany({
        where: { id: cardId, updatedAt: versaoEsperadaEm, googleEventId: card.googleEventId },
        data: { transcricaoReuniao: resumo },
      });
      if (atualizada.count !== 1) throw new Error("CONFLITO_ATUALIZACAO_CARD");
      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "RESUMO_REUNIAO_EDITADO",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({ caracteres: card.transcricaoReuniao?.length ?? 0 }),
          valorNovoJson: JSON.stringify({ caracteres: resumo.length }),
        },
      });
    });

    revalidatePath(`${ROTA_BASE}/pipeline/${card.pipelineId}`);
    await notificarPipelineBpm({ pipelineId: card.pipelineId, cardId, tipo: "REUNIAO_ALTERADA" });
    return { success: true as const };
  } catch (erro) {
    const error = erro instanceof Error ? erro.message : "";
    return {
      success: false as const,
      error: error === "Não autorizado"
        ? "Não autorizado"
        : error === "CONFLITO_ATUALIZACAO_CARD"
          ? "O card mudou enquanto era editado. Recarregue e tente novamente."
          : "Não foi possível salvar o resumo da reunião",
    };
  }
}

export async function SincronizarTranscricaoReuniaoBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };

  const parsed = schema.safeParse(dados);
  if (!parsed.success) return { success: false as const, error: "Card inválido" };

  try {
    await exigirAcessoBpmCard(
      parsed.data.cardId,
      Number(session.user.id),
      session.user.role ?? null,
      "editarCard",
    );
    const resultado = await sincronizarTranscricaoCardBpm(
      parsed.data.cardId,
      "manual",
      async (tx) => {
        await exigirAcessoBpmCard(
          parsed.data.cardId,
          Number(session.user.id),
          session.user.role ?? null,
          "editarCard",
          tx,
        );
      },
    );
    if (resultado.status === "ERRO") {
      return { success: false as const, error: resultado.erro, recuperavel: resultado.recuperavel };
    }
    revalidatePath(`${ROTA_BASE}/pipeline`);
    return { success: true as const, data: resultado };
  } catch (erro) {
    const mensagem = erro instanceof Error && erro.message === "Não autorizado"
      ? "Não autorizado"
      : "Não foi possível sincronizar a transcrição";
    return { success: false as const, error: mensagem };
  }
}
