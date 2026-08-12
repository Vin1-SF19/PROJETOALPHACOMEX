import "server-only";

import db from "@/lib/prisma";
import {
  AUTOMACAO_ORIGEM_AGENDAR_REUNIAO,
  NOME_ETAPA_AGENDAR_REUNIAO,
  resolverInicioCicloNaEtapa,
} from "@/lib/bpm/agendar-reuniao";
import { carregarCamposObrigatoriosEtapa } from "@/lib/bpm/requisitos-etapa-server";
import { listarCamposObrigatoriosFaltantes } from "@/lib/bpm/requisitos-etapa";
import {
  AUTOMACAO_ORIGEM_NOVOS_LEADS,
  cicloNovosLeadsVencido,
  NOME_ETAPA_NOVOS_LEADS,
  NOME_ETAPA_STANDBY,
} from "@/lib/bpm/novos-leads";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  AUTOMACAO_ORIGEM_REUNIAO_AGENDADA,
  NOME_ETAPA_REUNIAO_AGENDADA,
} from "@/lib/bpm/reuniao-agendada";

type ResumoEtapaFollowUp = {
  etapa: string;
  examinados: number;
  elegiveis: number;
  movidos: number;
  ignorados: number;
  falhos: number;
};

export type ResumoAutomacaoFollowUpBpm = {
  pipelineId: string | null;
  examinados: number;
  elegiveis: number;
  movidos: number;
  ignorados: number;
  falhos: number;
  porEtapa: ResumoEtapaFollowUp[];
  avisos: string[];
};

type ConfiguracaoEtapaFollowUp = {
  id: string;
  nome: string;
  automacaoOrigem: string;
  validarRequisitos: boolean;
};

function criarResumoEtapa(etapa: string): ResumoEtapaFollowUp {
  return { etapa, examinados: 0, elegiveis: 0, movidos: 0, ignorados: 0, falhos: 0 };
}

export async function executarAutomacaoFollowUpBpm(
  agora = new Date(),
): Promise<ResumoAutomacaoFollowUpBpm> {
  const resumo: ResumoAutomacaoFollowUpBpm = {
    pipelineId: null,
    examinados: 0,
    elegiveis: 0,
    movidos: 0,
    ignorados: 0,
    falhos: 0,
    porEtapa: [],
    avisos: [],
  };

  const pipeline = await db.bpmPipeline.findFirst({
    where: { nome: "Revisão de Radar", ativo: true },
    select: {
      id: true,
      etapas: {
        where: {
          nome: {
            in: [
              NOME_ETAPA_NOVOS_LEADS,
              NOME_ETAPA_AGENDAR_REUNIAO,
              NOME_ETAPA_REUNIAO_AGENDADA,
              NOME_ETAPA_STANDBY,
            ],
          },
          ativo: true,
        },
        select: { id: true, nome: true },
      },
    },
  });

  if (!pipeline) {
    resumo.avisos.push("Pipeline Revisão de Radar não encontrado.");
    return resumo;
  }
  resumo.pipelineId = pipeline.id;

  const destino = pipeline.etapas.find((etapa) => etapa.nome === NOME_ETAPA_STANDBY);
  if (!destino) {
    resumo.avisos.push("Etapa Standby - Follow Up não encontrada.");
    return resumo;
  }

  const configuracoes: ConfiguracaoEtapaFollowUp[] = [
    {
      nome: NOME_ETAPA_NOVOS_LEADS,
      automacaoOrigem: AUTOMACAO_ORIGEM_NOVOS_LEADS,
      validarRequisitos: true,
    },
    {
      nome: NOME_ETAPA_AGENDAR_REUNIAO,
      automacaoOrigem: AUTOMACAO_ORIGEM_AGENDAR_REUNIAO,
      validarRequisitos: false,
    },
    {
      nome: NOME_ETAPA_REUNIAO_AGENDADA,
      automacaoOrigem: AUTOMACAO_ORIGEM_REUNIAO_AGENDADA,
      validarRequisitos: false,
    },
  ].flatMap((configuracao) => {
    const etapa = pipeline.etapas.find((item) => item.nome === configuracao.nome);
    if (!etapa) {
      resumo.avisos.push(`Etapa ${configuracao.nome} não encontrada.`);
      return [];
    }
    return [{ ...configuracao, id: etapa.id }];
  });

  if (configuracoes.length === 0) return resumo;

  const cards = await db.bpmCard.findMany({
    where: {
      pipelineId: pipeline.id,
      etapaId: { in: configuracoes.map((configuracao) => configuracao.id) },
      status: "ATIVO",
      proximoContatoEm: null,
    },
    select: { id: true, etapaId: true, createdAt: true },
  });

  const historicos = cards.length > 0
    ? await db.bpmCardHistorico.findMany({
        where: {
          cardId: { in: cards.map((card) => card.id) },
          acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO"] },
        },
        select: { cardId: true, createdAt: true, valorNovoJson: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historicosPorCard = new Map<string, typeof historicos>();
  for (const historico of historicos) {
    const lista = historicosPorCard.get(historico.cardId) ?? [];
    lista.push(historico);
    historicosPorCard.set(historico.cardId, lista);
  }

  for (const configuracao of configuracoes) {
    const resumoEtapa = criarResumoEtapa(configuracao.nome);
    resumo.porEtapa.push(resumoEtapa);
    const cardsEtapa = cards.filter((card) => card.etapaId === configuracao.id);
    resumoEtapa.examinados = cardsEtapa.length;

    const elegiveis = cardsEtapa.filter((card) => {
      const inicioCiclo = configuracao.nome === NOME_ETAPA_NOVOS_LEADS
        ? card.createdAt
        : resolverInicioCicloNaEtapa(
            configuracao.id,
            card.createdAt,
            historicosPorCard.get(card.id) ?? [],
          );
      return cicloNovosLeadsVencido(inicioCiclo, agora);
    });
    resumoEtapa.elegiveis = elegiveis.length;
    resumoEtapa.ignorados = cardsEtapa.length - elegiveis.length;

    const camposObrigatorios = configuracao.validarRequisitos
      ? await carregarCamposObrigatoriosEtapa(pipeline.id, configuracao.id)
      : [];
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
          resumoEtapa.ignorados += 1;
          resumo.avisos.push(
            `Card ${card.id} mantido em ${configuracao.nome} por requisitos pendentes: ${faltantes.map((campo) => campo.nome).join(", ")}.`,
          );
          continue;
        }

        const movido = await db.$transaction(async (tx) => {
          const atualizacao = await tx.bpmCard.updateMany({
            where: {
              id: card.id,
              pipelineId: pipeline.id,
              etapaId: configuracao.id,
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
              automacaoOrigem: configuracao.automacaoOrigem,
              valorAnteriorJson: JSON.stringify({ etapaId: configuracao.id }),
              valorNovoJson: JSON.stringify({ etapaId: destino.id }),
            },
          });
          return true;
        });

        if (!movido) {
          resumoEtapa.ignorados += 1;
          continue;
        }

        resumoEtapa.movidos += 1;
        await notificarPipelineBpm({
          pipelineId: pipeline.id,
          cardId: card.id,
          tipo: "CARD_MOVIDO",
        });
      } catch (error) {
        resumoEtapa.falhos += 1;
        console.error("[AutomacaoFollowUpBpm] Falha ao processar card", {
          cardId: card.id,
          etapa: configuracao.nome,
          error,
        });
      }
    }
  }

  for (const etapa of resumo.porEtapa) {
    resumo.examinados += etapa.examinados;
    resumo.elegiveis += etapa.elegiveis;
    resumo.movidos += etapa.movidos;
    resumo.ignorados += etapa.ignorados;
    resumo.falhos += etapa.falhos;
  }

  return resumo;
}

// Compatibilidade com o entrypoint criado na primeira etapa da entrega.
export const executarAutomacaoNovosLeads = executarAutomacaoFollowUpBpm;
