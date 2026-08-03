"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { isAdminRole } from "@/lib/bpm/ownership";

/**
 * Agregação central do módulo BPM (Fase 3): métricas por pipeline, tarefas
 * pendentes/atrasadas do usuário (ou de todos, se admin — D-042 não se aplica
 * aqui, é visão de leitura) e feed de atividade recente cross-card.
 */
export async function ObterDashboardBpm() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);
    const admin = isAdminRole(session.user.role ?? null);

    const [pipelines, contagemPorPipelineStatus] = await Promise.all([
      db.bpmPipeline.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          _count: { select: { cards: true } },
        },
        orderBy: { nome: "asc" },
      }),
      db.bpmCard.groupBy({
        by: ["pipelineId", "status"],
        _count: { _all: true },
      }),
    ]);

    const cardIdsDoUsuario = admin
      ? null
      : (
          await db.bpmCardMembro.findMany({
            where: { userId },
            select: { cardId: true },
          })
        ).map((m) => m.cardId);

    const agora = new Date();

    const [tarefasPendentes, tarefasAtrasadas, historicoRecente, concluidasSemana] = await Promise.all([
      db.bpmTarefa.findMany({
        where: {
          status: "PENDENTE",
          ...(admin ? {} : { cardId: { in: cardIdsDoUsuario ?? [] } }),
        },
        select: {
          id: true,
          titulo: true,
          prazo: true,
          prioridade: true,
          cardId: true,
          card: {
            select: {
              id: true,
              empresa: { select: { razaoSocial: true } },
              pipeline: { select: { nome: true } },
            },
          },
        },
        orderBy: { prazo: "asc" },
        take: 50,
      }),
      db.bpmTarefa.count({
        where: {
          status: "PENDENTE",
          prazo: { lt: agora },
          ...(admin ? {} : { cardId: { in: cardIdsDoUsuario ?? [] } }),
        },
      }),
      db.bpmCardHistorico.findMany({
        select: {
          id: true,
          acao: true,
          createdAt: true,
          usuario: { select: { id: true, nome: true } },
          card: {
            select: {
              id: true,
              empresa: { select: { razaoSocial: true } },
              pipeline: { select: { nome: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.bpmCard.count({
        where: {
          status: "CONCLUIDO",
          concluidoEm: { gte: new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalAtivos = contagemPorPipelineStatus
      .filter((c) => c.status === "ATIVO")
      .reduce((acc, c) => acc + c._count._all, 0);

    return {
      success: true,
      data: {
        pipelines,
        contagemPorPipelineStatus,
        totalAtivos,
        concluidasSemana,
        tarefasPendentes,
        tarefasAtrasadasCount: tarefasAtrasadas,
        historicoRecente,
      },
    };
  } catch (error) {
    console.error("[ObterDashboardBpm]", error);
    return { success: false, error: "Erro ao carregar dashboard" };
  }
}
