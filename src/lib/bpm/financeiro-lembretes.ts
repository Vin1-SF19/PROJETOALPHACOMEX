import "server-only";

import db from "@/lib/prisma";
import { intervaloDiaCivilSaoPaulo } from "@/lib/bpm/novos-leads";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";

const CHAVES = [
  "alpha.financeiro.status.contrato.assinatura",
  "alpha.data.da.assinatura",
  "alpha.contrato.assinado.anexo",
  "alpha.pagamento.confirmado",
  "alpha.financeiro.prazo.assinatura",
];

/** Lembrete diário para cards com prazo individual e assinatura ainda pendente. */
export async function processarLembretesAssinaturaFinanceiro(agora = new Date()) {
  const pipeline = await db.bpmPipeline.findUnique({ where: { chave: "financeiro" }, select: { id: true } });
  if (!pipeline) return { examinados: 0, criados: 0 };
  const campos = await db.bpmCampo.findMany({
    where: { pipelineId: pipeline.id, chave: { in: CHAVES }, ativo: true }, select: { id: true, chave: true },
  });
  const campoPrazo = campos.find((campo) => campo.chave === "alpha.financeiro.prazo.assinatura");
  if (!campoPrazo) return { examinados: 0, criados: 0 };
  const porChave = new Map(campos.map((campo) => [campo.chave, campo.id]));
  const cards = await db.bpmCard.findMany({
    where: { pipelineId: pipeline.id, status: "ATIVO", campoValores: { some: { campoId: campoPrazo.id, valor: { not: null } } } },
    select: {
      id: true, responsavelId: true,
      campoValores: { where: { campoId: { in: campos.map((campo) => campo.id) } }, select: { campoId: true, valor: true } },
      anexos: { where: { campoId: porChave.get("alpha.contrato.assinado.anexo") ?? "" }, select: { id: true, campoId: true } },
    },
  });
  const { inicio, fim } = intervaloDiaCivilSaoPaulo(agora);
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  let criados = 0;
  for (const card of cards) {
    const valores = new Map(card.campoValores.map((item) => [item.campoId, item.valor]));
    const valor = (chave: string) => valores.get(porChave.get(chave) ?? "") ?? null;
    const prazo = valor("alpha.financeiro.prazo.assinatura");
    const dataPrazo = prazo ? new Date(prazo) : null;
    if (!dataPrazo || Number.isNaN(dataPrazo.getTime())) continue;
    const anexoId = valor("alpha.contrato.assinado.anexo");
    const avaliacao = avaliarFormalizacaoFinanceira({
      statusAssinatura: valor("alpha.financeiro.status.contrato.assinatura"),
      dataAssinatura: valor("alpha.data.da.assinatura"),
      anexoAssinadoId: anexoId,
      anexoAssinadoVinculado: Boolean(anexoId && card.anexos.some((item) => item.id === anexoId)),
      pagamentoConfirmado: valor("alpha.pagamento.confirmado"),
    });
    if (avaliacao.contrato === "Concluído") continue;
    const jaCriadoHoje = await db.bpmTarefa.findFirst({
      where: { cardId: card.id, tipo: "ASSINATURA_CONTRATO", createdAt: { gte: inicio, lt: fim } },
      select: { id: true },
    });
    if (jaCriadoHoje) continue;
    const chaveEvento = `financeiro:assinatura:lembrete:${card.id}:${dia}`;
    try {
      await db.$transaction(async (tx) => {
        await tx.bpmEventoDominio.create({ data: {
          tipo: "LEMBRETE_ASSINATURA", entidadeTipo: "CARD", entidadeId: card.id,
          cardId: card.id, pipelineId: pipeline.id, atorTipo: "SISTEMA",
          correlationId: chaveEvento, idempotencyKey: chaveEvento,
        } });
        const tarefa = await tx.bpmTarefa.create({ data: {
          cardId: card.id, responsavelId: card.responsavelId,
          titulo: "Acompanhar assinatura do contrato",
          descricao: `Prazo configurado para assinatura: ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(dataPrazo)}.`,
          tipo: "ASSINATURA_CONTRATO", prioridade: dataPrazo <= agora ? "ALTA" : "NORMAL",
          prazo: dataPrazo,
        } });
        await tx.bpmEventoDominio.create({ data: {
          tipo: "TAREFA_CRIADA", entidadeTipo: "TAREFA", entidadeId: tarefa.id,
          cardId: card.id, pipelineId: pipeline.id, atorTipo: "SISTEMA",
          valorNovoJson: JSON.stringify({ tarefaId: tarefa.id, tipo: tarefa.tipo }),
          correlationId: chaveEvento, causationId: chaveEvento,
          idempotencyKey: `${chaveEvento}:tarefa`,
        } });
      });
      criados++;
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
    }
  }
  return { examinados: cards.length, criados };
}
