import "server-only";

import db from "@/lib/prisma";
import { carregarCamposObrigatoriosEtapa } from "@/lib/bpm/requisitos-etapa-server";
import { listarCamposObrigatoriosFaltantes } from "@/lib/bpm/requisitos-etapa";
import {
  AUTOMACAO_ORIGEM_NOVOS_LEADS,
  cicloNovosLeadsVencido,
  NOME_ETAPA_NOVOS_LEADS,
  NOME_ETAPA_STANDBY,
} from "@/lib/bpm/novos-leads";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

export type ResumoAutomacaoNovosLeads = {
  pipelineId: string | null;
  examinados: number;
  elegiveis: number;
  movidos: number;
  ignorados: number;
  falhos: number;
  avisos: string[];
};

export async function executarAutomacaoNovosLeads(
  agora = new Date(),
): Promise<ResumoAutomacaoNovosLeads> {
  const resumo: ResumoAutomacaoNovosLeads = {
    pipelineId: null,
    examinados: 0,
    elegiveis: 0,
    movidos: 0,
    ignorados: 0,
    falhos: 0,
    avisos: [],
  };

  const pipeline = await db.bpmPipeline.findFirst({
    where: { nome: "Revisão de Radar", ativo: true },
    select: {
      id: true,
      etapas: {
        where: { nome: { in: [NOME_ETAPA_NOVOS_LEADS, NOME_ETAPA_STANDBY] }, ativo: true },
        select: { id: true, nome: true },
      },
    },
  });

  if (!pipeline) {
    resumo.avisos.push("Pipeline Revisão de Radar não encontrado.");
    return resumo;
  }
  resumo.pipelineId = pipeline.id;

  const origem = pipeline.etapas.find((etapa) => etapa.nome === NOME_ETAPA_NOVOS_LEADS);
  const destino = pipeline.etapas.find((etapa) => etapa.nome === NOME_ETAPA_STANDBY);
  if (!origem || !destino) {
    resumo.avisos.push("Etapa Novos leads ou Standby - Follow Up não encontrada.");
    return resumo;
  }

  const cards = await db.bpmCard.findMany({
    where: {
      pipelineId: pipeline.id,
      etapaId: origem.id,
      status: "ATIVO",
      proximoContatoEm: null,
    },
    select: { id: true, createdAt: true },
  });
  resumo.examinados = cards.length;

  const elegiveis = cards.filter((card) => cicloNovosLeadsVencido(card.createdAt, agora));
  resumo.elegiveis = elegiveis.length;
  resumo.ignorados = cards.length - elegiveis.length;

  const camposObrigatorios = await carregarCamposObrigatoriosEtapa(
    pipeline.id,
    origem.id,
  );
  const valoresPersistidos = elegiveis.length > 0 && camposObrigatorios.length > 0
    ? await db.bpmCardCampoValor.findMany({
        where: {
          cardId: { in: elegiveis.map((card) => card.id) },
          campoId: { in: camposObrigatorios.map((campo) => campo.id) },
        },
        select: { cardId: true, campoId: true, valor: true },
      })
    : [];
  const valoresPorCard = new Map<string, Record<string, string | null>>();
  for (const valor of valoresPersistidos) {
    const valores = valoresPorCard.get(valor.cardId) ?? {};
    valores[valor.campoId] = valor.valor;
    valoresPorCard.set(valor.cardId, valores);
  }

  for (const card of elegiveis) {

    try {
      const faltantes = listarCamposObrigatoriosFaltantes(
        camposObrigatorios,
        valoresPorCard.get(card.id) ?? {},
      );
      if (faltantes.length > 0) {
        resumo.ignorados += 1;
        resumo.avisos.push(
          `Card ${card.id} mantido em Novos leads por requisitos pendentes: ${faltantes.map((campo) => campo.nome).join(", ")}.`,
        );
        continue;
      }

      const movido = await db.$transaction(async (tx) => {
        const atualizacao = await tx.bpmCard.updateMany({
          where: {
            id: card.id,
            pipelineId: pipeline.id,
            etapaId: origem.id,
            status: "ATIVO",
            proximoContatoEm: null,
          },
          data: { etapaId: destino.id },
        });
        if (atualizacao.count !== 1) return false;

        await tx.bpmCardHistorico.create({
          data: {
            cardId: card.id,
            acao: "CARD_MOVIDO_POR_AUTOMACAO",
            automacaoOrigem: AUTOMACAO_ORIGEM_NOVOS_LEADS,
            valorAnteriorJson: JSON.stringify({ etapaId: origem.id }),
            valorNovoJson: JSON.stringify({ etapaId: destino.id }),
          },
        });
        return true;
      });

      if (!movido) {
        resumo.ignorados += 1;
        continue;
      }

      resumo.movidos += 1;
      await notificarPipelineBpm({
        pipelineId: pipeline.id,
        cardId: card.id,
        tipo: "CARD_MOVIDO",
      });
    } catch (error) {
      resumo.falhos += 1;
      console.error("[AutomacaoNovosLeads] Falha ao processar card", {
        cardId: card.id,
        error,
      });
    }
  }

  return resumo;
}
