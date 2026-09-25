"use server";

import db from "@/lib/prisma";
import { auth } from "../../../auth";
import { exigirAcessoBpmCard, exigirAcessoBpmPipeline } from "@/lib/bpm/ownership";
import { ACOES_JORNADA_ETAPA, projetarPassagensCard } from "@/lib/bpm/jornada-card";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";

/** Lê apenas a componente de cards vinculados que o usuário pode percorrer. */
export async function ObterJornadaCardPipeline(cardId: string, pipelineId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado", data: [] };
    if (!cardId?.trim() || !pipelineId?.trim()) return { success: false as const, error: "Card ou pipeline inválido", data: [] };
    const userId = Number(session.user.id);
    const role = session.user.role ?? null;
    const acessoRaiz = await exigirAcessoBpmCard(cardId, userId, role, "visualizarHistorico");
    await exigirAcessoBpmPipeline(pipelineId, userId);

    const visitados = new Set([cardId]);
    const autorizados = [cardId];
    let fronteira = [cardId];
    while (fronteira.length > 0) {
      const vinculos = await db.bpmCardVinculo.findMany({
        where: { OR: [{ cardOrigemId: { in: fronteira } }, { cardDestinoId: { in: fronteira } }] },
        select: { cardOrigemId: true, cardDestinoId: true },
      });
      const candidatos = [...new Set(vinculos.flatMap((vinculo) => [vinculo.cardOrigemId, vinculo.cardDestinoId]))]
        .filter((id) => !visitados.has(id));
      for (const id of candidatos) visitados.add(id);
      const acessos = await Promise.all(candidatos.map(async (id) => {
        try {
          await exigirAcessoBpmCard(id, userId, role, "visualizarHistorico");
          return id;
        } catch {
          return null;
        }
      }));
      fronteira = acessos.filter((id): id is string => id !== null);
      autorizados.push(...fronteira);
      if (autorizados.length > 1000) throw new Error("Jornada excede o limite de leitura.");
    }

    const cards = await db.bpmCard.findMany({
      where: { id: { in: autorizados }, pipelineId },
      select: {
        id: true, etapaId: true, createdAt: true, updatedAt: true,
        historico: {
          where: { acao: { in: [...ACOES_JORNADA_ETAPA] } },
          select: { id: true, acao: true, valorAnteriorJson: true, valorNovoJson: true, createdAt: true },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const passagens = cards.flatMap(projetarPassagensCard);
    const etapaIds = [...new Set(passagens.map((passagem) => passagem.etapaId))];
    const etapas = etapaIds.length ? await db.bpmEtapa.findMany({
      where: { id: { in: etapaIds }, pipelineId },
      select: { id: true, nome: true, visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } },
    }) : [];
    const nomes = new Map(etapas
      .filter((etapa) => resolverVisibilidadeEtapa(acessoRaiz.perfilGlobal, etapa.visibilidades).podeVer)
      .map((etapa) => [etapa.id, etapa.nome]));
    const data = passagens
      .filter((passagem) => nomes.has(passagem.etapaId))
      .map((passagem) => ({
        ...passagem,
        etapaNome: nomes.get(passagem.etapaId)!,
        cardAtual: passagem.cardId === cardId,
      }))
      .sort((a, b) => (a.entrouEm ?? "").localeCompare(b.entrouEm ?? "") || a.cardId.localeCompare(b.cardId));
    return { success: true as const, data };
  } catch (error) {
    console.error("[ObterJornadaCardPipeline]", error);
    const mensagem = error instanceof Error && error.message === "Não autorizado"
      ? "Não autorizado" : "Erro ao buscar jornada do card";
    return { success: false as const, error: mensagem, data: [] };
  }
}
