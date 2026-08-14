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
  ACAO_LIGACOES_NOVOS_LEADS_PLANEJADAS,
  AUTOMACAO_ORIGEM_LIGACOES_NOVOS_LEADS,
  AUTOMACAO_ORIGEM_NOVOS_LEADS,
  calcularDiaCicloNovosLeads,
  calcularLigacoesPendentesNoDia,
  cicloNovosLeadsVencido,
  followUpStandbyEstaVencido,
  intervaloDiaCivilSaoPaulo,
  META_LIGACOES_NOVOS_LEADS,
  NOME_ETAPA_NOVOS_LEADS,
  NOME_ETAPA_STANDBY,
  TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS,
} from "@/lib/bpm/novos-leads";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  AUTOMACAO_ORIGEM_REUNIAO_AGENDADA,
  NOME_ETAPA_REUNIAO_AGENDADA,
} from "@/lib/bpm/reuniao-agendada";
import {
  ACAO_MONITORAMENTO_EXECUTADO,
  AUTOMACAO_ORIGEM_MONITORAMENTO,
  calcularProximaRevisaoMonitoramento,
  monitoramentoEstaVencido,
  NOME_ETAPA_MONITORAMENTO,
  TITULO_TAREFA_MONITORAMENTO,
} from "@/lib/bpm/monitoramento";

type ResumoEtapaFollowUp = {
  etapa: string;
  examinados: number;
  elegiveis: number;
  movidos: number;
  ignorados: number;
  falhos: number;
};

type ResumoStandbyFollowUp = {
  examinados: number;
  elegiveis: number;
  tarefasCriadas: number;
  interrompidos: number;
  ignorados: number;
  falhos: number;
};

type ResumoMonitoramento = {
  examinados: number;
  elegiveis: number;
  tarefasCriadas: number;
  ignorados: number;
  falhos: number;
};

type ResumoLigacoesNovosLeads = {
  examinados: number;
  tentativasRegistradas: number;
  tarefasCriadas: number;
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
  ligacoesNovosLeads: ResumoLigacoesNovosLeads;
  standby: ResumoStandbyFollowUp;
  monitoramento: ResumoMonitoramento;
  avisos: string[];
};

type ConfiguracaoEtapaFollowUp = {
  id: string;
  nome: string;
  automacaoOrigem: string;
  validarRequisitos: boolean;
};

type PipelineAutomacaoBpm = {
  id: string;
  etapas: Array<{ id: string; nome: string }>;
};

function criarResumoEtapa(etapa: string): ResumoEtapaFollowUp {
  return { etapa, examinados: 0, elegiveis: 0, movidos: 0, ignorados: 0, falhos: 0 };
}

function criarResumoStandby(): ResumoStandbyFollowUp {
  return { examinados: 0, elegiveis: 0, tarefasCriadas: 0, interrompidos: 0, ignorados: 0, falhos: 0 };
}

function criarResumoMonitoramento(): ResumoMonitoramento {
  return { examinados: 0, elegiveis: 0, tarefasCriadas: 0, ignorados: 0, falhos: 0 };
}

function criarResumoLigacoesNovosLeads(): ResumoLigacoesNovosLeads {
  return { examinados: 0, tentativasRegistradas: 0, tarefasCriadas: 0, ignorados: 0, falhos: 0 };
}

/** Executa Monitoramento independentemente de a etapa Standby existir. */
async function executarAutomacaoMonitoramentoBpm(params: {
  pipeline: PipelineAutomacaoBpm;
  agora: Date;
  resumo: ResumoMonitoramento;
  avisos: string[];
}) {
  const { pipeline, agora, resumo, avisos } = params;
  const etapaMonitoramento = pipeline.etapas.find((etapa) => etapa.nome === NOME_ETAPA_MONITORAMENTO);
  if (!etapaMonitoramento) {
    avisos.push("Etapa Monitoramento não encontrada.");
    return;
  }

  const cardsMonitoramento = await db.bpmCard.findMany({
    where: {
      pipelineId: pipeline.id,
      etapaId: etapaMonitoramento.id,
      status: "ATIVO",
    },
    select: {
      id: true,
      responsavelId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  resumo.examinados = cardsMonitoramento.length;

  const historicosMonitoramento = cardsMonitoramento.length > 0
    ? await db.bpmCardHistorico.findMany({
        where: {
          cardId: { in: cardsMonitoramento.map((card) => card.id) },
          acao: {
            in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO", ACAO_MONITORAMENTO_EXECUTADO],
          },
        },
        select: { cardId: true, acao: true, createdAt: true, valorNovoJson: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historicosPorCard = new Map<string, typeof historicosMonitoramento>();
  for (const historico of historicosMonitoramento) {
    const lista = historicosPorCard.get(historico.cardId) ?? [];
    lista.push(historico);
    historicosPorCard.set(historico.cardId, lista);
  }

  for (const card of cardsMonitoramento) {
    const historicosDoCard = historicosPorCard.get(card.id) ?? [];
    const entradaEmMonitoramento = resolverInicioCicloNaEtapa(
      etapaMonitoramento.id,
      card.createdAt,
      historicosDoCard,
    );
    const ultimaExecucao = historicosDoCard.find((historico) =>
      historico.acao === ACAO_MONITORAMENTO_EXECUTADO
      && historico.createdAt >= entradaEmMonitoramento,
    )?.createdAt ?? null;

    if (!monitoramentoEstaVencido({ entradaEmMonitoramento, ultimaExecucaoEm: ultimaExecucao, agora })) {
      resumo.ignorados += 1;
      continue;
    }
    resumo.elegiveis += 1;

    try {
      const executado = await db.$transaction(async (tx) => {
        const atualizacao = await tx.bpmCard.updateMany({
          where: {
            id: card.id,
            pipelineId: pipeline.id,
            etapaId: etapaMonitoramento.id,
            status: "ATIVO",
            updatedAt: card.updatedAt,
          },
          data: { updatedAt: agora },
        });
        if (atualizacao.count !== 1) return false;

        const tarefa = await tx.bpmTarefa.create({
          data: {
            cardId: card.id,
            titulo: TITULO_TAREFA_MONITORAMENTO,
            descricao: "Revisão interna automática do card em Monitoramento. Não envia contato externo automaticamente.",
            responsavelId: card.responsavelId,
            prazo: agora,
            alertaEm: agora,
            tipo: "TAREFA",
            prioridade: "NORMAL",
            status: "PENDENTE",
          },
          select: { id: true },
        });
        await tx.bpmCardHistorico.create({
          data: {
            cardId: card.id,
            acao: ACAO_MONITORAMENTO_EXECUTADO,
            automacaoOrigem: AUTOMACAO_ORIGEM_MONITORAMENTO,
            valorNovoJson: JSON.stringify({
              tarefaId: tarefa.id,
              executadoEm: agora.toISOString(),
              proximoElegivelEm: calcularProximaRevisaoMonitoramento(
                entradaEmMonitoramento,
                agora,
              ).toISOString(),
            }),
          },
        });
        return true;
      });
      if (!executado) {
        resumo.ignorados += 1;
        continue;
      }
      resumo.tarefasCriadas += 1;
      await notificarPipelineBpm({
        pipelineId: pipeline.id,
        cardId: card.id,
        tipo: "TAREFA_ALTERADA",
      });
    } catch (error) {
      resumo.falhos += 1;
      console.error("[AutomacaoMonitoramentoBpm] Falha ao gerar revisão", { cardId: card.id, error });
    }
  }
}

/**
 * Planeja as ligações restantes do dia para Novos Leads. Uma ligação só é
 * considerada realizada quando existe uma interação LIGACAO; a automação cria
 * tarefas operacionais, jamais uma ligação ou mensagem externa por conta própria.
 */
async function executarAutomacaoLigacoesNovosLeadsBpm(params: {
  pipeline: PipelineAutomacaoBpm;
  etapaNovosLeads: { id: string; nome: string } | undefined;
  cards: Array<{
    id: string;
    etapaId: string;
    responsavelId: number | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  agora: Date;
  resumo: ResumoLigacoesNovosLeads;
}) {
  const { pipeline, etapaNovosLeads, agora, resumo } = params;
  if (!etapaNovosLeads) return;

  const { inicio, fim } = intervaloDiaCivilSaoPaulo(agora);
  const cards = params.cards.filter((card) => card.etapaId === etapaNovosLeads.id);
  resumo.examinados = cards.length;
  if (cards.length === 0) return;

  const [interacoes, execucoesHoje] = await Promise.all([
    db.bpmInteracaoCard.findMany({
      where: {
        cardId: { in: cards.map((card) => card.id) },
        tipo: "LIGACAO",
        createdAt: { gte: inicio, lt: fim },
      },
      select: { cardId: true },
    }),
    db.bpmCardHistorico.findMany({
      where: {
        cardId: { in: cards.map((card) => card.id) },
        acao: ACAO_LIGACOES_NOVOS_LEADS_PLANEJADAS,
        createdAt: { gte: inicio, lt: fim },
      },
      select: { cardId: true },
    }),
  ]);
  const ligacoesPorCard = new Map<string, number>();
  for (const interacao of interacoes) {
    ligacoesPorCard.set(interacao.cardId, (ligacoesPorCard.get(interacao.cardId) ?? 0) + 1);
  }
  const cardsJaPlanejados = new Set(execucoesHoje.map((execucao) => execucao.cardId));

  for (const card of cards) {
    if (cicloNovosLeadsVencido(card.createdAt, agora) || cardsJaPlanejados.has(card.id)) {
      resumo.ignorados += 1;
      continue;
    }

    const realizadas = ligacoesPorCard.get(card.id) ?? 0;
    resumo.tentativasRegistradas += realizadas;
    const restantes = calcularLigacoesPendentesNoDia(realizadas);
    if (restantes === 0) {
      resumo.ignorados += 1;
      continue;
    }

    const diaCiclo = calcularDiaCicloNovosLeads(card.createdAt, agora);
    try {
      const resultado = await db.$transaction(async (tx) => {
        const atualizacao = await tx.bpmCard.updateMany({
          where: {
            id: card.id,
            pipelineId: pipeline.id,
            etapaId: etapaNovosLeads.id,
            status: "ATIVO",
            proximoContatoEm: null,
            updatedAt: card.updatedAt,
          },
          data: { updatedAt: agora },
        });
        if (atualizacao.count !== 1) return null;

        const tarefas = await Promise.all(
          Array.from({ length: restantes }, (_, indice) => tx.bpmTarefa.create({
            data: {
              cardId: card.id,
              titulo: `Ligação ${realizadas + indice + 1} de ${META_LIGACOES_NOVOS_LEADS} — Novos Leads`,
              descricao: `Tentativa operacional do dia ${diaCiclo} do ciclo de ${TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS} dias úteis. Registre o resultado como interação de ligação no card.`,
              responsavelId: card.responsavelId,
              prazo: agora,
              alertaEm: agora,
              tipo: "LIGACAO",
              prioridade: "NORMAL",
              status: "PENDENTE",
            },
            select: { id: true },
          })),
        );
        await tx.bpmCardHistorico.create({
          data: {
            cardId: card.id,
            acao: ACAO_LIGACOES_NOVOS_LEADS_PLANEJADAS,
            automacaoOrigem: AUTOMACAO_ORIGEM_LIGACOES_NOVOS_LEADS,
            valorNovoJson: JSON.stringify({
              diaCiclo,
              ligacoesRegistradas: realizadas,
              tarefasCriadas: tarefas.map((tarefa) => tarefa.id),
              dataCivilInicio: inicio.toISOString(),
            }),
          },
        });
        return tarefas.length;
      });
      if (resultado === null) {
        resumo.ignorados += 1;
        continue;
      }
      resumo.tarefasCriadas += resultado;
      await notificarPipelineBpm({
        pipelineId: pipeline.id,
        cardId: card.id,
        tipo: "TAREFA_ALTERADA",
      });
    } catch (error) {
      resumo.falhos += 1;
      console.error("[AutomacaoLigacoesNovosLeadsBpm] Falha ao planejar ligações", {
        cardId: card.id,
        error,
      });
    }
  }
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
    ligacoesNovosLeads: criarResumoLigacoesNovosLeads(),
    standby: criarResumoStandby(),
    monitoramento: criarResumoMonitoramento(),
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
              NOME_ETAPA_MONITORAMENTO,
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
    await executarAutomacaoMonitoramentoBpm({
      pipeline,
      agora,
      resumo: resumo.monitoramento,
      avisos: resumo.avisos,
    });
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

  const cards = await db.bpmCard.findMany({
    where: {
      pipelineId: pipeline.id,
      etapaId: { in: configuracoes.map((configuracao) => configuracao.id) },
      status: "ATIVO",
      proximoContatoEm: null,
    },
    select: { id: true, etapaId: true, responsavelId: true, createdAt: true, updatedAt: true },
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

  await executarAutomacaoLigacoesNovosLeadsBpm({
    pipeline,
    etapaNovosLeads: configuracoes.find((item) => item.nome === NOME_ETAPA_NOVOS_LEADS),
    cards,
    agora,
    resumo: resumo.ligacoesNovosLeads,
  });

  for (const etapa of resumo.porEtapa) {
    resumo.examinados += etapa.examinados;
    resumo.elegiveis += etapa.elegiveis;
    resumo.movidos += etapa.movidos;
    resumo.ignorados += etapa.ignorados;
    resumo.falhos += etapa.falhos;
  }

  const cardsStandby = await db.bpmCard.findMany({
    where: {
      pipelineId: pipeline.id,
      etapaId: destino.id,
      status: "ATIVO",
    },
    select: {
      id: true,
      etapaId: true,
      responsavelId: true,
      createdAt: true,
      standbyFollowUpUltimoEm: true,
      standbyFollowUpInterrompidoEm: true,
    },
  });
  resumo.standby.examinados = cardsStandby.length;
  resumo.standby.interrompidos = cardsStandby.filter(
    (card) => card.standbyFollowUpInterrompidoEm !== null,
  ).length;

  const historicosStandby = cardsStandby.length > 0
    ? await db.bpmCardHistorico.findMany({
        where: {
          cardId: { in: cardsStandby.map((card) => card.id) },
          acao: { in: ["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO"] },
        },
        select: { cardId: true, createdAt: true, valorNovoJson: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historicosStandbyPorCard = new Map<string, typeof historicosStandby>();
  for (const historico of historicosStandby) {
    const lista = historicosStandbyPorCard.get(historico.cardId) ?? [];
    lista.push(historico);
    historicosStandbyPorCard.set(historico.cardId, lista);
  }

  for (const card of cardsStandby) {
    if (card.standbyFollowUpInterrompidoEm) continue;
    const entradaEmStandby = resolverInicioCicloNaEtapa(
      destino.id,
      card.createdAt,
      historicosStandbyPorCard.get(card.id) ?? [],
    );
    if (!followUpStandbyEstaVencido({
      entradaEmStandby,
      ultimoFollowUpEm: card.standbyFollowUpUltimoEm,
      agora,
    })) {
      resumo.standby.ignorados += 1;
      continue;
    }
    resumo.standby.elegiveis += 1;

    try {
      const executado = await db.$transaction(async (tx) => {
        // CAS: se outro job/processo marcou o ciclo ou interrompeu o contato,
        // esta transação não cria uma segunda tarefa.
        const atualizacao = await tx.bpmCard.updateMany({
          where: {
            id: card.id,
            pipelineId: pipeline.id,
            etapaId: destino.id,
            status: "ATIVO",
            standbyFollowUpInterrompidoEm: null,
            standbyFollowUpUltimoEm: card.standbyFollowUpUltimoEm,
          },
          data: { standbyFollowUpUltimoEm: agora },
        });
        if (atualizacao.count !== 1) return false;

        await tx.bpmTarefa.create({
          data: {
            cardId: card.id,
            titulo: "Realizar follow-up semanal",
            descricao: "Contato operacional semanal do card em Standby - Follow Up. Não envia mensagem automaticamente.",
            responsavelId: card.responsavelId,
            prazo: agora,
            alertaEm: agora,
            tipo: "LIGACAO",
            prioridade: "NORMAL",
            status: "PENDENTE",
          },
        });
        await tx.bpmCardHistorico.create({
          data: {
            cardId: card.id,
            acao: "STANDBY_FOLLOW_UP_EXECUTADO",
            automacaoOrigem: "standby_follow_up_semanal",
            valorNovoJson: JSON.stringify({
              executadoEm: agora.toISOString(),
              proximoElegivelEm: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            }),
          },
        });
        return true;
      });
      if (!executado) {
        resumo.standby.ignorados += 1;
        continue;
      }
      resumo.standby.tarefasCriadas += 1;
      await notificarPipelineBpm({
        pipelineId: pipeline.id,
        cardId: card.id,
        tipo: "TAREFA_ALTERADA",
      });
    } catch (error) {
      resumo.standby.falhos += 1;
      console.error("[AutomacaoFollowUpBpm] Falha ao gerar follow-up semanal", {
        cardId: card.id,
        error,
      });
    }
  }

  await executarAutomacaoMonitoramentoBpm({
    pipeline,
    agora,
    resumo: resumo.monitoramento,
    avisos: resumo.avisos,
  });

  return resumo;
}

// Compatibilidade com o entrypoint criado na primeira etapa da entrega.
export const executarAutomacaoNovosLeads = executarAutomacaoFollowUpBpm;
