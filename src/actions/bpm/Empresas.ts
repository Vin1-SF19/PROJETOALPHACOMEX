"use server";
import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";
import db from "@/lib/prisma";
import { auth } from "../../../auth";
import {
  checarAcessoConfigPipeline,
  exigirAcessoBpmCard,
  exigirAcessoModuloBpm,
} from "@/lib/bpm/ownership";
import { carregarDadosEmpresaCard } from "@/lib/bpm/dados-empresa-server";
import { podeVerEtapaPipeline } from "@/lib/bpm/acesso-pipeline";

/**
 * Consolida, sem mutações, os dados da empresa usados por Pré-Análise, CS&NPS,
 * Radar Fiscal e pelo próprio card. O ownership é validado antes de qualquer
 * consulta aos dados empresariais.
 */
export async function ObterDadosEmpresaCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: null };
    const userId = Number(session.user.id);

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizar");

    const data = await carregarDadosEmpresaCard(cardId);
    return data ? { success: true, data } : { success: false, error: "Card não encontrado", data: null };
  } catch (error) {
    console.error("[ObterDadosEmpresaCardBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado"
      : "Erro ao buscar dados da empresa";
    return { success: false, error: msg, data: null };
  }
}

/**
 * Perfil consolidado de uma empresa (Empresa = `Cliente`, Cliente Master): todos os
 * BpmCard dela em qualquer pipeline, agrupados, + histórico consolidado de
 * todos esses cards. Não há ownership check restritivo por card individual
 * aqui — é uma visão agregada por empresa que exige acesso efetivo ao CRM,
 * ao funil e à coluna de cada card retornado.
 */
export async function ObterPerfilEmpresaBpm(empresaId: number) {
  try {
    const session = await auth();
    const userId = Number(session?.user?.id);
    if (Number.isFinite(userId)) await exigirAcessoModuloBpm(userId);
    const admin = Number.isFinite(userId)
      && await checarAcessoConfigPipeline(userId, "visualizarPipeline");
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const [usuarioAtual, etapas] = await Promise.all([
      db.usuarios.findUnique({ where: { id: userId }, select: { role: true } }),
      db.bpmEtapa.findMany({ select: { id: true, pipeline: { select: { visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } } } }, visibilidades: {
        select: { perfil: true, podeVer: true, podeAgir: true },
      } } }),
    ]);
    const etapaIdsVisiveis = etapas.filter((etapa) => {
      const entrada = { usuarioId: userId, role: usuarioAtual?.role ?? "",
        visualizacaoConfigJson: etapa.pipeline.visualizacaoConfigJson,
        setoresPipeline: etapa.pipeline.setores.map(({ setor }) => setor) };
      return podeVerEtapaPipeline(entrada, etapa.visibilidades);
    }).map((etapa) => etapa.id);

    const empresa = await db.cliente.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, status: true },
    });
    if (!empresa) return { success: false, error: "Empresa não encontrada" };

    const escopoLeitura = await carregarEscopoLeituraBpm(userId, admin);
    const cards = await db.bpmCard.findMany({
      where: {
        empresaId,
        etapaId: { in: etapaIdsVisiveis },
        ...escopoLeitura.where,
      },
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
    if (cardIds.length === 0) return { success: false, error: "Empresa não encontrada" };

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
