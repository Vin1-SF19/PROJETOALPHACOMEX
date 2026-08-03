"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";

/**
 * Perfil consolidado de uma empresa (Empresa = `clientes`, D-049): todos os
 * BpmCard dela em qualquer pipeline, agrupados, + histórico consolidado de
 * todos esses cards. Não há ownership check restritivo por card individual
 * aqui — é uma visão agregada por empresa, exige apenas sessão autenticada,
 * igual ao padrão de outras consultas agregadas do painel (ex.: buscarClientes).
 */
export async function ObterPerfilEmpresaBpm(empresaId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const empresa = await db.clientes.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, status: true },
    });
    if (!empresa) return { success: false, error: "Empresa não encontrada" };

    const cards = await db.bpmCard.findMany({
      where: { empresaId },
      select: {
        id: true,
        status: true,
        servico: true,
        createdAt: true,
        concluidoEm: true,
        pipeline: { select: { id: true, nome: true } },
        etapa: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        _count: { select: { tarefas: true, anexos: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const cardIds = cards.map((c) => c.id);

    const historico = cardIds.length
      ? await db.bpmCardHistorico.findMany({
          where: { cardId: { in: cardIds } },
          include: {
            card: { select: { id: true, pipeline: { select: { nome: true } } } },
            usuario: { select: { id: true, nome: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

    const cardsPorPipeline = new Map<string, typeof cards>();
    for (const card of cards) {
      const chave = card.pipeline.nome;
      if (!cardsPorPipeline.has(chave)) cardsPorPipeline.set(chave, []);
      cardsPorPipeline.get(chave)!.push(card);
    }

    return {
      success: true,
      data: {
        empresa,
        cardsPorPipeline: Array.from(cardsPorPipeline.entries()).map(([pipelineNome, cardsDoPipeline]) => ({
          pipelineNome,
          cards: cardsDoPipeline,
        })),
        totalCards: cards.length,
        historico,
      },
    };
  } catch (error) {
    console.error("[ObterPerfilEmpresaBpm]", error);
    return { success: false, error: "Erro ao buscar perfil da empresa" };
  }
}
