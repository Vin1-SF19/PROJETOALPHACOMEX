import "server-only";

import db from "@/lib/prisma";
import {
  AUTOMACAO_ORIGEM_AGENDAR_REUNIAO,
  NOME_ETAPA_AGENDAR_REUNIAO,
  resolverInicioCicloNaEtapa,
} from "@/lib/bpm/agendar-reuniao";
import {
  carregarCamposObrigatoriosEtapa,
  verificarTransicaoPermitidaBpm,
} from "@/lib/bpm/requisitos-etapa-server";
import { listarCamposObrigatoriosFaltantes } from "@/lib/bpm/requisitos-etapa";
import {
  ACAO_LIGACOES_NOVOS_LEADS_PLANEJADAS,
  AUTOMACAO_ORIGEM_LIGACOES_NOVOS_LEADS,
  AUTOMACAO_ORIGEM_NOVOS_LEADS,
  calcularLigacoesPendentesNoDia,
  cicloDeTentativasNovosLeadsConcluido,
  datasUteisCicloNovosLeads,
  oitoTentativasDiariasRegistradas,
  ehDiaUtilNovosLeads,
  etapaEhNovosLeads,
  etapaEhStandbyFollowUp,
  followUpStandbyEstaVencido,
  intervaloDiaCivilSaoPaulo,
  NOME_ETAPA_NOVOS_LEADS,
  NOME_ETAPA_STANDBY,
  TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS,
} from "@/lib/bpm/novos-leads";
import { formatarDataCivil } from "@/components/CalendarioAlpha/lib/datas";
import { agendaAgendarConcluida, agendaLigacoesAgendar } from "@/lib/bpm/cadencias/agendar-reuniao";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import {
  AUTOMACAO_ORIGEM_REUNIAO_AGENDADA,
  NOME_ETAPA_REUNIAO_AGENDADA,
  inicioTentativasAposReuniao,
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
  ligacoesAgendarReuniao: ResumoLigacoesNovosLeads;
  ligacoesReuniaoAgendada: ResumoLigacoesNovosLeads;
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
 * Planeja uma ligação por dia útil para Novo Lead. Uma ligação só é
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

  if (!ehDiaUtilNovosLeads(agora)) {
    resumo.ignorados = cards.length;
    return;
  }
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
    if (!datasUteisCicloNovosLeads(card.createdAt).includes(formatarDataCivil(agora))
      || cardsJaPlanejados.has(card.id)) {
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

    const diaCiclo = datasUteisCicloNovosLeads(card.createdAt).indexOf(formatarDataCivil(agora)) + 1;
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

        const tarefa = await tx.bpmTarefa.create({
            data: {
              cardId: card.id,
              titulo: `Ligação do dia ${diaCiclo} de ${TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS} — Novo Lead`,
              descricao: `Tentativa operacional do dia ${diaCiclo} do ciclo de ${TOTAL_DIAS_UTEIS_CICLO_NOVOS_LEADS} dias úteis. Registre o resultado como interação de ligação no card.`,
              responsavelId: card.responsavelId,
              prazo: agora,
              alertaEm: agora,
              tipo: "LIGACAO",
              prioridade: "NORMAL",
              status: "PENDENTE",
            },
            select: { id: true },
          });
        await tx.bpmCardHistorico.create({
          data: {
            cardId: card.id,
            acao: ACAO_LIGACOES_NOVOS_LEADS_PLANEJADAS,
            automacaoOrigem: AUTOMACAO_ORIGEM_LIGACOES_NOVOS_LEADS,
            valorNovoJson: JSON.stringify({
              diaCiclo,
              ligacoesRegistradas: realizadas,
              tarefasCriadas: [tarefa.id],
              dataCivilInicio: inicio.toISOString(),
            }),
          },
        });
        return 1;
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

async function executarAutomacaoLigacoesAgendarBpm(params: {
  pipelineId: string;
  etapaId: string;
  cards: Array<{ id: string; etapaId: string; responsavelId: number | null; createdAt: Date; updatedAt: Date; dataReuniao?: Date | null }>;
  historicosPorCard: Map<string, Array<{ createdAt: Date; valorNovoJson: string | null }>>;
  cadencia: { id: string; passos: Array<{ id: string; ordem: number; intervaloDias: number; tipoTarefa: string; titulo: string; descricao: string | null; prioridade: string }> };
  acaoPlanejamento: string;
  iniciarAposReuniao?: boolean;
  agora: Date;
  resumo: ResumoLigacoesNovosLeads;
}) {
  const { pipelineId, etapaId, cards, historicosPorCard, cadencia, acaoPlanejamento, iniciarAposReuniao = false, agora, resumo } = params;
  const candidatos = cards.filter((card) => card.etapaId === etapaId);
  resumo.examinados = candidatos.length;
  if (!candidatos.length || !ehDiaUtilNovosLeads(agora)) {
    resumo.ignorados = candidatos.length;
    return;
  }
  const { inicio, fim } = intervaloDiaCivilSaoPaulo(agora);
  const [interacoes, planejamentos] = await Promise.all([
    db.bpmInteracaoCard.findMany({ where: { cardId: { in: candidatos.map((card) => card.id) }, tipo: "LIGACAO", createdAt: { gte: inicio, lt: fim } }, select: { cardId: true } }),
    db.bpmCardHistorico.findMany({ where: { cardId: { in: candidatos.map((card) => card.id) }, acao: acaoPlanejamento, createdAt: { gte: inicio, lt: fim } }, select: { cardId: true } }),
  ]);
  const ligacoesHoje = new Set(interacoes.map((item) => item.cardId));
  const jaPlanejados = new Set(planejamentos.map((item) => item.cardId));
  for (const card of candidatos) {
    const entradaEtapa = resolverInicioCicloNaEtapa(etapaId, card.createdAt, historicosPorCard.get(card.id) ?? []);
    if (iniciarAposReuniao && (!card.dataReuniao || card.dataReuniao > agora)) {
      resumo.ignorados++;
      continue;
    }
    const entrada = iniciarAposReuniao && card.dataReuniao
      ? inicioTentativasAposReuniao(entradaEtapa, card.dataReuniao) : entradaEtapa;
    const passo = agendaLigacoesAgendar(entrada, cadencia.passos).find((item) => item.dataCivil === formatarDataCivil(agora));
    if (!passo || ligacoesHoje.has(card.id) || jaPlanejados.has(card.id)) {
      resumo.ignorados++;
      continue;
    }
    try {
      const criado = await db.$transaction(async (tx) => {
        const vigente = await tx.bpmCadencia.findFirst({
          where: { id: cadencia.id, ativa: true, excluidoEm: null, etapas: { some: { etapaId } }, passos: { some: { id: passo.id, ativo: true } } },
          select: { id: true },
        });
        if (!vigente) return false;
        const atualizado = await tx.bpmCard.updateMany({
          where: { id: card.id, pipelineId, etapaId, status: "ATIVO", proximoContatoEm: null, updatedAt: card.updatedAt },
          data: { updatedAt: agora },
        });
        if (atualizado.count !== 1) return false;
        const tarefa = await tx.bpmTarefa.create({ data: {
          cardId: card.id, titulo: passo.titulo, descricao: passo.descricao,
          responsavelId: card.responsavelId, prazo: agora, alertaEm: agora,
          tipo: "LIGACAO", prioridade: passo.prioridade, status: "PENDENTE",
        }, select: { id: true } });
        await tx.bpmCardHistorico.create({ data: {
          cardId: card.id, acao: acaoPlanejamento, automacaoOrigem: cadencia.id,
          valorNovoJson: JSON.stringify({ cadenciaId: cadencia.id, passoId: passo.id, tarefaId: tarefa.id, dataCivil: passo.dataCivil }),
        } });
        return true;
      });
      if (!criado) { resumo.ignorados++; continue; }
      resumo.tarefasCriadas++;
      await notificarPipelineBpm({ pipelineId, cardId: card.id, tipo: "TAREFA_ALTERADA" });
    } catch (error) {
      resumo.falhos++;
      console.error("[AutomacaoLigacoesAgendarBpm]", { cardId: card.id, error });
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
    ligacoesAgendarReuniao: criarResumoLigacoesNovosLeads(),
    ligacoesReuniaoAgendada: criarResumoLigacoesNovosLeads(),
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
              "Novos leads",
              NOME_ETAPA_AGENDAR_REUNIAO,
              "Agendar Reunião",
              NOME_ETAPA_REUNIAO_AGENDADA,
              NOME_ETAPA_STANDBY,
              "Standby - Follow Up",
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

  const destino = pipeline.etapas.find((etapa) => etapaEhStandbyFollowUp(etapa.nome));
  if (!destino) {
    resumo.avisos.push(`Etapa ${NOME_ETAPA_STANDBY} não encontrada.`);
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
    const etapa = pipeline.etapas.find((item) => configuracao.nome === NOME_ETAPA_NOVOS_LEADS
      ? etapaEhNovosLeads(item.nome)
      : configuracao.nome === NOME_ETAPA_AGENDAR_REUNIAO
        ? item.nome.toLocaleLowerCase("pt-BR") === NOME_ETAPA_AGENDAR_REUNIAO.toLocaleLowerCase("pt-BR")
        : item.nome === configuracao.nome);
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
    select: { id: true, etapaId: true, responsavelId: true, createdAt: true, updatedAt: true, dataReuniao: true },
  });

  const etapaAgendar = configuracoes.find((item) => item.nome === NOME_ETAPA_AGENDAR_REUNIAO);
  const cadenciaAgendar = etapaAgendar ? await db.bpmCadencia.findFirst({
    where: { pipelineId: pipeline.id, ativa: true, excluidoEm: null, etapas: { some: { etapaId: etapaAgendar.id } } },
    select: { id: true, passos: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
      id: true, ordem: true, intervaloDias: true, tipoTarefa: true, titulo: true, descricao: true, prioridade: true,
    } } },
  }) : null;
  const etapaReuniaoAgendada = configuracoes.find((item) => item.nome === NOME_ETAPA_REUNIAO_AGENDADA);
  const cadenciaReuniaoAgendada = etapaReuniaoAgendada ? await db.bpmCadencia.findFirst({
    where: { pipelineId: pipeline.id, ativa: true, excluidoEm: null, etapas: { some: { etapaId: etapaReuniaoAgendada.id } } },
    select: { id: true, passos: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
      id: true, ordem: true, intervaloDias: true, tipoTarefa: true, titulo: true, descricao: true, prioridade: true,
    } } },
  }) : null;

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

  const cardsComLigacoes = cards.filter((card) => configuracoes.some((configuracao) =>
    [NOME_ETAPA_NOVOS_LEADS, NOME_ETAPA_AGENDAR_REUNIAO, NOME_ETAPA_REUNIAO_AGENDADA].includes(configuracao.nome) && configuracao.id === card.etapaId));
  const interacoesDoCiclo = cardsComLigacoes.length > 0
    ? await db.bpmInteracaoCard.findMany({
        where: {
          cardId: { in: cardsComLigacoes.map((card) => card.id) },
          tipo: "LIGACAO",
          createdAt: { lt: intervaloDiaCivilSaoPaulo(agora).inicio },
        },
        select: { cardId: true, createdAt: true },
      })
    : [];
  const interacoesPorCard = new Map<string, Date[]>();
  const criacaoPorCard = new Map(cardsComLigacoes.map((card) => [card.id, card.createdAt]));
  for (const interacao of interacoesDoCiclo) {
    if (interacao.createdAt < (criacaoPorCard.get(interacao.cardId) ?? agora)) continue;
    const datas = interacoesPorCard.get(interacao.cardId) ?? [];
    datas.push(interacao.createdAt);
    interacoesPorCard.set(interacao.cardId, datas);
  }

  for (const configuracao of configuracoes) {
    const resumoEtapa = criarResumoEtapa(configuracao.nome);
    resumo.porEtapa.push(resumoEtapa);
    const cardsEtapa = cards.filter((card) => card.etapaId === configuracao.id);
    resumoEtapa.examinados = cardsEtapa.length;

    const elegiveis = cardsEtapa.filter((card) => {
      const entradaEtapa = configuracao.nome === NOME_ETAPA_NOVOS_LEADS
        ? card.createdAt
        : resolverInicioCicloNaEtapa(
            configuracao.id,
            card.createdAt,
            historicosPorCard.get(card.id) ?? [],
          );
      const aposReuniao = configuracao.nome === NOME_ETAPA_REUNIAO_AGENDADA;
      if (aposReuniao && (!card.dataReuniao || card.dataReuniao > agora)) return false;
      const inicioCiclo = aposReuniao && card.dataReuniao
        ? inicioTentativasAposReuniao(entradaEtapa, card.dataReuniao) : entradaEtapa;
      return configuracao.nome === NOME_ETAPA_NOVOS_LEADS
        ? cicloDeTentativasNovosLeadsConcluido(inicioCiclo, agora)
          && oitoTentativasDiariasRegistradas(inicioCiclo, interacoesPorCard.get(card.id) ?? [])
        : configuracao.nome === NOME_ETAPA_AGENDAR_REUNIAO
          ? Boolean(cadenciaAgendar && agendaAgendarConcluida(inicioCiclo, cadenciaAgendar.passos, interacoesPorCard.get(card.id) ?? [], agora))
        : Boolean(cadenciaReuniaoAgendada && agendaAgendarConcluida(inicioCiclo, cadenciaReuniaoAgendada.passos, interacoesPorCard.get(card.id) ?? [], agora));
    });
    resumoEtapa.elegiveis = elegiveis.length;
    resumoEtapa.ignorados = cardsEtapa.length - elegiveis.length;

    if (elegiveis.length > 0) {
      const transicaoPermitida = await verificarTransicaoPermitidaBpm(
        configuracao.id,
        destino.id,
        "AUTOMACAO",
      );
      if (!transicaoPermitida.permitida) {
        resumoEtapa.ignorados += elegiveis.length;
        resumo.avisos.push(
          `Cards de ${configuracao.nome} não movidos para ${NOME_ETAPA_STANDBY}: ${transicaoPermitida.motivo ?? "transição não permitida."}`,
        );
        continue;
      }
    }

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
          if (configuracao.nome === NOME_ETAPA_AGENDAR_REUNIAO) {
            if (!cadenciaAgendar) return false;
            const atual = await tx.bpmCadencia.findFirst({
              where: { id: cadenciaAgendar.id, ativa: true, excluidoEm: null, etapas: { some: { etapaId: configuracao.id } } },
              select: { passos: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
                id: true, ordem: true, intervaloDias: true, tipoTarefa: true, titulo: true, descricao: true, prioridade: true,
              } } },
            });
            const entrada = resolverInicioCicloNaEtapa(configuracao.id, card.createdAt, historicosPorCard.get(card.id) ?? []);
            if (!atual || !agendaAgendarConcluida(entrada, atual.passos, interacoesPorCard.get(card.id) ?? [], agora)) return false;
          }
          if (configuracao.nome === NOME_ETAPA_REUNIAO_AGENDADA) {
            if (!cadenciaReuniaoAgendada) return false;
            const atual = await tx.bpmCadencia.findFirst({
              where: { id: cadenciaReuniaoAgendada.id, ativa: true, excluidoEm: null, etapas: { some: { etapaId: configuracao.id } } },
              select: { passos: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: {
                id: true, ordem: true, intervaloDias: true, tipoTarefa: true, titulo: true, descricao: true, prioridade: true,
              } } },
            });
            const entradaEtapa = resolverInicioCicloNaEtapa(configuracao.id, card.createdAt, historicosPorCard.get(card.id) ?? []);
            if (!card.dataReuniao || card.dataReuniao > agora) return false;
            const entrada = inicioTentativasAposReuniao(entradaEtapa, card.dataReuniao);
            if (!atual || !agendaAgendarConcluida(entrada, atual.passos, interacoesPorCard.get(card.id) ?? [], agora)) return false;
          }
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
          await ativarCadenciasNaEntradaBpm({
            cardId: card.id,
            pipelineAnteriorId: pipeline.id,
            etapaAnteriorId: configuracao.id,
            pipelineDestinoId: pipeline.id,
            etapaDestinoId: destino.id,
            evento: "CARD_MOVIDO",
            automacaoOrigem: configuracao.automacaoOrigem,
          }, tx);
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
  if (etapaAgendar && cadenciaAgendar) {
    await executarAutomacaoLigacoesAgendarBpm({
      pipelineId: pipeline.id, etapaId: etapaAgendar.id, cards, historicosPorCard,
      cadencia: cadenciaAgendar, agora, resumo: resumo.ligacoesAgendarReuniao,
      acaoPlanejamento: "AGENDAR_REUNIAO_LIGACAO_PLANEJADA",
    });
  }
  if (etapaReuniaoAgendada && cadenciaReuniaoAgendada) {
    await executarAutomacaoLigacoesAgendarBpm({
      pipelineId: pipeline.id, etapaId: etapaReuniaoAgendada.id, cards, historicosPorCard,
      cadencia: cadenciaReuniaoAgendada, agora, resumo: resumo.ligacoesReuniaoAgendada,
      acaoPlanejamento: "REUNIAO_AGENDADA_LIGACAO_PLANEJADA",
      iniciarAposReuniao: true,
    });
  }

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
