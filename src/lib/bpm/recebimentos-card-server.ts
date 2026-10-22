import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { etapaEhBoasVindas, podeAgirBoasVindasOperacional } from "@/lib/bpm/boas-vindas";
import { ehPipelineOperacional } from "@/lib/bpm/financeiro-config.client";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { responsavelPipelineBpmSchema, type RecebimentoPipelineBpm, type ResponsavelPipelineBpm } from "./notificacoes-leads";
import { listarDestinatariosFilaLeadsBpm, setorUsuarioFilaBpm } from "./notificacoes-leads-server";

export const ACAO_RECEPCAO_PIPELINE = "RECEPCAO_PIPELINE_PENDENTE";
export const ACAO_ASSUNCAO_PIPELINE = "RECEPCAO_PIPELINE_ASSUMIDA";
export const idRecepcaoPipeline = (cardId: string) => `recepcao-pipeline:${cardId}`;
export const idAssuncaoPipeline = (cardId: string) => `assuncao-pipeline:${cardId}`;
const identidade = z.string().min(1).max(200);
const markerSchema = z.object({ versao: z.literal(1), cardDestinoId: identidade, pipelineDestinoId: identidade,
  cardOrigemId: identidade, pipelineOrigemId: identidade, execucaoId: identidade,
  responsaveisAnteriores: z.array(responsavelPipelineBpmSchema).max(3),
}).strict();
const claimSchema = z.object({ versao: z.literal(1), recepcaoId: identidade, usuarioId: z.number().int().positive(),
  versaoCard: z.number().int().nonnegative(), responsavel: responsavelPipelineBpmSchema,
}).strict();
function lerJson(json: string | null): unknown { try { return JSON.parse(json ?? "null"); } catch { return null; } }
function setorPipeline(chave: string | null, nome: string, id: string): ResponsavelPipelineBpm["setor"] | null {
  return chave === "comercial" || nome === "Revisão de Radar" ? "COMERCIAL"
    : chave === "financeiro" ? "FINANCEIRO" : ehPipelineOperacional({ id, chave }) ? "OPERACIONAL" : null;
}

/** Só é chamado pela criação canônica de um destino novo, na mesma transação. */
export async function registrarRecepcaoPipelineBpm(tx: Prisma.TransactionClient, origemId: string, destinoId: string, execucaoId: string) {
  const cards = await tx.bpmCard.findMany({ where: { id: { in: [origemId, destinoId] } }, select: {
    id: true, empresaId: true, pipelineId: true, responsavelId: true,
    pipeline: { select: { chave: true, nome: true } }, responsavel: { select: { nome: true } },
  } });
  const origem = cards.find((card) => card.id === origemId); const destino = cards.find((card) => card.id === destinoId);
  if (!origem || !destino || origem.empresaId !== destino.empresaId) throw new Error("Origem da recepção incompatível");
  const setorDestino = setorPipeline(destino.pipeline.chave, destino.pipeline.nome, destino.pipelineId);
  if (setorDestino !== "FINANCEIRO" && setorDestino !== "OPERACIONAL") return null;
  const setorOrigem = setorPipeline(origem.pipeline.chave, origem.pipeline.nome, origem.pipelineId);
  const anteriores = await carregarRecepcoesPipelineBpm([idRecepcaoPipeline(origemId)], tx);
  const anterior = anteriores.get(origemId);
  const responsaveis = [...(anterior?.marker.responsaveisAnteriores ?? [])];
  // Uma atribuição técnica de um setor ainda pendente não comprova assunção.
  if (setorOrigem && (!anterior || anterior.claim)) {
    responsaveis.push({ pipelineId: origem.pipelineId, pipelineNome: origem.pipeline.nome, setor: setorOrigem,
      usuarioId: anterior?.claim?.usuarioId ?? origem.responsavelId,
      nome: anterior?.claim?.responsavel.nome ?? origem.responsavel.nome });
  }
  if (setorDestino === "OPERACIONAL" && !responsaveis.some((responsavel) => responsavel.setor === "COMERCIAL")) {
    const vinculos = await tx.bpmCardVinculo.findMany({ where: { cardDestinoId: origemId,
      cardOrigem: { empresaId: origem.empresaId, pipeline: { OR: [{ chave: "comercial" }, { nome: "Revisão de Radar" }] } } }, take: 2,
      select: { cardOrigem: { select: { pipelineId: true, responsavelId: true,
        pipeline: { select: { nome: true } }, responsavel: { select: { nome: true } } } } } });
    if (vinculos.length === 1) {
      const comercial = vinculos[0].cardOrigem;
      responsaveis.unshift({ pipelineId: comercial.pipelineId, pipelineNome: comercial.pipeline.nome, setor: "COMERCIAL",
        usuarioId: comercial.responsavelId, nome: comercial.responsavel.nome });
    }
  }
  const marker = markerSchema.parse({ versao: 1, cardDestinoId: destino.id, pipelineDestinoId: destino.pipelineId,
    cardOrigemId: origem.id, pipelineOrigemId: origem.pipelineId, execucaoId,
    responsaveisAnteriores: [...new Map(responsaveis.map((responsavel) => [responsavel.pipelineId, responsavel])).values()],
  });
  return tx.bpmCardHistorico.create({ data: { id: idRecepcaoPipeline(destino.id), cardId: destino.id,
    acao: ACAO_RECEPCAO_PIPELINE, valorNovoJson: JSON.stringify(marker) } });
}

/** Validação em lote: nunca depende dos últimos 50 históricos exibidos no modal. */
export async function carregarRecepcoesPipelineBpm(ids: string[], client: Prisma.TransactionClient = db) {
  const registros = ids.length ? await client.bpmCardHistorico.findMany({ where: { id: { in: ids }, acao: ACAO_RECEPCAO_PIPELINE },
    select: { id: true, cardId: true, createdAt: true, valorNovoJson: true } }) : [];
  const marcadores = registros.flatMap((registro) => {
    const parsed = markerSchema.safeParse(lerJson(registro.valorNovoJson));
    return parsed.success && registro.id === idRecepcaoPipeline(registro.cardId) && parsed.data.cardDestinoId === registro.cardId
      ? [{ registro, marker: parsed.data }] : [];
  });
  const cardIds = marcadores.map(({ marker }) => marker.cardDestinoId);
  const execucaoIds = marcadores.map(({ marker }) => marker.execucaoId);
  const [cards, vinculos, execucoes, eventos, claims] = cardIds.length ? await Promise.all([
    client.bpmCard.findMany({ where: { id: { in: cardIds } }, select: {
      id: true, empresaId: true, pipelineId: true, etapaId: true, status: true, versao: true, updatedAt: true,
      responsavelId: true, servico: true, pipeline: { select: { ativo: true, chave: true, nome: true } },
      etapa: { select: { ativo: true, nome: true } }, empresa: { select: { razaoSocial: true, cnpj: true } },
    } }),
    client.bpmCardVinculo.findMany({ where: { cardDestinoId: { in: cardIds } },
      select: { cardOrigemId: true, cardDestinoId: true, cardOrigem: { select: { empresaId: true, pipelineId: true } } } }),
    client.bpmAutomacaoExecucao.findMany({ where: { id: { in: execucaoIds } }, select: { id: true, cardId: true } }),
    client.bpmEventoDominio.findMany({ where: { tipo: "CARD_CRIADO", cardId: { in: cardIds }, atorExecucaoId: { in: execucaoIds } },
      select: { cardId: true, pipelineId: true, atorExecucaoId: true, valorNovoJson: true } }),
    client.bpmCardHistorico.findMany({ where: { id: { in: cardIds.map(idAssuncaoPipeline) }, acao: ACAO_ASSUNCAO_PIPELINE },
      select: { id: true, cardId: true, usuarioId: true, createdAt: true, valorNovoJson: true } }),
  ]) : [[], [], [], [], []];
  const resultado = new Map<string, { registro: typeof registros[number]; marker: z.infer<typeof markerSchema>;
    card: typeof cards[number]; claim: z.infer<typeof claimSchema> | null; assumidoEm: Date | null }>();
  for (const { registro, marker } of marcadores) {
    const card = cards.find((card) => card.id === marker.cardDestinoId);
    if (!card || card.pipelineId !== marker.pipelineDestinoId || !["FINANCEIRO", "OPERACIONAL"].includes(setorPipeline(card.pipeline.chave, card.pipeline.nome, card.pipelineId) ?? "")) continue;
    if (!vinculos.some((vinculo) => vinculo.cardDestinoId === card.id && vinculo.cardOrigemId === marker.cardOrigemId
      && vinculo.cardOrigem.empresaId === card.empresaId && vinculo.cardOrigem.pipelineId === marker.pipelineOrigemId)
      || !execucoes.some((execucao) => execucao.id === marker.execucaoId && execucao.cardId === marker.cardOrigemId)
      || !eventos.some((evento) => evento.cardId === card.id && evento.pipelineId === card.pipelineId
        && evento.atorExecucaoId === marker.execucaoId
        && (() => { const valor = lerJson(evento.valorNovoJson); return valor && typeof valor === "object" && "cardOrigemId" in valor && valor.cardOrigemId === marker.cardOrigemId; })())) continue;
    const historicoClaim = claims.find((claim) => claim.cardId === card.id);
    const claim = claimSchema.safeParse(lerJson(historicoClaim?.valorNovoJson ?? null));
    if (historicoClaim && (!claim.success || claim.data.recepcaoId !== registro.id || claim.data.usuarioId !== historicoClaim.usuarioId
      || claim.data.responsavel.usuarioId !== claim.data.usuarioId || claim.data.responsavel.pipelineId !== card.pipelineId
      || claim.data.responsavel.setor !== setorPipeline(card.pipeline.chave, card.pipeline.nome, card.pipelineId))) continue;
    resultado.set(card.id, { registro, marker, card, claim: claim.success ? claim.data : null,
      assumidoEm: historicoClaim?.createdAt ?? null });
  }
  return resultado;
}

export async function obterRecebimentoPipelineBpm(cardId: string, usuarioId: number, client: Prisma.TransactionClient = db): Promise<RecebimentoPipelineBpm | null> {
  const recebimento = (await carregarRecepcoesPipelineBpm([idRecepcaoPipeline(cardId)], client)).get(cardId);
  if (!recebimento) return null;
  const { registro, marker, card, claim, assumidoEm } = recebimento;
  const candidato = !claim && card.status === "ATIVO" && card.pipeline.ativo && card.etapa.ativo
    ? (await listarDestinatariosFilaLeadsBpm(card.pipelineId, card.etapaId, client)).find((usuario) => usuario.id === usuarioId) : null;
  const permitidoBoasVindas = !ehPipelineOperacional({ id: card.pipelineId, chave: card.pipeline.chave }) || !etapaEhBoasVindas(card.etapa.nome)
    || Boolean(candidato && podeAgirBoasVindasOperacional(usuarioId, candidato.role));
  const podeAssumir = Boolean(candidato?.podeAgir && permitidoBoasVindas
    && setorUsuarioFilaBpm(candidato.role) === setorPipeline(card.pipeline.chave, card.pipeline.nome, card.pipelineId));
  return { recepcaoId: registro.id, status: claim ? "ASSUMIDO" : "PENDENTE", recebidoEm: registro.createdAt.toISOString(),
    podeAssumir, assumidoEm: assumidoEm?.toISOString() ?? null,
    motivoImpedimentoAssuncao: claim || podeAssumir ? null : "Seu perfil não pode assumir este card na etapa atual.",
    assumidoPor: claim?.responsavel ?? null, responsaveisAnteriores: marker.responsaveisAnteriores };
}

export async function assumirRecebimentoPipelineBpm(input: { cardId: string; recepcaoId: string; versaoEsperada: number }, usuarioId: number, client: typeof db = db) {
  return client.$transaction(async (tx) => {
    const recebimento = (await carregarRecepcoesPipelineBpm([input.recepcaoId], tx)).get(input.cardId);
    if (!recebimento) throw new Error("Recepção não encontrada");
    const { card, claim, marker } = recebimento;
    const candidato = (await listarDestinatariosFilaLeadsBpm(card.pipelineId, card.etapaId, tx)).find((usuario) => usuario.id === usuarioId);
    if (!candidato?.podeAgir
      || setorUsuarioFilaBpm(candidato.role) !== setorPipeline(card.pipeline.chave, card.pipeline.nome, card.pipelineId)
      || !await usuarioElegivelResponsavelBpm(card.pipelineId, usuarioId, tx)) throw new Error("Não autorizado");
    if (claim) {
      if (claim.usuarioId !== usuarioId) throw new Error("Este card já foi assumido por outra pessoa");
      return { cardId: card.id, pipelineId: card.pipelineId, idempotente: true };
    }
    if (card.status !== "ATIVO" || !card.pipeline.ativo || !card.etapa.ativo) throw new Error("Card indisponível para assunção");
    if (ehPipelineOperacional({ id: card.pipelineId, chave: card.pipeline.chave }) && etapaEhBoasVindas(card.etapa.nome)
      && !podeAgirBoasVindasOperacional(usuarioId, candidato.role)) throw new Error("Seu perfil não pode assumir nesta etapa");
    if (card.versao !== input.versaoEsperada) throw new Error("O card mudou. Recarregue e tente novamente");
    const updatedAt = new Date(Math.max(Date.now(), card.updatedAt.getTime() + 1));
    const cas = await tx.bpmCard.updateMany({ where: { id: card.id, versao: input.versaoEsperada, updatedAt: card.updatedAt,
      pipelineId: card.pipelineId, status: "ATIVO" }, data: { responsavelId: usuarioId, versao: { increment: 1 }, updatedAt } });
    if (cas.count !== 1) throw new Error("O card mudou. Recarregue e tente novamente");
    await tx.bpmCardMembro.updateMany({ where: { cardId: card.id, role: "RESPONSAVEL" }, data: { role: "PARTICIPANTE" } });
    await tx.bpmCardMembro.upsert({ where: { cardId_userId: { cardId: card.id, userId: usuarioId } },
      create: { cardId: card.id, userId: usuarioId, role: "RESPONSAVEL" }, update: { role: "RESPONSAVEL" } });
    const responsavel = responsavelPipelineBpmSchema.parse({ pipelineId: card.pipelineId, pipelineNome: card.pipeline.nome,
      setor: setorPipeline(card.pipeline.chave, card.pipeline.nome, card.pipelineId), usuarioId, nome: candidato.nome });
    const dados = claimSchema.parse({ versao: 1, recepcaoId: input.recepcaoId, usuarioId, versaoCard: card.versao + 1, responsavel });
    await tx.bpmCardHistorico.create({ data: { id: idAssuncaoPipeline(card.id), cardId: card.id, usuarioId,
      acao: ACAO_ASSUNCAO_PIPELINE, valorNovoJson: JSON.stringify(dados) } });
    await publicarEventoBpm({ tipo: "RESPONSAVEL_ATRIBUIDO", entidadeTipo: "CARD", entidadeId: card.id,
      cardId: card.id, pipelineId: card.pipelineId, atorTipo: "USUARIO", atorUserId: usuarioId,
      valorAnterior: { responsavelId: card.responsavelId }, valorNovo: { responsavelId: usuarioId, recepcaoId: input.recepcaoId },
      correlationId: randomUUID(), causationId: input.recepcaoId,
      idempotencyKey: `recepcao-assumida:${input.recepcaoId}`, }, tx);
    return { cardId: card.id, pipelineId: card.pipelineId, idempotente: false, origemId: marker.cardOrigemId };
  });
}
