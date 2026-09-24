import "server-only";

import type { Prisma } from "@prisma/client";

import db from "@/lib/prisma";
import { gatilhoConfigSchema, validarGrafoAutomacao } from "./central-schemas";

type ClienteExecucoes = Pick<Prisma.TransactionClient, "bpmAutomacaoExecucao">;

/**
 * Execuções geradas por eventos que não correspondem ao gatilho (outra etapa,
 * outro campo...). São necessárias para a idempotência do materializador, mas
 * não representam atividade da automação e poluem contadores e históricos.
 */
export const MOTIVO_GATILHO_NAO_CORRESPONDE = "CONFIGURACAO_GATILHO_NAO_CORRESPONDE";

export const filtroExecucoesRelevantes: Prisma.BpmAutomacaoExecucaoWhereInput = {
  OR: [
    { status: { not: "IGNORADA" } },
    { status: "IGNORADA", NOT: { resultadoJson: { contains: MOTIVO_GATILHO_NAO_CORRESPONDE } } },
  ],
};

/**
 * Encerra sem efeito as execuções ainda não concluídas de uma automação
 * (pendentes, em espera ou aguardando retentativa). Usado ao pausar, arquivar
 * ou publicar nova versão — evita execuções presas em AGUARDANDO e falhas
 * artificiais por "automação inativa".
 */
export async function encerrarExecucoesEmAndamentoAutomacao(
  client: ClienteExecucoes,
  params: { automacaoId: string; manterVersaoId?: string; motivo: string },
) {
  return client.bpmAutomacaoExecucao.updateMany({
    where: {
      automacaoId: params.automacaoId,
      automacaoVersaoId: params.manterVersaoId ? { not: params.manterVersaoId } : { not: null },
      status: { in: ["PENDENTE", "AGUARDANDO"] },
    },
    data: {
      status: "IGNORADA",
      resultadoJson: JSON.stringify({ motivo: params.motivo }),
      executadoEm: new Date(),
      claimToken: null,
    },
  });
}

/** Confere se etapas, campos, usuários e SLAs usados pela versão existem e pertencem ao pipeline. */
export async function validarReferenciasPublicacaoAutomacao(
  automacao: { pipelineId: string; etapaId: string },
  gatilhoTipo: string,
  gatilhoConfigJson: string,
  grafoJson: string,
) {
  const gatilho = gatilhoConfigSchema.parse(JSON.parse(gatilhoConfigJson));
  const grafo = validarGrafoAutomacao(JSON.parse(grafoJson));
  const etapasIds = [...new Set([
    ...(gatilho.etapasIds ?? []),
    ...(gatilho.etapaId ? [gatilho.etapaId] : []),
    ...(gatilho.escopo === "GLOBAL_PIPELINE" ? [] : [automacao.etapaId]),
  ])];
  if (gatilho.escopo !== "GLOBAL_PIPELINE" && etapasIds.length === 0) throw new Error("Selecione ao menos uma etapa para o gatilho");
  if (etapasIds.length > 0 && await db.bpmEtapa.count({ where: { id: { in: etapasIds }, pipelineId: automacao.pipelineId, ativo: true } }) !== etapasIds.length) throw new Error("O gatilho usa uma etapa inválida");
  if (gatilho.campoId && !await db.bpmCampo.findFirst({ where: { id: gatilho.campoId, pipelineId: automacao.pipelineId }, select: { id: true } })) throw new Error("O gatilho usa um campo inválido");
  if (gatilhoTipo === "WEBHOOK_RECEBIDO" && (!gatilho.webhookEndpointId || !await db.bpmWebhookEndpoint.findFirst({ where: { id: gatilho.webhookEndpointId, ativo: true, OR: [{ pipelineId: null }, { pipelineId: automacao.pipelineId }] }, select: { id: true } }))) throw new Error("Selecione um webhook ativo e compatível");
  for (const no of grafo.nos) {
    if (no.tipo !== "ACAO") continue;
    const p = no.parametros;
    if (no.acaoTipo === "ALTERAR_CAMPO" && !await db.bpmCampo.findFirst({ where: { id: String(p.campoId), pipelineId: automacao.pipelineId }, select: { id: true } })) throw new Error(`O nó ${no.id} usa um campo que não pertence ao pipeline`);
    if (no.acaoTipo === "ATUALIZAR_CARD_RELACIONADO" && p.campoId && !await db.bpmCampo.findUnique({ where: { id: String(p.campoId) }, select: { id: true } })) throw new Error(`O nó ${no.id} usa um campo inválido`);
    if (no.acaoTipo === "MOVER_CARD" && !await db.bpmEtapa.findFirst({ where: { id: String(p.etapaId), pipelineId: automacao.pipelineId, ativo: true }, select: { id: true } })) throw new Error(`O nó ${no.id} usa uma etapa inválida`);
    if (no.acaoTipo === "ALTERAR_SUBSTATUS" && !await db.bpmSubStatus.findFirst({ where: { id: String(p.subStatusId), ativo: true }, select: { id: true } })) throw new Error(`O nó ${no.id} usa um substatus inválido`);
    if ((no.acaoTipo === "ATRIBUIR_RESPONSAVEL" || no.acaoTipo === "CRIAR_TAREFA") && p.responsavelId && !await db.usuarios.findFirst({ where: { id: Number(p.responsavelId), status: "ATIVO" }, select: { id: true } })) throw new Error(`O nó ${no.id} usa um responsável inválido`);
    if (no.acaoTipo === "CRIAR_CARD_OUTRO_PIPELINE" && !await db.bpmEtapa.findFirst({ where: { id: String(p.etapaId), pipelineId: String(p.pipelineId), ativo: true }, select: { id: true } })) throw new Error(`O nó ${no.id} usa pipeline/etapa inválidos`);
    if (no.acaoTipo === "CRIAR_SLA" && !await db.bpmSlaConfig.findFirst({ where: { id: String(p.slaConfigId), ativa: true, OR: [{ pipelineId: null }, { pipelineId: automacao.pipelineId }] }, select: { id: true } })) throw new Error(`O nó ${no.id} usa um SLA inválido`);
  }
}
