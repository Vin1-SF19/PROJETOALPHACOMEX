"use server";
import { lerUsuariosAutorizadosPipeline } from "@/lib/bpm/acesso-individual-pipeline";
import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import {
  checarAcessoBpmPipeline,
  checarAcessoConfigPipeline,
  exigirAcessoModuloBpm,
} from "@/lib/bpm/ownership";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { contarCardsVisiveisPorEtapaNoQuadro } from "@/lib/bpm/cards-no-quadro";
import { isAdminRole, isSameRole } from "@/lib/roles";

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDiaSaoPaulo(data: Date): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(data);
  const ano = Number(partes.find((parte) => parte.type === "year")?.value);
  const mes = Number(partes.find((parte) => parte.type === "month")?.value);
  const dia = Number(partes.find((parte) => parte.type === "day")?.value);
  // America/Sao_Paulo currently uses UTC-3 year round.
  return new Date(Date.UTC(ano, mes - 1, dia, 3));
}

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
    const papelConsolidado = isAdminRole(session.user.role ?? null);
    const [usuarioAtual, etapas] = await Promise.all([
      db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
      db.bpmEtapa.findMany({
        where: { pipeline: { ativo: true } },
        select: {
          id: true,
          visibilidades: {
            select: { perfil: true, podeVer: true, podeAgir: true },
          },
        },
      }),
    ]);
    const etapaIdsVisiveis = etapas
      .filter((etapa) => resolverVisibilidadeEtapa(
        usuarioAtual?.role,
        etapa.visibilidades,
      ).podeVer)
      .map((etapa) => etapa.id);
    const filtroEtapasVisiveis = { etapaId: { in: etapaIdsVisiveis } };
    const filtroCardVisivel = filtroEtapasVisiveis;

    const [pipelines, contagemPorPipelineStatus] = await Promise.all([
      db.bpmPipeline.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          visualizacaoConfigJson: true,
          setores: { select: { setor: { select: { nome: true } } } },
          etapas: {
            where: { ativo: true },
            select: {
              id: true,
              nome: true,
              ordem: true,
              visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } },
            },
            orderBy: { ordem: "asc" },
          },
        },
        orderBy: { nome: "asc" },
      }),
      db.bpmCard.groupBy({
        by: ["pipelineId", "status"],
        where: filtroCardVisivel,
        _count: { _all: true },
      }),
    ]);

    const acessoPipelines = await Promise.all(
      pipelines.map((pipeline) => checarAcessoBpmPipeline(pipeline.id, userId)),
    );
    const pipelinesVisiveis = pipelines.filter((pipeline, index) =>
      acessoPipelines[index]
      && (papelConsolidado || lerUsuariosAutorizadosPipeline(pipeline.visualizacaoConfigJson).includes(userId) || pipeline.setores.some(({ setor }) => isSameRole(setor.nome, usuarioAtual?.role))),
    );
    const pipelineIdsVisiveis = pipelinesVisiveis.map((pipeline) => pipeline.id);

    const escopoLeitura = await carregarEscopoLeituraBpm(userId, admin);
    const cardIdsDoUsuario = admin
      ? null
      : (
          await db.bpmCard.findMany({
            where: { ...filtroCardVisivel, pipelineId: { in: pipelineIdsVisiveis }, ...escopoLeitura.where },
            select: { id: true },
          })
        ).map((m) => m.id);

    const agora = new Date();
    const inicioHoje = inicioDoDiaSaoPaulo(agora);
    const inicioAmanha = new Date(inicioHoje.getTime() + DIA_MS);
    const inicioOntem = new Date(inicioHoje.getTime() - DIA_MS);
    const inicioSemana = new Date(inicioHoje.getTime() - 6 * DIA_MS);
    const inicioSemanaAnterior = new Date(inicioSemana.getTime() - 7 * DIA_MS);
    const inicioSemanaAtual = new Date(inicioHoje.getTime() + DIA_MS);
    const filtroTarefasPendentes = {
      status: "PENDENTE",
      card: filtroCardVisivel,
      ...(admin ? {} : { cardId: { in: cardIdsDoUsuario ?? [] } }),
    } as const;
    const filtroCardsVisiveis = {
      pipelineId: { in: pipelineIdsVisiveis },
      etapaId: { in: etapaIdsVisiveis },
      ...(admin ? {} : { id: { in: cardIdsDoUsuario ?? [] } }),
    } as const;

    const [
      tarefasPendentes, tarefasAtrasadas, historicoRecente, concluidasSemana,
      tarefasPendentesCount, tarefasHojeCount, tarefasOntemCount, tarefasSemana,
      novosCardsSemana, novosCardsSemanaAnterior,
    ] = await Promise.all([
      db.bpmTarefa.findMany({
        where: {
          ...filtroTarefasPendentes,
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
          responsavel: { select: { nome: true } },
        },
        orderBy: { prazo: "asc" },
        take: 50,
      }),
      db.bpmTarefa.count({
        where: {
          ...filtroTarefasPendentes,
          prazo: { lt: agora },
        },
      }),
      db.bpmCardHistorico.findMany({
        where: admin
          ? { card: { pipelineId: { in: pipelineIdsVisiveis }, ...filtroCardVisivel } }
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
            ? { pipelineId: { in: pipelineIdsVisiveis }, ...filtroCardVisivel }
            : { id: { in: cardIdsDoUsuario ?? [] } }),
        },
      }),
      db.bpmTarefa.count({ where: filtroTarefasPendentes }),
      db.bpmTarefa.count({ where: { ...filtroTarefasPendentes, prazo: { gte: inicioHoje, lt: inicioAmanha } } }),
      db.bpmTarefa.count({ where: { ...filtroTarefasPendentes, prazo: { gte: inicioOntem, lt: inicioHoje } } }),
      db.bpmTarefa.findMany({
        where: { ...filtroTarefasPendentes, prazo: { gte: inicioSemana, lt: inicioSemanaAtual } },
        select: { prazo: true },
      }),
      db.bpmCard.count({
        where: { ...filtroCardsVisiveis, status: "ATIVO", createdAt: { gte: inicioSemana, lt: inicioSemanaAtual } },
      }),
      db.bpmCard.count({
        where: { ...filtroCardsVisiveis, status: "ATIVO", createdAt: { gte: inicioSemanaAnterior, lt: inicioSemana } },
      }),
    ]);

    const contagemVisivel = admin
      ? contagemPorPipelineStatus.filter((item) => pipelineIdsVisiveis.includes(item.pipelineId))
      : await db.bpmCard.groupBy({
          by: ["pipelineId", "status"],
          where: {
            id: { in: cardIdsDoUsuario ?? [] },
            pipelineId: { in: pipelineIdsVisiveis },
            ...filtroCardVisivel,
          },
          _count: { _all: true },
        });
    const totalAtivos = contagemVisivel
      .filter((c) => c.status === "ATIVO")
      .reduce((acc, c) => acc + c._count._all, 0);
    const contagensPorEtapaNoQuadro = await Promise.all(pipelinesVisiveis.map((pipeline) =>
      contarCardsVisiveisPorEtapaNoQuadro(pipeline.id, userId, usuarioAtual?.role ?? null, admin)));
    const contagensQuadro = contagensPorEtapaNoQuadro.map((contagens) =>
      contagens.reduce((total, etapa) => total + etapa.quantidade, 0));
    const pipelinesComContagemVisivel = pipelinesVisiveis.map((pipeline, index) => {
      const etapasVisiveis = pipeline.etapas.filter((etapa) => resolverVisibilidadeEtapa(
        usuarioAtual?.role,
        etapa.visibilidades,
      ).podeVer);
      const etapas = etapasVisiveis.map((etapa) => ({
        id: etapa.id,
        nome: etapa.nome,
        ordem: etapa.ordem,
        cardsVisiveis: contagensPorEtapaNoQuadro[index].find((item) => item.etapaId === etapa.id)?.quantidade ?? 0,
      }));
      const totalVisiveisPipeline = etapas.reduce((total, etapa) => total + etapa.cardsVisiveis, 0);
      return {
        id: pipeline.id,
        nome: pipeline.nome,
        etapas,
        cardsVisiveis: totalVisiveisPipeline,
        _count: { cards: contagensQuadro[index] },
      };
    });

    const tarefaHojePorDia = Array.from({ length: 7 }, (_, index) => {
      const inicio = new Date(inicioSemana.getTime() + index * DIA_MS);
      const fim = new Date(inicio.getTime() + DIA_MS);
      return tarefasSemana.filter((tarefa) => tarefa.prazo && tarefa.prazo >= inicio && tarefa.prazo < fim).length;
    });

    return {
      success: true,
      data: {
        pipelines: pipelinesComContagemVisivel,
        contagemPorPipelineStatus: contagemVisivel,
        totalAtivos,
        concluidasSemana,
        tarefasPendentesCount,
        tarefasHojeCount,
        tarefasOntemCount,
        tarefasHojePorDia: tarefaHojePorDia,
        novosCardsSemana,
        novosCardsSemanaAnterior,
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
