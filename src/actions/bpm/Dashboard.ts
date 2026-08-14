"use server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import {
  checarAcessoBpmPipeline,
  checarAcessoConfigPipeline,
  checarAcessoDiretoriaBpm,
  exigirAcessoModuloBpm,
} from "@/lib/bpm/ownership";
import { NOME_ETAPA_BOAS_VINDAS } from "@/lib/bpm/boas-vindas";

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
    await exigirAcessoModuloBpm(userId);
    const admin = await checarAcessoConfigPipeline(userId, "visualizarPipeline");
    const diretoria = await checarAcessoDiretoriaBpm(userId);
    const filtroCardBoasVindas = diretoria
      ? {}
      : { etapa: { nome: { not: NOME_ETAPA_BOAS_VINDAS } } };

    const [pipelines, contagemPorPipelineStatus] = await Promise.all([
      db.bpmPipeline.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
        },
        orderBy: { nome: "asc" },
      }),
      db.bpmCard.groupBy({
        by: ["pipelineId", "status"],
        where: filtroCardBoasVindas,
        _count: { _all: true },
      }),
    ]);

    const cardIdsDoUsuario = admin
      ? null
      : (
          await db.bpmCardMembro.findMany({
            where: { userId, card: filtroCardBoasVindas },
            select: { cardId: true },
          })
        ).map((m) => m.cardId);
    const acessoPipelines = await Promise.all(
      pipelines.map((pipeline) => checarAcessoBpmPipeline(pipeline.id, userId)),
    );
    const pipelinesVisiveis = pipelines.filter((_, index) => acessoPipelines[index]);
    const pipelineIdsVisiveis = pipelinesVisiveis.map((pipeline) => pipeline.id);

    const agora = new Date();

    const [tarefasPendentes, tarefasAtrasadas, historicoRecente, concluidasSemana] = await Promise.all([
      db.bpmTarefa.findMany({
        where: {
          status: "PENDENTE",
          ...(diretoria ? {} : { card: filtroCardBoasVindas }),
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
          ...(diretoria ? {} : { card: filtroCardBoasVindas }),
          ...(admin ? {} : { cardId: { in: cardIdsDoUsuario ?? [] } }),
        },
      }),
      db.bpmCardHistorico.findMany({
        where: admin
          ? { card: { pipelineId: { in: pipelineIdsVisiveis }, ...filtroCardBoasVindas } }
          : { cardId: { in: cardIdsDoUsuario ?? [] } },
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
          ...(admin
            ? { pipelineId: { in: pipelineIdsVisiveis }, ...filtroCardBoasVindas }
            : { id: { in: cardIdsDoUsuario ?? [] } }),
        },
      }),
    ]);

    const contagemVisivel = admin
      ? contagemPorPipelineStatus.filter((item) => pipelineIdsVisiveis.includes(item.pipelineId))
      : await db.bpmCard.groupBy({
          by: ["pipelineId", "status"],
          where: {
            id: { in: cardIdsDoUsuario ?? [] },
            pipelineId: { in: pipelineIdsVisiveis },
            ...filtroCardBoasVindas,
          },
          _count: { _all: true },
        });
    const totalAtivos = contagemVisivel
      .filter((c) => c.status === "ATIVO")
      .reduce((acc, c) => acc + c._count._all, 0);
    const pipelinesComContagemVisivel = pipelinesVisiveis.map((pipeline) => ({
      ...pipeline,
      _count: {
        cards: contagemVisivel
          .filter((item) => item.pipelineId === pipeline.id)
          .reduce((total, item) => total + item._count._all, 0),
      },
    }));

    return {
      success: true,
      data: {
        pipelines: pipelinesComContagemVisivel,
        contagemPorPipelineStatus: contagemVisivel,
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
