import "server-only";

import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import {
  condicaoDistribuicaoAtendida,
  selecionarResponsavelDistribuicao,
  type CandidatoDistribuicao,
} from "@/lib/bpm/automacoes/distribuicao-motor";
import type {
  ParametrosDistribuicaoBpm,
  ParametrosOportunidadeBpm,
} from "@/lib/bpm/automacoes/schemas";
import { parametrosDistribuicaoSchema } from "@/lib/bpm/automacoes/schemas";
import {
  enfileirarAutomacoesCriacaoCardBpm,
  enfileirarAutomacoesCriacaoTarefaBpm,
} from "@/lib/bpm/automacoes/fila";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { campoFinanceiroSomenteLeitura } from "@/lib/bpm/pipeline-financeiro";

type ClienteExecucao = Prisma.TransactionClient | typeof db;

type CardAutomacao = {
  id: string;
  pipelineId: string;
  etapaId: string;
  responsavelId: number;
  servico: string | null;
  tipoProcesso: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  concluidoEm: Date | null;
  primeiraVisualizacaoEm: Date | null;
  proximoContatoEm: Date | null;
  dataReuniao: Date | null;
  statusPosFechamento: string | null;
  empresaId: number;
};

function tarefaIdDoEvento(eventoChave: string): string | null {
  const encontrado = /^TAREFA:([^:]+):CRIADA$/.exec(eventoChave);
  return encontrado?.[1] ?? null;
}

function normalizarServico(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

async function clientePossuiServico(client: ClienteExecucao, clienteId: number, servico: string) {
  const contratacoes = await client.clienteServico.findMany({
    where: { clienteId },
    select: { id: true, servico: true },
  });
  const alvo = normalizarServico(servico);
  return contratacoes.find((item) => normalizarServico(item.servico) === alvo) ?? null;
}

async function montarContextoCompleto(card: CardAutomacao, client: ClienteExecucao) {
  const contexto = await montarContextoAvaliacaoDoCard(card, client);
  const [contratacao, indicacao, relacionadas] = await Promise.all([
    card.servico
      ? client.clienteServico.findUnique({
          where: { clienteId_servico: { clienteId: card.empresaId, servico: card.servico } },
        })
      : Promise.resolve(null),
    client.indicacao.findUnique({
      where: { bpmCardId: card.id },
      select: { parceiroId: true, status: true },
    }),
    Promise.all([
      client.bpmCardMembro.count({ where: { cardId: card.id } }),
      client.bpmTarefa.count({ where: { cardId: card.id } }),
      client.bpmCardAnexo.count({ where: { cardId: card.id } }),
      client.bpmCardVinculo.count({ where: { OR: [{ cardOrigemId: card.id }, { cardDestinoId: card.id }] } }),
    ]),
  ]);
  return {
    ...contexto,
    processo: {
      pipelineId: card.pipelineId,
      etapaDestinoId: card.etapaId,
      origemMovimentacao: "AUTOMACAO",
    },
    contratacao: contratacao || indicacao
      ? { ...(contratacao ?? {}), indicadoPorParceiroId: indicacao?.parceiroId ?? null }
      : undefined,
    relacionada: {
      "responsavel.id": card.responsavelId,
      "membros.quantidade": relacionadas[0],
      "tarefas.quantidade": relacionadas[1],
      "anexos.quantidade": relacionadas[2],
      "vinculos.quantidade": relacionadas[3],
    },
  };
}

async function carregarCandidatos(params: {
  pipelineId: string;
  candidatosIds: number[];
  client: ClienteExecucao;
}): Promise<CandidatoDistribuicao[]> {
  const usuarios = await params.client.usuarios.findMany({
    where: { id: { in: params.candidatosIds } },
    select: { id: true, nome: true, status: true },
  });
  const porId = new Map(usuarios.map((usuario) => [usuario.id, usuario]));
  const resultado: CandidatoDistribuicao[] = [];
  for (const id of [...new Set(params.candidatosIds)]) {
    const usuario = porId.get(id);
    const ativo = usuario?.status === "ATIVO";
    const elegivel = ativo
      ? await usuarioElegivelResponsavelBpm(params.pipelineId, id, params.client)
      : false;
    const [cargaCards, cargaTarefas] = usuario
      ? await Promise.all([
          params.client.bpmCard.count({ where: { responsavelId: id, status: "ATIVO" } }),
          params.client.bpmTarefa.count({ where: { responsavelId: id, status: "PENDENTE" } }),
        ])
      : [0, 0];
    resultado.push({
      id,
      nome: usuario?.nome ?? `Usuário ${id}`,
      ativo,
      elegivel,
      cargaCards,
      cargaTarefas,
      ...(!usuario
        ? { motivoExclusao: "Usuário não encontrado" }
        : !ativo
          ? { motivoExclusao: "Usuário inativo" }
          : !elegivel
            ? { motivoExclusao: "Sem permissão para o pipeline" }
            : {}),
    });
  }
  return resultado;
}

export async function simularDistribuicaoBpm(params: {
  card: CardAutomacao;
  configuracao: ParametrosDistribuicaoBpm;
  cursor?: number;
  client?: ClienteExecucao;
}) {
  const client = params.client ?? db;
  const contexto = await montarContextoCompleto(params.card, client);
  if (!condicaoDistribuicaoAtendida(params.configuracao.condicao, contexto)) {
    return { aplicado: false, selecionadoId: null, candidatos: [], motivo: "Condições da regra não atendidas" };
  }
  const candidatos = await carregarCandidatos({
    pipelineId: params.card.pipelineId,
    candidatosIds: params.configuracao.candidatosIds,
    client,
  });
  return selecionarResponsavelDistribuicao({
    estrategia: params.configuracao.estrategia,
    candidatos,
    responsavelFixoId: params.configuracao.responsavelFixoId,
    cursor: params.cursor ?? 0,
  });
}

export async function simularOportunidadeBpm(params: {
  card: CardAutomacao;
  configuracao: ParametrosOportunidadeBpm;
  client?: ClienteExecucao;
}) {
  const client = params.client ?? db;
  const contexto = await montarContextoCompleto(params.card, client);
  if (!condicaoDistribuicaoAtendida(params.configuracao.condicao, contexto)) {
    return { aplicaria: false, motivo: "Condições da regra não atendidas", acao: null, servico: null };
  }
  const servico = await client.servicosComerciais.findFirst({
    where: { id: params.configuracao.servicoAlvoId, ativo: true },
    select: { id: true, nome: true },
  });
  if (!servico) return { aplicaria: false, motivo: "Serviço alvo inativo ou removido", acao: null, servico: null };
  const contratado = await clientePossuiServico(client, params.card.empresaId, servico.nome);
  return contratado
    ? { aplicaria: false, motivo: "Cliente já possui o serviço alvo", acao: null, servico }
    : { aplicaria: true, motivo: "Nova oportunidade identificada", acao: params.configuracao.acao, servico };
}

async function finalizarExecucaoNaTransacao(params: {
  tx: Prisma.TransactionClient;
  execucaoId: string;
  cardId: string;
  automacaoId: string;
  automacaoNome: string;
  acaoTipo: string;
  resultado: Record<string, unknown>;
}) {
  const concluidoEm = new Date();
  await params.tx.bpmAutomacaoExecucao.update({
    where: { id: params.execucaoId },
    data: {
      status: "SUCESSO",
      resultadoJson: JSON.stringify(params.resultado),
      mensagemErro: null,
      executadoEm: concluidoEm,
    },
  });
  await params.tx.bpmCardHistorico.create({
    data: {
      cardId: params.cardId,
      acao: "AUTOMACAO_EXECUTADA",
      automacaoOrigem: params.automacaoId,
      valorNovoJson: JSON.stringify({
        automacaoId: params.automacaoId,
        nome: params.automacaoNome,
        acaoTipo: params.acaoTipo,
        execucaoId: params.execucaoId,
        resultado: params.resultado,
      }),
    },
  });
  return { ...params.resultado, execucaoFinalizada: true as const };
}

export async function executarDistribuicaoBpm(params: {
  automacaoId: string;
  automacaoNome: string;
  execucaoId: string;
  eventoChave: string;
  gatilhoTipo: string;
  automacaoEtapaId: string;
  card: CardAutomacao;
  configuracao: ParametrosDistribuicaoBpm;
}) {
  return db.$transaction(async (tx) => {
    // Primeiro write da transação: serializa execuções da mesma regra também em
    // bancos concorrentes, antes de medir carga e aplicar a atribuição.
    await tx.bpmAutomacao.update({ where: { id: params.automacaoId }, data: { updatedAt: new Date() } });
    const cardAtual = await tx.bpmCard.findUnique({ where: { id: params.card.id } });
    if (!cardAtual) throw new Error("Card da distribuição não encontrado");
    const contexto = await montarContextoCompleto(cardAtual, tx);
    const regras = await tx.bpmAutomacao.findMany({
      where: {
        pipelineId: cardAtual.pipelineId,
        etapaId: params.automacaoEtapaId,
        gatilhoTipo: params.gatilhoTipo,
        acaoTipo: "DISTRIBUIR_RESPONSAVEL",
        ativa: true,
      },
      select: { id: true, parametrosJson: true },
    });
    const vencedora = regras
      .map((regra) => {
        try {
          const configuracao = parametrosDistribuicaoSchema.parse(JSON.parse(regra.parametrosJson));
          return { id: regra.id, configuracao };
        } catch {
          return null;
        }
      })
      .filter((regra): regra is NonNullable<typeof regra> => Boolean(regra))
      .filter((regra) => condicaoDistribuicaoAtendida(regra.configuracao.condicao, contexto))
      .sort((a, b) => a.configuracao.prioridade - b.configuracao.prioridade || a.id.localeCompare(b.id))[0];
    if (!vencedora || vencedora.id !== params.automacaoId) {
      return finalizarExecucaoNaTransacao({
        tx,
        execucaoId: params.execucaoId,
        cardId: cardAtual.id,
        automacaoId: params.automacaoId,
        automacaoNome: params.automacaoNome,
        acaoTipo: "DISTRIBUIR_RESPONSAVEL",
        resultado: {
          tipo: "DISTRIBUICAO",
          status: "IGNORADA",
          motivo: vencedora ? "Outra regra aplicável possui prioridade maior" : "Condições da regra não atendidas",
        },
      });
    }
    const cursor = await tx.bpmCardHistorico.count({
      where: { acao: "DISTRIBUICAO_AUTOMATICA", automacaoOrigem: params.automacaoId },
    });
    const resultado = await simularDistribuicaoBpm({
      card: cardAtual,
      configuracao: params.configuracao,
      cursor,
      client: tx,
    });
    if (!resultado.aplicado || !resultado.selecionadoId) {
      return finalizarExecucaoNaTransacao({
        tx,
        execucaoId: params.execucaoId,
        cardId: cardAtual.id,
        automacaoId: params.automacaoId,
        automacaoNome: params.automacaoNome,
        acaoTipo: "DISTRIBUIR_RESPONSAVEL",
        resultado: { tipo: "DISTRIBUICAO", status: "SEM_CANDIDATO", ...resultado },
      });
    }

    if (params.configuracao.entidade === "TAREFA") {
      const tarefaId = tarefaIdDoEvento(params.eventoChave);
      if (!tarefaId) throw new Error("Evento de tarefa inválido para a distribuição");
      const tarefa = await tx.bpmTarefa.updateMany({
        where: { id: tarefaId, cardId: cardAtual.id },
        data: { responsavelId: resultado.selecionadoId },
      });
      if (tarefa.count !== 1) throw new Error("Tarefa da distribuição não encontrada");
    } else {
      await tx.bpmCard.update({
        where: { id: cardAtual.id },
        data: { responsavelId: resultado.selecionadoId },
      });
      await tx.bpmCardMembro.updateMany({
        where: { cardId: cardAtual.id, role: "RESPONSAVEL" },
        data: { role: "PARTICIPANTE" },
      });
      await tx.bpmCardMembro.upsert({
        where: { cardId_userId: { cardId: cardAtual.id, userId: resultado.selecionadoId } },
        create: { cardId: cardAtual.id, userId: resultado.selecionadoId, role: "RESPONSAVEL" },
        update: { role: "RESPONSAVEL" },
      });
    }

    await tx.bpmCardHistorico.create({
      data: {
        cardId: cardAtual.id,
        acao: "DISTRIBUICAO_AUTOMATICA",
        automacaoOrigem: params.automacaoId,
        valorAnteriorJson: JSON.stringify({ responsavelId: cardAtual.responsavelId }),
        valorNovoJson: JSON.stringify({
          execucaoId: params.execucaoId,
          entidade: params.configuracao.entidade,
          estrategia: params.configuracao.estrategia,
          responsavelId: resultado.selecionadoId,
        }),
      },
    });
    return finalizarExecucaoNaTransacao({
      tx,
      execucaoId: params.execucaoId,
      cardId: cardAtual.id,
      automacaoId: params.automacaoId,
      automacaoNome: params.automacaoNome,
      acaoTipo: "DISTRIBUIR_RESPONSAVEL",
      resultado: { tipo: "DISTRIBUICAO", status: "APLICADA", ...resultado },
    });
  });
}

export async function executarOportunidadeBpm(params: {
  automacaoId: string;
  automacaoNome: string;
  execucaoId: string;
  criadoPorId: number;
  card: CardAutomacao;
  configuracao: ParametrosOportunidadeBpm;
}) {
  return db.$transaction(async (tx) => {
    await tx.bpmAutomacao.update({ where: { id: params.automacaoId }, data: { updatedAt: new Date() } });
    const card = await tx.bpmCard.findUnique({ where: { id: params.card.id } });
    if (!card) throw new Error("Card da oportunidade não encontrado");
    const contexto = await montarContextoCompleto(card, tx);
    if (!condicaoDistribuicaoAtendida(params.configuracao.condicao, contexto)) {
      return finalizarExecucaoNaTransacao({
        tx, execucaoId: params.execucaoId, cardId: card.id,
        automacaoId: params.automacaoId, automacaoNome: params.automacaoNome,
        acaoTipo: "IDENTIFICAR_OPORTUNIDADE",
        resultado: { tipo: "OPORTUNIDADE", status: "IGNORADA", motivo: "Condições da regra não atendidas" },
      });
    }
    const servico = await tx.servicosComerciais.findFirst({
      where: { id: params.configuracao.servicoAlvoId, ativo: true },
      select: { id: true, nome: true },
    });
    if (!servico) throw new Error("Serviço alvo não encontrado ou inativo");
    const contratado = await clientePossuiServico(tx, card.empresaId, servico.nome);
    if (contratado) {
      return finalizarExecucaoNaTransacao({
        tx, execucaoId: params.execucaoId, cardId: card.id,
        automacaoId: params.automacaoId, automacaoNome: params.automacaoNome,
        acaoTipo: "IDENTIFICAR_OPORTUNIDADE",
        resultado: { tipo: "OPORTUNIDADE", status: "IGNORADA", motivo: "Cliente já possui o serviço alvo", servico },
      });
    }

    const chaveCanonica = `OPORTUNIDADE:${card.empresaId}:${servico.id}`;
    const existente = await tx.bpmAutomacaoExecucao.findUnique({
      where: { automacaoId_eventoChave: { automacaoId: params.automacaoId, eventoChave: chaveCanonica } },
      select: { id: true },
    });
    if (existente && existente.id !== params.execucaoId) {
      return finalizarExecucaoNaTransacao({
        tx, execucaoId: params.execucaoId, cardId: card.id,
        automacaoId: params.automacaoId, automacaoNome: params.automacaoNome,
        acaoTipo: "IDENTIFICAR_OPORTUNIDADE",
        resultado: { tipo: "OPORTUNIDADE", status: "IGNORADA", motivo: "Oportunidade já identificada", servico },
      });
    }
    await tx.bpmAutomacaoExecucao.update({
      where: { id: params.execucaoId },
      data: { eventoChave: chaveCanonica },
    });

    const acao = params.configuracao.acao;
    let resultadoAcao: Record<string, unknown>;
    if (acao.tipo === "CRIAR_CARD_COMERCIAL") {
      const etapa = await tx.bpmEtapa.findFirst({
        where: { id: acao.etapaId, pipelineId: acao.pipelineId, ativo: true },
        select: { id: true },
      });
      if (!etapa || !(await usuarioElegivelResponsavelBpm(acao.pipelineId, acao.responsavelId, tx))) {
        throw new Error("Destino ou responsável comercial inválido");
      }
      const novo = await tx.bpmCard.create({
        data: {
          empresaId: card.empresaId,
          pipelineId: acao.pipelineId,
          etapaId: acao.etapaId,
          responsavelId: acao.responsavelId,
          servico: servico.nome,
        },
      });
      await tx.bpmCardMembro.create({ data: { cardId: novo.id, userId: acao.responsavelId, role: "RESPONSAVEL" } });
      await tx.bpmCardVinculo.create({ data: { cardOrigemId: card.id, cardDestinoId: novo.id } });
      await tx.bpmCardHistorico.create({
        data: {
          cardId: novo.id,
          acao: "CARD_CRIADO_POR_OPORTUNIDADE",
          automacaoOrigem: params.automacaoId,
          valorNovoJson: JSON.stringify({ execucaoId: params.execucaoId, servicoId: servico.id, servico: servico.nome }),
        },
      });
      await enfileirarAutomacoesCriacaoCardBpm({
        cardId: novo.id,
        pipelineId: novo.pipelineId,
        etapaId: novo.etapaId,
      }, tx);
      resultadoAcao = { cardCriadoId: novo.id };
    } else if (acao.tipo === "ATRIBUIR_VENDEDOR") {
      if (!(await usuarioElegivelResponsavelBpm(card.pipelineId, acao.responsavelId, tx))) {
        throw new Error("Vendedor sem permissão para o pipeline");
      }
      await tx.bpmCard.update({ where: { id: card.id }, data: { responsavelId: acao.responsavelId } });
      await tx.bpmCardMembro.updateMany({ where: { cardId: card.id, role: "RESPONSAVEL" }, data: { role: "PARTICIPANTE" } });
      await tx.bpmCardMembro.upsert({
        where: { cardId_userId: { cardId: card.id, userId: acao.responsavelId } },
        create: { cardId: card.id, userId: acao.responsavelId, role: "RESPONSAVEL" },
        update: { role: "RESPONSAVEL" },
      });
      resultadoAcao = { responsavelId: acao.responsavelId };
    } else if (acao.tipo === "CRIAR_TAREFA") {
      if (acao.responsavelId && !(await usuarioElegivelResponsavelBpm(card.pipelineId, acao.responsavelId, tx))) {
        throw new Error("Responsável da tarefa sem permissão para o pipeline");
      }
      const prazo = new Date();
      prazo.setUTCDate(prazo.getUTCDate() + acao.prazoDias);
      const tarefa = await tx.bpmTarefa.create({
        data: {
          cardId: card.id,
          titulo: acao.titulo,
          descricao: acao.descricao || null,
          responsavelId: acao.responsavelId ?? card.responsavelId,
          prazo,
        },
      });
      await enfileirarAutomacoesCriacaoTarefaBpm({
        tarefaId: tarefa.id,
        cardId: card.id,
        pipelineId: card.pipelineId,
        etapaId: card.etapaId,
      }, tx);
      resultadoAcao = { tarefaId: tarefa.id };
    } else if (acao.tipo === "ADICIONAR_ANOTACAO") {
      const anotacao = await tx.bpmInteracaoCard.create({
        data: { cardId: card.id, tipo: "ANOTACAO", observacoes: acao.texto, registradoPorId: params.criadoPorId },
      });
      resultadoAcao = { anotacaoId: anotacao.id };
    } else if (acao.tipo === "ALTERAR_CAMPO") {
      const campo = await tx.bpmCampo.findFirst({
        where: { id: acao.campoId, pipelineId: card.pipelineId },
        select: { id: true, nome: true, tipo: true, opcoesJson: true },
      });
      if (!campo) throw new Error("Campo configurado não pertence ao pipeline do card");
      if (campoFinanceiroSomenteLeitura(campo.nome)) {
        throw new Error("Campo financeiro automático não pode ser alterado por oportunidade");
      }
      const validacao = validarValoresCamposBpm([campo], { [campo.id]: acao.valor });
      if (!validacao.success) throw new Error(validacao.error);
      await tx.bpmCardCampoValor.upsert({
        where: { cardId_campoId: { cardId: card.id, campoId: campo.id } },
        create: { cardId: card.id, campoId: campo.id, valor: validacao.valores[campo.id] },
        update: { valor: validacao.valores[campo.id] },
      });
      resultadoAcao = { campoId: campo.id };
    } else {
      return { tipo: "OPORTUNIDADE", status: "COMUNICACAO_PENDENTE", servico, acao };
    }

    await tx.bpmCardHistorico.create({
      data: {
        cardId: card.id,
        acao: "OPORTUNIDADE_IDENTIFICADA",
        automacaoOrigem: params.automacaoId,
        valorNovoJson: JSON.stringify({
          execucaoId: params.execucaoId,
          servicoId: servico.id,
          servico: servico.nome,
          acao: acao.tipo,
          resultado: resultadoAcao,
        }),
      },
    });
    return finalizarExecucaoNaTransacao({
      tx, execucaoId: params.execucaoId, cardId: card.id,
      automacaoId: params.automacaoId, automacaoNome: params.automacaoNome,
      acaoTipo: "IDENTIFICAR_OPORTUNIDADE",
      resultado: { tipo: "OPORTUNIDADE", status: "CRIADA", servico, acao: acao.tipo, resultado: resultadoAcao },
    });
  });
}
