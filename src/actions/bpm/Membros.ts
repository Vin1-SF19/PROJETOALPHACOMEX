"use server";

import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import {
  atualizarMembrosCardSchema,
  listarUsuariosVinculaveisCardSchema,
} from "@/lib/validations/bpm";
import {
  exigirAcessoBpmCard,
  listarUsuariosVinculaveisBpm,
} from "@/lib/bpm/ownership";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";

type MembroPersistido = {
  userId: number;
  role: string;
};

function ordenarIds(userIds: Iterable<number>): number[] {
  return [...userIds].sort((a, b) => a - b);
}

/**
 * Candidatos seguros para o seletor múltiplo do cabeçalho do card.
 *
 * Export: `ListarUsuariosVinculaveisCardBpm({ cardId })`
 * Return: `{ success, data: Array<{ id, nome, imagemUrl }> }`
 */
export async function ListarUsuariosVinculaveisCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const parsed = listarUsuariosVinculaveisCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten(), data: [] };

    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(
      parsed.data.cardId,
      userId,
      session.user.role ?? null,
      "adicionarParticipantes",
    );
    const candidatos = await listarUsuariosVinculaveisBpm();
    return { success: true, data: candidatos };
  } catch (error) {
    console.error("[ListarUsuariosVinculaveisCardBpm]", error);
    return { success: false, error: "Erro ao buscar pessoas vinculáveis", data: [] };
  }
}

/**
 * Substitui o conjunto de participantes do card sem permitir que o responsável
 * deixe de ser membro. Novos vínculos recebem o papel PARTICIPANTE; um papel
 * ADMINISTRADOR já existente é preservado enquanto a pessoa continuar ligada.
 *
 * Export: `AtualizarMembrosCardBpm({ cardId, userIds })`
 * Return: `{ success, data: Array<{ userId, role, usuario: { id, nome, imagemUrl } }> }`
 */
export async function AtualizarMembrosCardBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const parsed = atualizarMembrosCardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };

    const userId = Number(session.user.id);
    const { cardId, userIds } = parsed.data;
    await exigirAcessoBpmCard(
      cardId,
      userId,
      session.user.role ?? null,
      "adicionarParticipantes",
    );

    const cardAnterior = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { pipelineId: true, responsavelId: true, updatedAt: true },
    });
    if (!cardAnterior) return { success: false, error: "Card não encontrado" };

    const resultado = await db.$transaction(async (tx) => {
      // A autorização e a elegibilidade são reavaliadas na mesma transação da
      // escrita. Assim, uma conta removida do CRM entre o carregamento do modal
      // e o submit não obtém acesso por um vínculo atrasado.
      await exigirAcessoBpmCard(
        cardId,
        userId,
        session.user.role ?? null,
        "adicionarParticipantes",
        tx,
      );
      const cardAtual = await tx.bpmCard.findUnique({
        where: { id: cardId },
        select: { pipelineId: true, responsavelId: true, updatedAt: true },
      });
      if (
        !cardAtual
        || cardAtual.pipelineId !== cardAnterior.pipelineId
        || cardAtual.updatedAt.getTime() !== cardAnterior.updatedAt.getTime()
      ) {
        throw new Error("CONFLITO_MEMBROS_CARD");
      }

      const idsDesejados = new Set(userIds);
      // O responsável é estruturalmente um membro e não pode ser removido pelo
      // seletor. O caso legado de responsável hoje inelegível continua íntegro;
      // apenas novos participantes precisam estar ATIVO + CRM efetivo.
      idsDesejados.add(cardAtual.responsavelId);
      const candidatos = await listarUsuariosVinculaveisBpm(tx);
      const idsElegiveis = new Set(candidatos.map((candidato) => candidato.id));
      const idsInvalidos = ordenarIds(idsDesejados).filter(
        (id) => id !== cardAtual.responsavelId && !idsElegiveis.has(id),
      );
      if (idsInvalidos.length > 0) throw new Error("MEMBRO_CARD_INELEGIVEL");

      const membrosAtuais = await tx.bpmCardMembro.findMany({
        where: { cardId },
        select: { userId: true, role: true },
      });
      const membrosPorUsuario = new Map(
        membrosAtuais.map((membro) => [membro.userId, membro]),
      );
      const membrosDesejados: MembroPersistido[] = ordenarIds(idsDesejados).map((id) => ({
        userId: id,
        role: id === cardAtual.responsavelId
          ? "RESPONSAVEL"
          : membrosPorUsuario.get(id)?.role ?? "PARTICIPANTE",
      }));
      const semMudanca = membrosAtuais.length === membrosDesejados.length
        && membrosDesejados.every((membro) =>
          membrosPorUsuario.get(membro.userId)?.role === membro.role,
        );
      if (semMudanca) {
        const membros = await tx.bpmCardMembro.findMany({
          where: { cardId },
          select: {
            userId: true,
            role: true,
            usuario: { select: { id: true, nome: true, imagemUrl: true } },
          },
          orderBy: { usuario: { nome: "asc" } },
        });
        return { alterado: false, pipelineId: cardAtual.pipelineId, membros };
      }

      // CAS faz do `updatedAt` um lock lógico do card e impede duas trocas de
      // participantes concorrentes de se sobrescreverem silenciosamente.
      const lock = await tx.bpmCard.updateMany({
        where: { id: cardId, updatedAt: cardAnterior.updatedAt },
        data: { updatedAt: new Date() },
      });
      if (lock.count !== 1) throw new Error("CONFLITO_MEMBROS_CARD");

      await tx.bpmCardMembro.deleteMany({
        where: { cardId, userId: { notIn: membrosDesejados.map((membro) => membro.userId) } },
      });
      for (const membro of membrosDesejados) {
        await tx.bpmCardMembro.upsert({
          where: { cardId_userId: { cardId, userId: membro.userId } },
          create: { cardId, userId: membro.userId, role: membro.role },
          update: { role: membro.role },
        });
      }

      await tx.bpmCardHistorico.create({
        data: {
          cardId,
          acao: "MEMBROS_ATUALIZADOS",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({
            membrosIds: ordenarIds(membrosAtuais.map((membro) => membro.userId)),
          }),
          valorNovoJson: JSON.stringify({
            membrosIds: membrosDesejados.map((membro) => membro.userId),
          }),
        },
      });
      const membros = await tx.bpmCardMembro.findMany({
        where: { cardId },
        select: {
          userId: true,
          role: true,
          usuario: { select: { id: true, nome: true, imagemUrl: true } },
        },
        orderBy: { usuario: { nome: "asc" } },
      });
      return { alterado: true, pipelineId: cardAtual.pipelineId, membros };
    });

    if (!resultado.alterado) return { success: true, data: resultado.membros };
    revalidatePath(ROTA_BASE);
    revalidatePath(`${ROTA_BASE}/pipeline/${resultado.pipelineId}`);
    await notificarPipelineBpm({
      pipelineId: resultado.pipelineId,
      cardId,
      tipo: "CARD_ATUALIZADO",
    });
    return { success: true, data: resultado.membros };
  } catch (error) {
    console.error("[AtualizarMembrosCardBpm]", error);
    const mensagem = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : error instanceof Error && error.message === "MEMBRO_CARD_INELEGIVEL"
        ? "Uma ou mais pessoas não estão ativas ou não possuem acesso ao CRM."
        : error instanceof Error && error.message === "CONFLITO_MEMBROS_CARD"
          ? "O card mudou enquanto as pessoas eram vinculadas. Recarregue e tente novamente."
          : "Erro ao atualizar pessoas vinculadas";
    return { success: false, error: mensagem };
  }
}
