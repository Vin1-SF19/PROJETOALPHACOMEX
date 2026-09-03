import "server-only";

import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { resolverInicioCicloNaEtapa } from "@/lib/bpm/agendar-reuniao";

type ClienteFila = Prisma.TransactionClient | typeof db;

const ACOES_MOVIMENTO = ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO"];

async function criarExecucaoIdempotente(
  client: ClienteFila,
  dados: {
    automacaoId: string;
    cardId: string;
    eventoChave: string;
    gatilhoTipo: string;
  },
): Promise<boolean> {
  const existente = await client.bpmAutomacaoExecucao.findUnique({
    where: {
      automacaoId_eventoChave: {
        automacaoId: dados.automacaoId,
        eventoChave: dados.eventoChave,
      },
    },
    select: { id: true },
  });
  if (existente) return false;

  try {
    await client.bpmAutomacaoExecucao.create({ data: dados });
    return true;
  } catch (error) {
    if (
      typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: unknown }).code === "P2002"
    ) return false;
    throw error;
  }
}
export async function enfileirarAutomacoesMovimentoBpm(
  dados: {
    cardId: string;
    pipelineId: string;
    etapaOrigemId: string;
    etapaDestinoId: string;
    eventoId: string;
  },
  client: ClienteFila = db,
): Promise<number> {
  const automacoes = await client.bpmAutomacao.findMany({
    where: {
      pipelineId: dados.pipelineId,
      ativa: true,
      OR: [
        { etapaId: dados.etapaOrigemId, gatilhoTipo: "SAIR_COLUNA" },
        { etapaId: dados.etapaDestinoId, gatilhoTipo: "ENTRAR_COLUNA" },
      ],
    },
    select: { id: true, etapaId: true, gatilhoTipo: true },
  });

  let criadas = 0;
  for (const automacao of automacoes) {
    const foiCriada = await criarExecucaoIdempotente(client, {
      automacaoId: automacao.id,
      cardId: dados.cardId,
      eventoChave: `MOVIMENTO:${dados.eventoId}:${automacao.gatilhoTipo}`,
      gatilhoTipo: automacao.gatilhoTipo,
    });
    if (foiCriada) criadas += 1;
  }
  return criadas;
}

export async function materializarAutomacoesTempoBpm(
  agora = new Date(),
): Promise<{ examinados: number; enfileirados: number }> {
  const automacoes = await db.bpmAutomacao.findMany({
    where: {
      ativa: true,
      gatilhoTipo: "TEMPO_NA_COLUNA",
      tempoMinutos: { not: null },
    },
    select: { id: true, pipelineId: true, etapaId: true, tempoMinutos: true },
  });

  let examinados = 0;
  let enfileirados = 0;
  for (const automacao of automacoes) {
    const cards = await db.bpmCard.findMany({
      where: {
        pipelineId: automacao.pipelineId,
        etapaId: automacao.etapaId,
        status: "ATIVO",
      },
      select: { id: true, createdAt: true },
    });
    examinados += cards.length;
    if (cards.length === 0) continue;

    const historicos = await db.bpmCardHistorico.findMany({
      where: {
        cardId: { in: cards.map((card) => card.id) },
        acao: { in: ACOES_MOVIMENTO },
      },
      select: { id: true, cardId: true, createdAt: true, valorNovoJson: true },
      orderBy: { createdAt: "desc" },
    });
    const porCard = new Map<string, typeof historicos>();
    for (const historico of historicos) {
      const lista = porCard.get(historico.cardId) ?? [];
      lista.push(historico);
      porCard.set(historico.cardId, lista);
    }

    for (const card of cards) {
      const inicio = resolverInicioCicloNaEtapa(
        automacao.etapaId,
        card.createdAt,
        porCard.get(card.id) ?? [],
      );
      const limite = (automacao.tempoMinutos ?? 0) * 60_000;
      if (agora.getTime() - inicio.getTime() < limite) continue;
      const criada = await criarExecucaoIdempotente(db, {
        automacaoId: automacao.id,
        cardId: card.id,
        eventoChave: `TEMPO:${automacao.etapaId}:${inicio.getTime()}`,
        gatilhoTipo: "TEMPO_NA_COLUNA",
      });
      if (criada) enfileirados += 1;
    }
  }
  return { examinados, enfileirados };
}
