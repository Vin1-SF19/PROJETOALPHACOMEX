import "server-only";
import { compare } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { executarComRetryDeAtribuicao, registrarAtribuicaoDeOrigemCloserBpm } from "@/lib/bpm/atribuicao-closers-server";
import { INSTAGRAM_ENDPOINT_SLUG, chaveLeadInstagram, lerLeadInstagram, prepararLeadInstagram, type InstagramLinha } from "@/lib/bpm/instagram-leads";

type ClienteInbox = Pick<Prisma.TransactionClient, "bpmWebhookEndpoint" | "bpmWebhookEntrada" | "bpmEtapa">;

export class ErroInstagram extends Error {
  constructor(public status: number, public codigo: string, message: string) { super(message); }
}

export async function carregarEndpointInstagram(client: ClienteInbox = db) {
  const endpointId = process.env.INSTAGRAM_LEADS_ENDPOINT_ID;
  if (!endpointId) return null;
  const endpoint = await client.bpmWebhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { id: true, ativo: true, caminhoSlug: true, segredoHash: true, pipelineId: true, automacaoId: true,
      pipeline: { select: { nome: true, ativo: true } } },
  });
  if (!endpoint?.ativo || endpoint.caminhoSlug !== INSTAGRAM_ENDPOINT_SLUG || endpoint.automacaoId
    || !endpoint.pipelineId || !endpoint.pipeline?.ativo || endpoint.pipeline.nome !== "Revisão de Radar") return null;
  return endpoint;
}

export async function autenticarInstagram(authorization: string | null) {
  const token = authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
  if (!token) throw new ErroInstagram(401, "NAO_AUTORIZADO", "Não autorizado.");
  const endpoint = await carregarEndpointInstagram();
  if (!endpoint) throw new ErroInstagram(503, "INTEGRACAO_INDISPONIVEL", "Integração Instagram não configurada ou desativada.");
  if (!await compare(token, endpoint.segredoHash)) throw new ErroInstagram(401, "NAO_AUTORIZADO", "Não autorizado.");
  return endpoint;
}

export async function etapaEntradaInstagram(pipelineId: string, client: ClienteInbox = db) {
  const etapas = await client.bpmEtapa.findMany({ where: { pipelineId, ativo: true }, orderBy: { ordem: "asc" },
    select: { id: true, nome: true, visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } } } });
  const candidatas = etapas.filter((e) => ["novo lead", "novos leads"].includes(e.nome.trim().toLocaleLowerCase("pt-BR")));
  if (candidatas.length !== 1 || etapas[0]?.id !== candidatas[0].id) {
    throw new ErroInstagram(503, "ENTRADA_NAO_CONFIGURADA", "Configure uma única etapa inicial Novos leads.");
  }
  return candidatas[0];
}

export async function buscarInstagramLeadsPendentes(pipelineId: string) {
  const endpoint = await carregarEndpointInstagram();
  if (!endpoint || endpoint.pipelineId !== pipelineId) return [];
  const entradas = await db.bpmWebhookEntrada.findMany({
    where: { endpointId: endpoint.id, statusRecebimento: "AUTENTICADO", eventoId: null },
    select: { id: true, recebidoEm: true, payloadSanitizadoJson: true },
    orderBy: [{ recebidoEm: "desc" }, { id: "desc" }],
  });
  return entradas.flatMap((entrada) => {
    const dados = lerLeadInstagram(entrada.payloadSanitizadoJson);
    return dados ? [{ id: entrada.id, recebidoEm: entrada.recebidoEm, dados }] : [];
  });
}

export async function receberInstagramLead(endpointId: string, linha: InstagramLinha) {
  const idempotencyKey = chaveLeadInstagram(linha.id);
  const where = { endpointId_idempotencyKey: { endpointId, idempotencyKey } };
  const existente = await db.bpmWebhookEntrada.findUnique({ where,
    select: { id: true, statusRecebimento: true, payloadSanitizadoJson: true, eventoId: true, evento: { select: { cardId: true } } } });
  const duplicadoSeguro = (entrada: NonNullable<typeof existente>) => {
    const dados = lerLeadInstagram(entrada.payloadSanitizadoJson);
    if (!dados || dados.externalId !== linha.id
      || !(entrada.statusRecebimento === "AUTENTICADO" && !entrada.eventoId || entrada.statusRecebimento === "PROCESSADO" && entrada.evento?.cardId)) {
      throw new ErroInstagram(409, "ENTRADA_INCONSISTENTE", "O ID já possui uma entrada inconsistente. Solicite revisão administrativa.");
    }
    return { leadId: entrada.id, duplicate: true,
      status: entrada.statusRecebimento === "PROCESSADO" ? "promoted" : "pending", cardId: entrada.evento?.cardId ?? null };
  };
  if (existente) return duplicadoSeguro(existente);
  try {
    const dados = prepararLeadInstagram(linha);
    const endpoint = await db.bpmWebhookEndpoint.findUnique({ where: { id: endpointId }, select: { pipelineId: true } });
    const entrada = await executarComRetryDeAtribuicao(() => db.$transaction(async (tx) => {
      const novaEntrada = await tx.bpmWebhookEntrada.create({ data: {
        endpointId, idempotencyKey, statusRecebimento: "AUTENTICADO", payloadSanitizadoJson: JSON.stringify(dados),
      }, select: { id: true } });
      if (endpoint?.pipelineId) await registrarAtribuicaoDeOrigemCloserBpm({
        pipelineId: endpoint.pipelineId,
        origemTipo: "INSTAGRAM",
        origemId: novaEntrada.id,
        client: tx,
      });
      return novaEntrada;
    }));
    return { leadId: entrada.id, duplicate: false, status: "pending", cardId: null };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const duplicado = await db.bpmWebhookEntrada.findUnique({ where,
        select: { id: true, statusRecebimento: true, payloadSanitizadoJson: true, eventoId: true, evento: { select: { cardId: true } } } });
      if (duplicado) return duplicadoSeguro(duplicado);
    }
    throw error;
  }
}
