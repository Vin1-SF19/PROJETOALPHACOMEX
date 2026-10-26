"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { criarInteracaoCardSchema } from "@/lib/validations/bpm";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { ehAnotacaoTecnicaInstagram } from "@/lib/bpm/instagram-anotacao-tecnica";
import { createHash } from "node:crypto";
import { repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

/**
 * Coluna "Presente" da nova visão de card (Fase 4): registra uma nova interação
 * (ligação ou anotação) com data/hora/link/observações/resumo. Também gera uma entrada em
 * BpmCardHistorico para manter o feed de atividade do dashboard/perfil da empresa.
 */
export async function CriarInteracaoCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarInteracaoCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, tipo, agendadoEm, agendaLink, observacoes, resumo, idempotencyKey } = parsed.data;
    const interactionId = idempotencyKey
      ? `c${createHash("sha256").update(JSON.stringify([cardId, userId, idempotencyKey])).digest("hex").slice(0, 24)}`
      : undefined;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const interacao = await repetirTransacaoOcupada(() => db.$transaction(async (tx) => {
      await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard", tx);
      if (interactionId) {
        const existente = await tx.bpmInteracaoCard.findUnique({
          where: { id: interactionId }, include: { registradoPor: { select: { id: true, nome: true } } },
        });
        if (existente) {
          if (existente.cardId !== cardId || existente.registradoPorId !== userId || existente.tipo !== tipo
            || (existente.observacoes ?? "") !== (observacoes ?? "")
            || (existente.resumo ?? "") !== (resumo ?? "")
            || (existente.agendaLink ?? "") !== (agendaLink ?? "")
            || (existente.agendadoEm?.getTime() ?? null) !== (agendadoEm?.getTime() ?? null)) {
            throw new Error("A intenção de registro mudou. Revise a anotação antes de tentar novamente.");
          }
          return existente;
        }
      }
      const criada = await tx.bpmInteracaoCard.create({
        data: {
          ...(interactionId ? { id: interactionId } : {}),
          cardId,
          tipo,
          agendadoEm,
          agendaLink,
          observacoes,
          resumo,
          registradoPorId: userId,
        },
        include: { registradoPor: { select: { id: true, nome: true } } },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: tipo === "ANOTACAO" ? "ANOTACAO_REGISTRADA" : "INTERACAO_REGISTRADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ tipo, agendadoEm, resumo }),
        },
        tx,
      );
      return criada;
    }));

    try { revalidatePath(`${ROTA_BASE}/card/${cardId}`); }
    catch (error) { console.error("[CriarInteracaoCardBpm/cache]", error); }
    try { await notificarPipelineBpm({ cardId, tipo: "INTERACAO_CRIADA" }); }
    catch (error) { console.error("[CriarInteracaoCardBpm/realtime]", error); }
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

    return { success: true, data: interacoes.filter((item) => !ehAnotacaoTecnicaInstagram(item)) };
  } catch (error) {
    console.error("[ListarInteracoesCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao buscar interações";
    return { success: false, error: msg, data: [] };
  }
}
