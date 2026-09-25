import "server-only";

import type { Prisma } from "@prisma/client";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";

const CHAVES = [
  "alpha.financeiro.status.contrato.assinatura",
  "alpha.status.do.contrato",
  "alpha.data.da.assinatura",
  "alpha.contrato.assinado.anexo",
  "alpha.pagamento.confirmado",
];

/** Confirma uma única vez o evento de assinatura após persistir os campos do card. */
export async function registrarConclusaoContratoFinanceiro(
  tx: Prisma.TransactionClient,
  cardId: string,
  pipelineId: string,
  usuarioId: number | null,
) {
  const pipeline = await tx.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { chave: true } });
  if (pipeline?.chave !== "financeiro") return;
  const campos = await tx.bpmCampo.findMany({
    where: { pipelineId, chave: { in: CHAVES }, ativo: true }, select: { id: true, chave: true },
  });
  const ids = new Map(campos.map((campo) => [campo.chave, campo.id]));
  const valores = await tx.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: campos.map((campo) => campo.id) } }, select: { campoId: true, valor: true },
  });
  const porId = new Map(valores.map((item) => [item.campoId, item.valor]));
  const valor = (chave: string) => porId.get(ids.get(chave) ?? "") ?? null;
  const anexoId = valor("alpha.contrato.assinado.anexo");
  const anexo = anexoId && ids.get("alpha.contrato.assinado.anexo")
    ? await tx.bpmCardAnexo.findFirst({
        where: { id: anexoId, cardId, campoId: ids.get("alpha.contrato.assinado.anexo") },
        select: { id: true },
      })
    : null;
  const avaliacao = avaliarFormalizacaoFinanceira({
    statusAssinatura: valor("alpha.financeiro.status.contrato.assinatura"),
    dataAssinatura: valor("alpha.data.da.assinatura"),
    anexoAssinadoId: anexoId,
    anexoAssinadoVinculado: Boolean(anexo),
    pagamentoConfirmado: valor("alpha.pagamento.confirmado"),
  });
  if (avaliacao.contrato !== "Concluído") return;
  const jaRegistrado = await tx.bpmCardHistorico.findFirst({
    where: { cardId, acao: "CONTRATO_CONCLUIDO" }, select: { id: true },
  });
  if (jaRegistrado) return;
  const statusContratoId = ids.get("alpha.status.do.contrato");
  if (statusContratoId) {
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: statusContratoId } },
      create: { cardId, campoId: statusContratoId, valor: "Assinado" },
      update: { valor: "Assinado" },
    });
  }
  await tx.bpmCardHistorico.create({ data: {
    cardId, acao: "CONTRATO_CONCLUIDO", usuarioId,
    valorNovoJson: JSON.stringify({
      status: "CONTRATO CONCLUÍDO",
      dataAssinatura: valor("alpha.data.da.assinatura"),
      anexoId,
      pagamento: avaliacao.pagamento,
    }),
  } });
}
