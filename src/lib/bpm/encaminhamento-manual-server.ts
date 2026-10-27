import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { checarAcessoBpmCard, usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import { resolverNivelAcessoPipeline } from "@/lib/bpm/acesso-pipeline";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";
import { etapaEhBoasVindas, PIPELINE_OPERACIONAL_ATIVO_ID, podeAgirBoasVindasOperacional } from "@/lib/bpm/boas-vindas";
import { executarTransicaoBpm } from "@/lib/bpm/transicao-command";
import { copiarCamposCardVinculado } from "@/lib/bpm/copiar-campos-card-vinculado";
import { criarSlaInstancia } from "@/lib/bpm/sla";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { encaminhamentoManualSchema, ErroEncaminhamentoManual, type ComandoEncaminhamentoManual } from "./encaminhamento-manual";

type Cliente = Prisma.TransactionClient;
function falhar(mensagem: string): never { throw new ErroEncaminhamentoManual(mensagem); }

/** Autoridade calculada na origem, independentemente dos membros do card. */
export async function autorizarEncaminhamentoManual(cardId: string, usuarioId: number, client: Cliente = db) {
  const acesso = await checarAcessoBpmCard(cardId, usuarioId, null, "moverEtapa", client);
  if (!acesso.autorizado || !acesso.autoridadeMovimentoLivre) falhar("Você não pode encaminhar manualmente este card.");
  const card = await client.bpmCard.findUnique({ where: { id: cardId }, include: { pipeline: true, etapa: true } });
  if (!card || card.status === "ARQUIVADO" || !card.pipeline.ativo || !card.etapa.ativo || card.etapa.pipelineId !== card.pipelineId) {
    falhar("Card indisponível para encaminhamento.");
  }
  return card;
}

async function carregarEtapaDestino(pipelineId: string, etapaId: string, client: Cliente) {
  const etapa = await client.bpmEtapa.findFirst({ where: { id: etapaId, pipelineId, ativo: true, pipeline: { ativo: true } },
    select: { id: true, nome: true, pipelineId: true, pipeline: { select: { visualizacaoConfigJson: true, setores: { select: { setor: { select: { id: true, nome: true, ativo: true } } } } } }, visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } });
  if (!etapa) falhar("Escolha um pipeline e uma etapa ativos e compatíveis.");
  return etapa;
}

export async function responsavelElegivelEncaminhamentoManual(pipelineId: string, etapaId: string, usuarioId: number, client: Cliente = db) {
  const [etapa, usuario] = await Promise.all([
    carregarEtapaDestino(pipelineId, etapaId, client),
    client.usuarios.findUnique({ where: { id: usuarioId }, select: { id: true, role: true, status: true } }),
  ]);
  if (!usuario || usuario.status !== "ATIVO" || !await usuarioElegivelResponsavelBpm(pipelineId, usuarioId, client)) return false;
  if (resolverNivelAcessoPipeline({ usuarioId, role: usuario.role,
    visualizacaoConfigJson: etapa.pipeline.visualizacaoConfigJson,
    setoresPipeline: etapa.pipeline.setores.map(({ setor }) => setor) }) === "ADMINISTRATIVO") return true;
  if (!resolverVisibilidadeEtapa(usuario.role, etapa.visibilidades).podeAgir) return false;
  return pipelineId !== PIPELINE_OPERACIONAL_ATIVO_ID || !etapaEhBoasVindas(etapa.nome)
    || podeAgirBoasVindasOperacional(usuarioId, usuario.role);
}

/** Nenhum acesso de leitura aos cards do destino é concedido pelo catálogo de envio. */
export async function obterCatalogoEncaminhamentoManual(cardId: string, usuarioId: number, client: Cliente = db) {
  await autorizarEncaminhamentoManual(cardId, usuarioId, client);
  return client.bpmPipeline.findMany({ where: { ativo: true, etapas: { some: { ativo: true } } },
    select: { id: true, nome: true, etapas: { where: { ativo: true }, orderBy: { ordem: "asc" }, select: { id: true, nome: true } } }, orderBy: { nome: "asc" } });
}

export async function obterResponsaveisEncaminhamentoManual(cardId: string, pipelineId: string, etapaId: string, usuarioId: number, client: Cliente = db) {
  await autorizarEncaminhamentoManual(cardId, usuarioId, client);
  await carregarEtapaDestino(pipelineId, etapaId, client);
  const usuarios = await client.usuarios.findMany({ where: { status: "ATIVO" }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const elegiveis = await Promise.all(usuarios.map(usuario => responsavelElegivelEncaminhamentoManual(pipelineId, etapaId, usuario.id, client)));
  return usuarios.filter((_, indice) => elegiveis[indice]);
}

/** Comando canônico manual: nenhuma regra/configuração de automação é criada. */
export async function encaminharCardManualmente(input: ComandoEncaminhamentoManual, usuarioId: number) {
  const dados = encaminhamentoManualSchema.parse(input);
  const origem = await autorizarEncaminhamentoManual(dados.cardId, usuarioId);
  if (origem.pipelineId === dados.pipelineDestinoId) {
    if (dados.responsavelDestinoId !== undefined) falhar("A alteração de etapa preserva o responsável atual.");
    const resultado = await executarTransicaoBpm({ cardId: dados.cardId, etapaOrigemEsperadaId: dados.etapaOrigemEsperadaId,
      etapaDestinoId: dados.etapaDestinoId, versaoEsperada: dados.versaoEsperada, idempotencyKey: `manual:${dados.idempotencyKey}`,
      ator: { tipo: "MANUAL", userId: usuarioId } });
    if (!resultado.success) falhar(resultado.error);
    return { cardId: dados.cardId, pipelineId: origem.pipelineId, etapaId: dados.etapaDestinoId, idempotente: resultado.data.idempotente, mesmoPipeline: true };
  }
  if (!dados.responsavelDestinoId) falhar("Selecione o responsável no pipeline de destino.");
  const hash = createHash("sha256").update(JSON.stringify({ cardId: dados.cardId, pipelineDestinoId: dados.pipelineDestinoId, etapaDestinoId: dados.etapaDestinoId, responsavelDestinoId: dados.responsavelDestinoId, usuarioId })).digest("hex");
  const chave = `manual-handoff:${dados.cardId}:${dados.idempotencyKey}`;
  return db.$transaction(async tx => {
    const card = await autorizarEncaminhamentoManual(dados.cardId, usuarioId, tx);
    const anterior = await tx.bpmEventoDominio.findUnique({ where: { idempotencyKey: chave } });
    if (anterior) {
      const payload = JSON.parse(anterior.valorNovoJson ?? "{}");
      if (anterior.atorUserId !== usuarioId || payload.comandoHash !== hash || payload.cardOrigemId !== card.id || !anterior.cardId) {
        falhar("Esta solicitação já foi usada para outro encaminhamento.");
      }
      return { cardId: anterior.cardId, pipelineId: dados.pipelineDestinoId, etapaId: dados.etapaDestinoId, idempotente: true, mesmoPipeline: false };
    }
    if (card.etapaId !== dados.etapaOrigemEsperadaId || card.versao !== dados.versaoEsperada) falhar("O card mudou. Atualize antes de encaminhar.");
    await carregarEtapaDestino(dados.pipelineDestinoId, dados.etapaDestinoId, tx);
    if (!await responsavelElegivelEncaminhamentoManual(dados.pipelineDestinoId, dados.etapaDestinoId, dados.responsavelDestinoId!, tx)) {
      falhar("O responsável não está disponível para esta etapa e pipeline.");
    }
    const existente = await tx.bpmCardVinculo.findFirst({ where: { cardOrigemId: card.id,
      cardDestino: { empresaId: card.empresaId, pipelineId: dados.pipelineDestinoId, status: { not: "ARQUIVADO" } } }, select: { id: true } });
    if (existente) falhar("Já existe encaminhamento para esse pipeline. O card de destino foi preservado.");
    const lock = await tx.bpmCard.updateMany({ where: { id: card.id, versao: dados.versaoEsperada, etapaId: dados.etapaOrigemEsperadaId },
      data: { versao: { increment: 1 } } });
    if (lock.count !== 1) falhar("O card mudou. Atualize antes de encaminhar.");
    const criado = await tx.bpmCard.create({ data: { empresaId: card.empresaId, pipelineId: dados.pipelineDestinoId,
      etapaId: dados.etapaDestinoId, responsavelId: dados.responsavelDestinoId!, servico: card.servico, tipoProcesso: card.tipoProcesso,
      membros: { create: { userId: dados.responsavelDestinoId!, role: "RESPONSAVEL" } } } });
    const vinculo = await tx.bpmCardVinculo.create({ data: { cardOrigemId: card.id, cardDestinoId: criado.id } });
    await copiarCamposCardVinculado(tx, card.id, criado.id, criado.pipelineId, criado.etapaId);
    const dadosHistorico = { comandoId: dados.idempotencyKey, cardOrigemId: card.id, cardDestinoId: criado.id,
      pipelineOrigemId: card.pipelineId, etapaOrigemId: card.etapaId, pipelineDestinoId: criado.pipelineId,
      etapaDestinoId: criado.etapaId, responsavelDestinoId: criado.responsavelId, vinculoId: vinculo.id };
    const historico = await tx.bpmCardHistorico.create({ data: { cardId: card.id, usuarioId, acao: "ENCAMINHAMENTO_MANUAL",
      valorAnteriorJson: JSON.stringify({ pipelineId: card.pipelineId, etapaId: card.etapaId, responsavelId: card.responsavelId, status: card.status, versao: card.versao }),
      valorNovoJson: JSON.stringify({ ...dadosHistorico, statusOrigemPreservado: card.status }) } });
    await tx.bpmCardHistorico.create({ data: { cardId: criado.id, usuarioId, acao: "CARD_RECEBIDO_POR_ENCAMINHAMENTO_MANUAL", valorNovoJson: JSON.stringify(dadosHistorico) } });
    const evento = await publicarEventoBpm({ tipo: "CARD_CRIADO", entidadeTipo: "CARD", entidadeId: criado.id, cardId: criado.id,
      pipelineId: criado.pipelineId, atorTipo: "USUARIO", atorUserId: usuarioId,
      valorNovo: { etapaId: criado.etapaId, responsavelId: criado.responsavelId, cardOrigemId: card.id, comandoHash: hash,
        encaminhamentoManual: true, automacoesSuprimidas: true }, correlationId: dados.idempotencyKey, causationId: historico.id,
      idempotencyKey: chave }, tx);
    if (!evento) falhar("Não foi possível registrar o encaminhamento.");
    await criarSlaInstancia({ cardId: criado.id }, "ENTRADA_ETAPA", tx, criado.createdAt);
    return { cardId: criado.id, pipelineId: criado.pipelineId, etapaId: criado.etapaId, idempotente: false, mesmoPipeline: false };
  });
}
