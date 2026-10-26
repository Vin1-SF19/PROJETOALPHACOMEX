import "server-only";

import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import { repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";
import { usuarioElegivelResponsavelBpm } from "@/lib/bpm/ownership";
import {
  escolherProximoCloser,
  gravarConfiguracaoDistribuicaoClosers,
  lerConfiguracaoDistribuicaoClosers,
  usuarioOnlinePeloHeartbeat,
} from "@/lib/bpm/closer-distribution";

export type TipoOrigemAtribuicaoCloser = "CARD" | "NOLOSS" | "INSTAGRAM";
export type ClienteAtribuicaoCloser = Prisma.TransactionClient;

export type AlocacaoCloser = {
  distribuicaoAtiva: boolean;
  responsavelId: number | null;
  onlineNaEscolha: boolean;
};

export class ErroConflitoAtribuicaoCloser extends Error {
  constructor() {
    super("CONFLITO_DISTRIBUICAO_CLOSERS");
  }
}

export async function executarComRetryDeAtribuicao<T>(executar: () => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      return await repetirTransacaoOcupada(executar);
    } catch (error) {
      if (!(error instanceof ErroConflitoAtribuicaoCloser) || tentativa >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** tentativa));
    }
  }
}

async function lerPipelineDistribuicao(pipelineId: string, client: ClienteAtribuicaoCloser) {
  return client.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: { ativo: true, nome: true, visualizacaoConfigJson: true },
  });
}

/**
 * Escolhe um closer e avança o cursor no mesmo write transacional. O CAS impede
 * que duas entradas concorrentes consumam a mesma posição do rodízio.
 */
export async function alocarProximoCloserBpm(
  pipelineId: string,
  client: ClienteAtribuicaoCloser,
  agora = new Date(),
): Promise<AlocacaoCloser> {
  const pipeline = await lerPipelineDistribuicao(pipelineId, client);
  if (!pipeline?.ativo || !pipelineEhRevisaoRadar(pipeline.nome)) {
    return { distribuicaoAtiva: false, responsavelId: null, onlineNaEscolha: false };
  }

  const config = lerConfiguracaoDistribuicaoClosers(pipeline.visualizacaoConfigJson);
  if (!config.ativa) return { distribuicaoAtiva: false, responsavelId: null, onlineNaEscolha: false };

  const selecionados = [...new Set(config.usuariosIds)];
  const usuarios = selecionados.length
    ? await client.usuarios.findMany({
        where: { id: { in: selecionados }, status: "ATIVO" },
        select: { id: true, ultimo_aviso: true },
      })
    : [];
  const ativos = new Set(usuarios.map((usuario) => usuario.id));
  const elegiveisIds = (await Promise.all(selecionados
    .filter((id) => ativos.has(id))
    .map(async (id) => await usuarioElegivelResponsavelBpm(pipelineId, id, client) ? id : null)))
    .filter((id): id is number => id !== null);
  const onlineIds = usuarios
    .filter((usuario) => usuarioOnlinePeloHeartbeat(usuario.ultimo_aviso, agora))
    .map((usuario) => usuario.id);
  const resultado = escolherProximoCloser({ config, elegiveisIds, onlineIds });
  if (resultado.responsavelId === null) {
    return { distribuicaoAtiva: true, responsavelId: null, onlineNaEscolha: false };
  }

  const configAtualizado = gravarConfiguracaoDistribuicaoClosers(
    pipeline.visualizacaoConfigJson,
    resultado.proximoConfig,
  );
  const atualizado = await client.bpmPipeline.updateMany({
    where: { id: pipelineId, visualizacaoConfigJson: pipeline.visualizacaoConfigJson },
    data: { visualizacaoConfigJson: configAtualizado },
  });
  if (atualizado.count !== 1) throw new ErroConflitoAtribuicaoCloser();

  return {
    distribuicaoAtiva: true,
    responsavelId: resultado.responsavelId,
    onlineNaEscolha: resultado.onlineNaEscolha,
  };
}

/** Cria uma atribuição na chegada do lead; chamadas repetidas preservam o turno. */
export async function registrarAtribuicaoDeOrigemCloserBpm(params: {
  pipelineId: string;
  origemTipo: Exclude<TipoOrigemAtribuicaoCloser, "CARD">;
  origemId: string;
  client: ClienteAtribuicaoCloser;
}): Promise<number | null> {
  const unique = {
    pipelineId_origemTipo_origemId: {
      pipelineId: params.pipelineId,
      origemTipo: params.origemTipo,
      origemId: params.origemId,
    },
  };
  const existente = await params.client.bpmCloserAtribuicao.findUnique({
    where: unique,
    select: { responsavelId: true },
  });
  if (existente) return existente.responsavelId;

  const alocacao = await alocarProximoCloserBpm(params.pipelineId, params.client);
  if (!alocacao.distribuicaoAtiva) return null;
  await params.client.bpmCloserAtribuicao.create({
    data: {
      pipelineId: params.pipelineId,
      origemTipo: params.origemTipo,
      origemId: params.origemId,
      responsavelId: alocacao.responsavelId,
      onlineNaEscolha: alocacao.onlineNaEscolha,
    },
  });
  return alocacao.responsavelId;
}

export async function registrarAtribuicaoDeCardCloserBpm(params: {
  pipelineId: string;
  cardId: string;
  responsavelId: number;
  onlineNaEscolha: boolean;
  client: ClienteAtribuicaoCloser;
}): Promise<void> {
  await params.client.bpmCloserAtribuicao.create({
    data: {
      pipelineId: params.pipelineId,
      origemTipo: "CARD",
      origemId: params.cardId,
      cardId: params.cardId,
      responsavelId: params.responsavelId,
      onlineNaEscolha: params.onlineNaEscolha,
    },
  });
}

export async function buscarAtribuicaoOrigemCloserBpm(params: {
  pipelineId: string;
  origemTipo: Exclude<TipoOrigemAtribuicaoCloser, "CARD">;
  origemId: string;
  client: ClienteAtribuicaoCloser;
}) {
  return params.client.bpmCloserAtribuicao.findUnique({
    where: {
      pipelineId_origemTipo_origemId: {
        pipelineId: params.pipelineId,
        origemTipo: params.origemTipo,
        origemId: params.origemId,
      },
    },
    select: { id: true, responsavelId: true, onlineNaEscolha: true },
  });
}

/** Preserva a atribuição da origem ao converter o lead virtual em card real. */
export async function resolverAtribuicaoParaPromocaoCloserBpm(params: {
  pipelineId: string;
  origemTipo: Exclude<TipoOrigemAtribuicaoCloser, "CARD">;
  origemId: string;
  responsavelInformadoId: number;
  client: ClienteAtribuicaoCloser;
}): Promise<{ responsavelId: number; atribuicaoId: string | null; onlineNaEscolha: boolean }> {
  const origem = await buscarAtribuicaoOrigemCloserBpm(params);
  if (!origem) {
    return { responsavelId: params.responsavelInformadoId, atribuicaoId: null, onlineNaEscolha: false };
  }

  let responsavelId = origem.responsavelId;
  let onlineNaEscolha = origem.onlineNaEscolha;
  if (responsavelId === null) {
    const alocacao = await alocarProximoCloserBpm(params.pipelineId, params.client);
    responsavelId = alocacao.responsavelId;
    onlineNaEscolha = alocacao.onlineNaEscolha;
    if (responsavelId === null) throw new Error("Nenhum closer selecionado está elegível no momento.");
    await params.client.bpmCloserAtribuicao.update({
      where: { id: origem.id },
      data: { responsavelId, onlineNaEscolha },
    });
  }
  if (!await usuarioElegivelResponsavelBpm(params.pipelineId, responsavelId, params.client)) {
    throw new Error("O closer atribuído não está mais elegível. Solicite revisão administrativa.");
  }
  return { responsavelId, atribuicaoId: origem.id, onlineNaEscolha };
}

export async function vincularAtribuicaoPromovidaCloserBpm(params: {
  atribuicaoId: string | null;
  cardId: string;
  client: ClienteAtribuicaoCloser;
}): Promise<void> {
  if (!params.atribuicaoId) return;
  await params.client.bpmCloserAtribuicao.update({
    where: { id: params.atribuicaoId },
    data: { cardId: params.cardId },
  });
}

export async function carregarResponsaveisAtribuidosCloserBpm(
  pipelineId: string,
  origemTipo: TipoOrigemAtribuicaoCloser,
  origemIds: readonly string[],
) {
  if (origemIds.length === 0) return new Map<string, { id: number; nome: string }>();
  const atribuicoes = await db.bpmCloserAtribuicao.findMany({
    where: { pipelineId, origemTipo, origemId: { in: [...new Set(origemIds)] }, responsavelId: { not: null } },
    select: { origemId: true, responsavel: { select: { id: true, nome: true } } },
  });
  return new Map(atribuicoes.flatMap((atribuicao) =>
    atribuicao.responsavel ? [[atribuicao.origemId, atribuicao.responsavel] as const] : [],
  ));
}

export async function processarAtribuicoesClosersPendentesBpm(limite = 100) {
  const pendentes = await db.bpmCloserAtribuicao.findMany({
    where: { responsavelId: null, origemTipo: { in: ["NOLOSS", "INSTAGRAM"] } },
    select: { id: true, pipelineId: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limite, 1), 500),
  });
  let atribuidas = 0;
  let semElegiveis = 0;
  for (const pendente of pendentes) {
    const resultado = await executarComRetryDeAtribuicao(() => db.$transaction(async (tx) => {
      const atual = await tx.bpmCloserAtribuicao.findUnique({
        where: { id: pendente.id },
        select: { responsavelId: true, pipelineId: true },
      });
      if (!atual || atual.responsavelId !== null) return "ja-processada" as const;
      const alocacao = await alocarProximoCloserBpm(atual.pipelineId, tx);
      if (!alocacao.distribuicaoAtiva) return "desativada" as const;
      if (alocacao.responsavelId === null) return "sem-elegiveis" as const;
      const atualizada = await tx.bpmCloserAtribuicao.updateMany({
        where: { id: pendente.id, responsavelId: null },
        data: { responsavelId: alocacao.responsavelId, onlineNaEscolha: alocacao.onlineNaEscolha },
      });
      return atualizada.count === 1 ? "atribuida" as const : "ja-processada" as const;
    }));
    if (resultado === "atribuida") atribuidas += 1;
    if (resultado === "sem-elegiveis") semElegiveis += 1;
  }
  return { examinadas: pendentes.length, atribuidas, semElegiveis };
}
