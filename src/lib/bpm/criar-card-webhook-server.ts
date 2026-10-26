import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import db from "@/lib/prisma";
import { ativarCadenciasNaEntradaBpm } from "@/lib/bpm/cadencias/ativacao-automatica";
import { processarCadenciasImediatasDoCardBpm } from "@/lib/bpm/cadencias/executor";
import {
  alocarProximoCloserBpm,
  executarComRetryDeAtribuicao,
  registrarAtribuicaoDeCardCloserBpm,
} from "@/lib/bpm/atribuicao-closers-server";
import { enfileirarAutomacoesCriacaoCardBpm } from "@/lib/bpm/automacoes/fila";
import { publicarEventoBpm, sanitizarPayloadAutomacao } from "@/lib/bpm/automacoes/eventos";
import { criarSlaInstancia } from "@/lib/bpm/sla";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { carregarSnapshotsCopiaCamposCard } from "@/lib/bpm/requisitos-etapa-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const empresaSchema = z.object({
  cnpj: z.string().trim().min(11).max(18).refine(cnpjEhValido, "CNPJ inválido"),
  razaoSocial: z.string().trim().min(2).max(200),
  nomeFantasia: z.string().trim().max(200).optional(),
  uf: z.string().trim().length(2).optional(),
  municipio: z.string().trim().max(120).optional(),
}).strict();

export const criarCardWebhookSchema = z.object({
  empresa: empresaSchema,
  radarPretendido: z.string().trim().min(1).max(120).optional(),
  canalOrigem: z.string().trim().max(120).optional(),
  qualificacao: z.enum(["Qualificado", "Sem qualificação"]).optional(),
}).strict();

export type DadosCriarCardWebhook = z.infer<typeof criarCardWebhookSchema>;

export class ErroCriacaoCardWebhook extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    message: string,
  ) {
    super(message);
  }
}

type ClienteCriacaoCardWebhook = Prisma.TransactionClient;

type ResultadoCriacaoCardWebhook = {
  cardId: string;
  closerEmail: string;
  empresaId: number;
  pipelineId: string;
  etapaId: string;
  responsavelId: number;
  duplicate: boolean;
};

const PREFIXO_IDEMPOTENCIA = "api-card:";

function chaveIdempotenciaArmazenada(endpointId: string, chave: string) {
  return `${PREFIXO_IDEMPOTENCIA}${endpointId}:${chave}`;
}

async function resolverEtapaNovosLeads(pipelineId: string, client: ClienteCriacaoCardWebhook) {
  const etapas = await client.bpmEtapa.findMany({
    where: { pipelineId, ativo: true },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true, ordem: true },
  });
  const etapasNovosLeads = etapas.filter((etapa) => etapaEhNovosLeads(etapa.nome));
  if (etapasNovosLeads.length !== 1 || etapas[0]?.id !== etapasNovosLeads[0]?.id) {
    throw new ErroCriacaoCardWebhook(
      503,
      "ETAPA_ENTRADA_NAO_CONFIGURADA",
      "Configure uma única etapa inicial de Novos Leads no pipeline.",
    );
  }
  return etapasNovosLeads[0];
}

async function buscarResultadoIdempotente(
  endpointId: string,
  chaveArmazenada: string,
  client: Pick<ClienteCriacaoCardWebhook, "bpmWebhookEntrada" | "usuarios">,
): Promise<ResultadoCriacaoCardWebhook | null> {
  const entrada = await client.bpmWebhookEntrada.findUnique({
    where: { endpointId_idempotencyKey: { endpointId, idempotencyKey: chaveArmazenada } },
    select: {
      statusRecebimento: true,
      evento: { select: { cardId: true, pipelineId: true, valorNovoJson: true, card: { select: { empresaId: true } } } },
    },
  });
  if (!entrada) return null;
  const evento = entrada.evento;
  if (entrada.statusRecebimento !== "PROCESSADO" || !evento?.cardId || !evento.pipelineId) {
    throw new ErroCriacaoCardWebhook(409, "CHAVE_IDEMPOTENCIA_EM_USO", "A chave de idempotência já foi utilizada.");
  }
  let valorNovo: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(evento.valorNovoJson ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) valorNovo = parsed as Record<string, unknown>;
  } catch { /* O card ainda pode ser recuperado pelo identificador do evento. */ }
  if (typeof valorNovo.responsavelId !== "number" || typeof valorNovo.etapaId !== "string") {
    throw new ErroCriacaoCardWebhook(409, "CHAVE_IDEMPOTENCIA_INCONSISTENTE", "Não foi possível recuperar o resultado da requisição anterior.");
  }
  const empresaId = evento.card?.empresaId;
  if (typeof empresaId !== "number") {
    throw new ErroCriacaoCardWebhook(409, "CHAVE_IDEMPOTENCIA_INCONSISTENTE", "Não foi possível recuperar o resultado da requisição anterior.");
  }
  const responsavel = await client.usuarios.findUnique({
    where: { id: valorNovo.responsavelId },
    select: { email: true },
  });
  if (!responsavel) {
    throw new ErroCriacaoCardWebhook(409, "CHAVE_IDEMPOTENCIA_INCONSISTENTE", "Não foi possível recuperar o closer atribuído ao card original.");
  }
  return {
    cardId: evento.cardId,
    closerEmail: responsavel.email,
    empresaId,
    pipelineId: evento.pipelineId,
    etapaId: valorNovo.etapaId,
    responsavelId: valorNovo.responsavelId,
    duplicate: true,
  };
}

async function criarCardNaTransacao(params: {
  endpointId: string;
  pipelineId: string;
  idempotencyKey: string;
  origemIp: string | null;
  dados: DadosCriarCardWebhook;
}, tx: ClienteCriacaoCardWebhook): Promise<ResultadoCriacaoCardWebhook> {
  const chaveArmazenada = chaveIdempotenciaArmazenada(params.endpointId, params.idempotencyKey);
  const resultadoExistente = await buscarResultadoIdempotente(params.endpointId, chaveArmazenada, tx);
  if (resultadoExistente) return resultadoExistente;

  const etapa = await resolverEtapaNovosLeads(params.pipelineId, tx);
  const alocacao = await alocarProximoCloserBpm(params.pipelineId, tx);
  if (!alocacao.distribuicaoAtiva) {
    throw new ErroCriacaoCardWebhook(409, "DISTRIBUICAO_INATIVA", "Ative a distribuição automática de closers antes de usar esta API.");
  }
  if (alocacao.responsavelId === null) {
    throw new ErroCriacaoCardWebhook(503, "SEM_CLOSER_ELEGIVEL", "Nenhum closer selecionado está elegível no momento.");
  }
  const responsavel = await tx.usuarios.findUnique({
    where: { id: alocacao.responsavelId },
    select: { email: true },
  });
  if (!responsavel) {
    throw new ErroCriacaoCardWebhook(503, "CLOSER_INDISPONIVEL", "Não foi possível resolver o closer selecionado.");
  }

  const cnpj = normalizarCNPJ(params.dados.empresa.cnpj);
  const empresa = await tx.cliente.upsert({
    where: { cnpj },
    create: {
      cnpj,
      razaoSocial: params.dados.empresa.razaoSocial,
      nomeFantasia: params.dados.empresa.nomeFantasia || null,
      uf: params.dados.empresa.uf?.toUpperCase() || null,
      municipio: params.dados.empresa.municipio || null,
      status: "ATIVO",
    },
    update: {},
    select: { id: true },
  });

  const campos = await tx.bpmCampo.findMany({
    where: {
      pipelineId: params.pipelineId,
      ativo: true,
      nome: { in: ["Radar pretendido", "Canal de origem", "Qualificação"] },
      etapaConfiguracoes: { some: { etapaId: etapa.id, visivel: true } },
    },
    select: {
      id: true,
      nome: true,
      tipo: true,
      opcoesJson: true,
      opcoes: { where: { ativo: true }, select: { rotulo: true } },
    },
  });

  const campoRadar = campos.find((campo) => campo.nome === "Radar pretendido");
  if (params.dados.radarPretendido) {
    if (!campoRadar || campoRadar.tipo !== "selecao") {
      throw new ErroCriacaoCardWebhook(409, "RADAR_NAO_CONFIGURADO", "Configure o campo Radar pretendido como seleção no Novo Lead.");
    }
    let opcoesLegadas: unknown = [];
    try { opcoesLegadas = JSON.parse(campoRadar.opcoesJson ?? "[]"); } catch { /* Configuração legada inválida é tratada como sem opções. */ }
    const opcoes = campoRadar.opcoes.length > 0
      ? campoRadar.opcoes.map((opcao) => opcao.rotulo)
      : Array.isArray(opcoesLegadas) ? opcoesLegadas.filter((opcao): opcao is string => typeof opcao === "string") : [];
    if (!opcoes.includes(params.dados.radarPretendido)) {
      throw new ErroCriacaoCardWebhook(400, "RADAR_INVALIDO", "O valor de Radar pretendido não é uma opção válida.");
    }
  }

  const card = await tx.bpmCard.create({
    data: {
      empresaId: empresa.id,
      pipelineId: params.pipelineId,
      etapaId: etapa.id,
      responsavelId: alocacao.responsavelId,
      servico: "Revisão de Radar",
      status: "ATIVO",
    },
    select: { id: true, createdAt: true, servico: true },
  });
  await registrarAtribuicaoDeCardCloserBpm({
    pipelineId: params.pipelineId,
    cardId: card.id,
    responsavelId: alocacao.responsavelId,
    onlineNaEscolha: alocacao.onlineNaEscolha,
    client: tx,
  });
  await tx.bpmCardMembro.create({
    data: { cardId: card.id, userId: alocacao.responsavelId, role: "RESPONSAVEL" },
  });

  const valoresCampos = [
    ["Radar pretendido", params.dados.radarPretendido],
    ["Canal de origem", params.dados.canalOrigem ?? "API"],
    ["Qualificação", params.dados.qualificacao],
  ] as const;
  for (const [nome, valor] of valoresCampos) {
    if (!valor) continue;
    const campo = campos.find((item) => item.nome === nome);
    if (!campo) {
      if (nome === "Canal de origem" && params.dados.canalOrigem === undefined) continue;
      throw new ErroCriacaoCardWebhook(409, "CAMPO_NAO_CONFIGURADO", `Configure o campo ${nome} na etapa Novos Leads.`);
    }
    await tx.bpmCardCampoValor.create({ data: { cardId: card.id, campoId: campo.id, valor } });
  }

  const snapshots = await carregarSnapshotsCopiaCamposCard(card.id, params.pipelineId, etapa.id, tx);
  for (const [campoId, valor] of Object.entries(snapshots)) {
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId: card.id, campoId } },
      create: { cardId: card.id, campoId, valor },
      update: {},
    });
  }

  const valorNovo = {
    empresaId: empresa.id,
    pipelineId: params.pipelineId,
    etapaId: etapa.id,
    responsavelId: alocacao.responsavelId,
    origem: "API",
  };
  await tx.bpmCardHistorico.create({
    data: {
      cardId: card.id,
      acao: "CARD_CRIADO",
      usuarioId: null,
      valorNovoJson: JSON.stringify(valorNovo),
    },
  });

  const evento = await publicarEventoBpm({
    tipo: "CARD_CRIADO",
    entidadeTipo: "CARD",
    entidadeId: card.id,
    cardId: card.id,
    pipelineId: params.pipelineId,
    valorNovo,
    atorTipo: "WEBHOOK",
    correlationId: randomUUID(),
    idempotencyKey: chaveArmazenada,
  }, tx);
  if (!evento) throw new Error("Não foi possível registrar o evento de criação.");

  await enfileirarAutomacoesCriacaoCardBpm({ cardId: card.id, pipelineId: params.pipelineId, etapaId: etapa.id }, tx);
  await criarSlaInstancia({ cardId: card.id }, "CRIACAO_CARD", tx, card.createdAt);
  await criarSlaInstancia({ cardId: card.id }, "ENTRADA_ETAPA", tx, card.createdAt);
  await ativarCadenciasNaEntradaBpm({
    cardId: card.id,
    pipelineAnteriorId: null,
    etapaAnteriorId: null,
    pipelineDestinoId: params.pipelineId,
    etapaDestinoId: etapa.id,
    evento: "CARD_CRIADO",
    agora: card.createdAt,
  }, tx);

  await tx.bpmWebhookEntrada.create({
    data: {
      endpointId: params.endpointId,
      idempotencyKey: chaveArmazenada,
      statusRecebimento: "PROCESSADO",
      origemIp: params.origemIp,
      payloadSanitizadoJson: JSON.stringify(sanitizarPayloadAutomacao({
        empresaCnpj: cnpj,
        empresaNome: params.dados.empresa.razaoSocial,
        radarPretendido: params.dados.radarPretendido,
        canalOrigem: params.dados.canalOrigem ?? "API",
        cardId: card.id,
      })),
      eventoId: evento.id,
    },
  });

  return {
    cardId: card.id,
    closerEmail: responsavel.email,
    empresaId: empresa.id,
    pipelineId: params.pipelineId,
    etapaId: etapa.id,
    responsavelId: alocacao.responsavelId,
    duplicate: false,
  };
}

function erroUnicidade(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function criarCardNovoLeadViaWebhook(params: {
  endpointId: string;
  pipelineId: string;
  idempotencyKey: string;
  origemIp: string | null;
  dados: DadosCriarCardWebhook;
}): Promise<ResultadoCriacaoCardWebhook> {
  let resultado: ResultadoCriacaoCardWebhook;
  try {
    resultado = await executarComRetryDeAtribuicao(() => db.$transaction((tx) => criarCardNaTransacao(params, tx)));
  } catch (error) {
    if (!erroUnicidade(error)) throw error;
    const duplicado = await buscarResultadoIdempotente(
      params.endpointId,
      chaveIdempotenciaArmazenada(params.endpointId, params.idempotencyKey),
      db,
    );
    if (!duplicado) throw error;
    resultado = duplicado;
  }

  if (!resultado.duplicate) {
    try { await notificarPipelineBpm({ pipelineId: resultado.pipelineId, cardId: resultado.cardId, tipo: "CARD_CRIADO" }); }
    catch { /* O polling do quadro também atualiza a lista. */ }
    try { await processarCadenciasImediatasDoCardBpm(resultado.cardId); }
    catch { console.error("[CriarCardNovoLeadViaWebhook] Cadência imediata pendente de processamento"); }
  }
  return resultado;
}
