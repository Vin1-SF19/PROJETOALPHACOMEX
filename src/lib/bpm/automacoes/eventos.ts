import "server-only";

import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { eventoDominioInputSchema, gatilhoConfigSchema, type TipoEventoAutomacao } from "./central-schemas";

type ClientePublicacaoEventos = Pick<Prisma.TransactionClient, "bpmEventoDominio">;
type ClienteEventos = Pick<Prisma.TransactionClient, "bpmEventoDominio" | "bpmAutomacaoVersao" | "bpmAutomacaoExecucao">;

const CHAVES_SENSIVEIS = /authorization|cookie|secret|segredo|token|password|senha|api[-_]?key/i;

export function sanitizarPayloadAutomacao(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return "[LIMITE_PROFUNDIDADE]";
  if (valor === null || typeof valor === "boolean" || typeof valor === "number") return valor;
  if (typeof valor === "string") return valor.slice(0, 8_000);
  if (Array.isArray(valor)) return valor.slice(0, 100).map((item) => sanitizarPayloadAutomacao(item, profundidade + 1));
  if (typeof valor !== "object") return String(valor).slice(0, 1_000);
  return Object.fromEntries(Object.entries(valor as Record<string, unknown>)
    .filter(([chave]) => !CHAVES_SENSIVEIS.test(chave))
    .slice(0, 100)
    .map(([chave, item]) => [chave.slice(0, 120), sanitizarPayloadAutomacao(item, profundidade + 1)]));
}

function jsonSeguro(valor: unknown): string | null {
  if (valor === undefined) return null;
  const json = JSON.stringify(sanitizarPayloadAutomacao(valor));
  return json.length <= 64_000 ? json : JSON.stringify({ truncado: true });
}

function erroUnicidade(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function publicarEventoBpm(input: unknown, client: ClientePublicacaoEventos = db) {
  const evento = eventoDominioInputSchema.parse(input);
  // Testes legados constroem transaction clients parciais. No runtime real o
  // delegate é obrigatório; somente no ambiente de teste a publicação vira no-op.
  if (!(client as unknown as { bpmEventoDominio?: { create?: unknown } }).bpmEventoDominio?.create) {
    if (process.env.NODE_ENV === "test") return null;
    throw new Error("Outbox de eventos BPM indisponível");
  }
  if (evento.atorTipo === "AUTOMACAO" && evento.profundidade >= 10) {
    throw new Error("Limite de encadeamento de automações atingido");
  }
  try {
    return await client.bpmEventoDominio.create({
      data: {
        tipo: evento.tipo,
        entidadeTipo: evento.entidadeTipo,
        entidadeId: evento.entidadeId,
        cardId: evento.cardId,
        pipelineId: evento.pipelineId,
        valorAnteriorJson: jsonSeguro(evento.valorAnterior),
        valorNovoJson: jsonSeguro(evento.valorNovo),
        atorTipo: evento.atorTipo,
        atorUserId: evento.atorUserId,
        atorExecucaoId: evento.atorExecucaoId,
        ocorridoEm: evento.ocorridoEm,
        correlationId: evento.correlationId,
        causationId: evento.causationId,
        profundidade: evento.profundidade,
        idempotencyKey: evento.idempotencyKey,
      },
    });
  } catch (error) {
    if (!erroUnicidade(error)) throw error;
    return client.bpmEventoDominio.findUnique({ where: { idempotencyKey: evento.idempotencyKey } });
  }
}

function parseJson(valor: string | null): Record<string, unknown> {
  if (!valor) return {};
  try {
    const parsed = JSON.parse(valor);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function correspondeAoGatilho(params: {
  gatilhoTipo: string;
  configJson: string;
  eventoTipo: string;
  eventoNovo: Record<string, unknown>;
  eventoAnterior: Record<string, unknown>;
  etapaAutomacaoId: string;
  etapaAtualCardId: string | null;
}): boolean {
  let config: ReturnType<typeof gatilhoConfigSchema.parse>;
  try { config = gatilhoConfigSchema.parse(parseJson(params.configJson)); } catch { return false; }
  const { gatilhoTipo, eventoTipo, eventoNovo, eventoAnterior, etapaAutomacaoId } = params;
  const etapasIds = new Set([...(config.etapasIds ?? []), ...(config.etapaId ? [config.etapaId] : []), ...(!config.etapaId && !config.etapasIds?.length && config.escopo !== "GLOBAL_PIPELINE" ? [etapaAutomacaoId] : [])]);
  const escopoCorresponde = (etapaId: unknown) => {
    if (config.escopo === "GLOBAL_PIPELINE") return true;
    const etapaResolvida = typeof etapaId === "string" ? etapaId : params.etapaAtualCardId ?? etapaAutomacaoId;
    return etapasIds.has(etapaResolvida);
  };
  if (gatilhoTipo === "ENTRAR_COLUNA") {
    return eventoTipo === "CARD_MOVIDO" && escopoCorresponde(eventoNovo.etapaId);
  }
  if (gatilhoTipo === "SAIR_COLUNA") {
    return eventoTipo === "CARD_MOVIDO" && escopoCorresponde(eventoAnterior.etapaId);
  }
  if (gatilhoTipo === "CAMPO_VALOR_ASSUMIDO") {
    return eventoTipo === "CAMPO_ALTERADO" && escopoCorresponde(params.etapaAtualCardId) && eventoNovo.campoId === config.campoId && Object.is(eventoNovo.valor, config.valor);
  }
  if (gatilhoTipo === "CAMPO_ALTERADO" && config.campoId) return eventoTipo === gatilhoTipo && escopoCorresponde(params.etapaAtualCardId) && eventoNovo.campoId === config.campoId;
  if ((gatilhoTipo === "TAREFA_CRIADA" || gatilhoTipo === "TAREFA_CONCLUIDA") && config.tipoTarefa) {
    return eventoTipo === gatilhoTipo && escopoCorresponde(params.etapaAtualCardId) && eventoNovo.tipo === config.tipoTarefa;
  }
  if (gatilhoTipo === "WEBHOOK_RECEBIDO" && config.webhookEndpointId) {
    return eventoTipo === gatilhoTipo && escopoCorresponde(params.etapaAtualCardId) && eventoNovo.endpointId === config.webhookEndpointId;
  }
  if (gatilhoTipo === "SLA_STATUS_ALTERADO" && config.slaStatus) {
    return eventoTipo === gatilhoTipo && escopoCorresponde(params.etapaAtualCardId) && eventoNovo.status === config.slaStatus;
  }
  return gatilhoTipo === eventoTipo && escopoCorresponde(eventoNovo.etapaId ?? params.etapaAtualCardId ?? etapaAutomacaoId);
}

export async function materializarExecucoesEventosBpm(limite = 100, client: ClienteEventos = db, filtro?: { cardId?: string }) {
  const versoes = await client.bpmAutomacaoVersao.findMany({
    where: { status: "ATIVA", automacao: { ativa: true } },
    select: { id: true, automacaoId: true, gatilhoTipo: true, gatilhoConfigJson: true, automacao: { select: { etapaId: true, pipelineId: true } } },
  });
  let criadas = 0;
  let avaliados = 0;
  for (const versao of versoes) {
    const tipoEvento = versao.gatilhoTipo === "ENTRAR_COLUNA" || versao.gatilhoTipo === "SAIR_COLUNA"
      ? "CARD_MOVIDO" : versao.gatilhoTipo === "CAMPO_VALOR_ASSUMIDO" ? "CAMPO_ALTERADO" : versao.gatilhoTipo;
    const eventos = await client.bpmEventoDominio.findMany({
      where: {
        tipo: tipoEvento, cardId: filtro?.cardId ?? { not: null }, pipelineId: versao.automacao.pipelineId,
        profundidade: { lt: 10 }, execucoes: { none: { automacaoVersaoId: versao.id } },
      },
      orderBy: { ocorridoEm: "asc" }, take: Math.min(Math.max(limite, 1), 500),
      select: { id: true, tipo: true, cardId: true, correlationId: true, causationId: true, profundidade: true, valorAnteriorJson: true, valorNovoJson: true, card: { select: { etapaId: true } } },
    });
    for (const evento of eventos) {
      if (!evento.cardId) continue;
      avaliados++;
      const repetidaNaCadeia = await client.bpmAutomacaoExecucao.findFirst({
        where: {
          automacaoVersaoId: versao.id,
          correlationId: evento.correlationId,
          status: { not: "IGNORADA" },
        },
        select: { id: true },
      });
      const corresponde = correspondeAoGatilho({
        gatilhoTipo: versao.gatilhoTipo, configJson: versao.gatilhoConfigJson, eventoTipo: evento.tipo,
        eventoNovo: parseJson(evento.valorNovoJson), eventoAnterior: parseJson(evento.valorAnteriorJson), etapaAutomacaoId: versao.automacao.etapaId,
        etapaAtualCardId: evento.card?.etapaId ?? null,
      });
      try {
        await client.bpmAutomacaoExecucao.create({ data: {
          automacaoId: versao.automacaoId, automacaoVersaoId: versao.id, eventoId: evento.id,
          cardId: evento.cardId, eventoChave: `central:${versao.id}:${evento.id}`, gatilhoTipo: versao.gatilhoTipo,
          correlationId: evento.correlationId, causationId: evento.causationId ?? evento.id,
          ...(corresponde && !repetidaNaCadeia ? {} : { status: "IGNORADA", resultadoJson: JSON.stringify({ motivo: repetidaNaCadeia ? "VERSAO_JA_EXECUTADA_NA_CADEIA" : "CONFIGURACAO_GATILHO_NAO_CORRESPONDE" }), executadoEm: new Date() }),
        } });
        if (corresponde && !repetidaNaCadeia) criadas += 1;
      } catch (error) { if (!erroUnicidade(error)) throw error; }
    }
  }
  return { versoes: versoes.length, eventos: avaliados, criadas };
}

export function tipoEventoValido(valor: string): valor is TipoEventoAutomacao {
  return (eventoDominioInputSchema.shape.tipo.options as readonly string[]).includes(valor);
}
