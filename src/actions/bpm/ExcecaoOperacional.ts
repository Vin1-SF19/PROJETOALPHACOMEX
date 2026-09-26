"use server";

import { z } from "zod";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { executarAutomacoesCentraisDoCardAgora } from "@/lib/bpm/automacoes/orquestrador";
import { revalidatePath } from "next/cache";

const entradaSchema = z.object({ cardId: z.string().min(1), motivo: z.string().trim().min(20).max(1000) }).strict();
const CHAVE_AUTOMACAO = "financeiro.handoff.contrato.concluido.operacional";

/** Exceção por contratação, restrita à liberação operacional; não altera os requisitos financeiros. */
export async function AutorizarExcecaoLiberacaoOperacionalBpm(entrada: unknown) {
  try {
    const parsed = entradaSchema.safeParse(entrada);
    if (!parsed.success) throw new Error("Informe um motivo com pelo menos 20 caracteres.");
    const session = await auth();
    if (!session?.user?.id || !isAdminRole(session.user.role)) throw new Error("Somente Admin, CEO ou TI podem autorizar a exceção.");
    const userId = Number(session.user.id);
    const { cardId, motivo } = parsed.data;
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");
    await db.$transaction(async (tx) => {
      const card = await tx.bpmCard.findFirst({
        where: { id: cardId, status: "CONCLUIDO", etapa: { chave: "contratacao_finalizada" }, pipeline: { chave: "financeiro" } },
        select: { id: true, pipelineId: true },
      });
      if (!card) throw new Error("A contratação financeira precisa estar concluída.");
      const vinculo = await tx.bpmCardVinculo.findFirst({
        where: { cardOrigemId: cardId, cardDestino: { pipeline: { chave: "operacional" }, status: { not: "ARQUIVADO" } } },
        select: { id: true },
      });
      if (vinculo) throw new Error("A contratação já foi liberada ao Operacional.");
      const automacao = await tx.bpmAutomacao.findUnique({
        where: { pipelineId_chave: { pipelineId: card.pipelineId, chave: CHAVE_AUTOMACAO } }, select: { id: true, ativa: true },
      });
      if (!automacao?.ativa) throw new Error("Automação de liberação operacional indisponível.");
      const falha = await tx.bpmAutomacaoExecucao.findFirst({
        where: { cardId, automacaoId: automacao.id, status: "FALHA" },
        orderBy: { iniciadoEm: "desc" }, select: { id: true, mensagemErro: true },
      });
      if (!falha?.mensagemErro?.includes("Campos obrigatórios:")) {
        throw new Error("Não existe uma liberação bloqueada por dados de execução para autorizar.");
      }
      const historico = await tx.bpmCardHistorico.create({ data: {
        cardId, acao: "EXCECAO_LIBERACAO_OPERACIONAL", usuarioId: userId,
        valorNovoJson: JSON.stringify({ motivo, falhaExecucaoId: falha.id, pendencias: falha.mensagemErro }),
      } });
      const reaberta = await tx.bpmAutomacaoExecucao.updateMany({
        where: { id: falha.id, status: "FALHA" },
        data: { status: "PENDENTE", tentativas: 0, disponivelEm: new Date(), proximaTentativaEm: null,
          executadoEm: null, claimToken: null, mensagemErro: null, resultadoJson: null },
      });
      if (reaberta.count !== 1) throw new Error("A liberação mudou. Recarregue e tente novamente.");
      return historico.id;
    });
    await executarAutomacoesCentraisDoCardAgora(cardId);
    const destino = await db.bpmCardVinculo.findFirst({
      where: { cardOrigemId: cardId, cardDestino: { pipeline: { chave: "operacional" }, status: { not: "ARQUIVADO" } } },
      select: { cardDestinoId: true },
    });
    revalidatePath("/PainelAlpha/AlphaCRM");
    if (!destino) return { success: false as const, error: "Exceção registrada, mas a liberação ainda falhou. Consulte a execução da automação." };
    return { success: true as const, data: { cardOperacionalId: destino.cardDestinoId } };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível autorizar a exceção." };
  }
}
