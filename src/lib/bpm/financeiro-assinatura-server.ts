import "server-only";

import type { Prisma } from "@prisma/client";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";
import { extrairPathnamePrivadoAnexoBpm } from "@/lib/bpm/anexos-storage";
import {
  PIPELINE_CHAVE,
  CHAVES_CAMPOS,
  VALORES,
  ACAO_HISTORICO_CONTRATO,
} from "@/lib/bpm/financeiro-config";

const CHAVES = [
  CHAVES_CAMPOS.STATUS_ASSINATURA,
  CHAVES_CAMPOS.STATUS_CONTRATO,
  CHAVES_CAMPOS.DATA_ASSINATURA,
  CHAVES_CAMPOS.ANEXO_ASSINADO,
  CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO,
];

/** Confirma uma única vez o evento de assinatura após persistir os campos do card. */
export async function registrarConclusaoContratoFinanceiro(
  tx: Prisma.TransactionClient,
  cardId: string,
  pipelineId: string,
  usuarioId: number | null,
) {
  const pipeline = await tx.bpmPipeline.findUnique({ where: { id: pipelineId }, select: { chave: true } });
  if (pipeline?.chave !== PIPELINE_CHAVE) return;
  const campos = await tx.bpmCampo.findMany({
    where: { pipelineId, chave: { in: CHAVES }, ativo: true }, select: { id: true, chave: true, opcoesJson: true },
  });
  const ids = new Map(campos.map((campo) => [campo.chave, campo.id]));
  const valores = await tx.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: campos.map((campo) => campo.id) } }, select: { campoId: true, valor: true },
  });
  const porId = new Map(valores.map((item) => [item.campoId, item.valor]));
  const valor = (chave: string) => porId.get(ids.get(chave) ?? "") ?? null;
  const anexoId = valor(CHAVES_CAMPOS.ANEXO_ASSINADO);
  const anexo = anexoId && ids.get(CHAVES_CAMPOS.ANEXO_ASSINADO)
    ? await tx.bpmCardAnexo.findFirst({
        where: { id: anexoId, cardId, campoId: ids.get(CHAVES_CAMPOS.ANEXO_ASSINADO) },
        select: { id: true, url: true },
      })
    : null;
  const avaliacao = avaliarFormalizacaoFinanceira({
    statusAssinatura: valor(CHAVES_CAMPOS.STATUS_ASSINATURA),
    dataAssinatura: valor(CHAVES_CAMPOS.DATA_ASSINATURA),
    anexoAssinadoId: anexoId,
    anexoAssinadoVinculado: Boolean(anexo?.url && extrairPathnamePrivadoAnexoBpm(anexo.url)),
    pagamentoConfirmado: valor(CHAVES_CAMPOS.PAGAMENTO_CONFIRMADO),
  });
  if (avaliacao.contrato !== VALORES.CONCLUIDO) return;
  const encerradas = await tx.bpmTarefa.updateMany({
    where: { cardId, tipo: "ASSINATURA_CONTRATO", status: "PENDENTE" },
    data: { status: "CONCLUIDA", concluidaEm: new Date() },
  });
  const jaRegistrado = await tx.bpmCardHistorico.findFirst({
    where: { cardId, acao: ACAO_HISTORICO_CONTRATO }, select: { id: true },
  });
  if (jaRegistrado) return;
  const statusContratoId = ids.get(CHAVES_CAMPOS.STATUS_CONTRATO);
  if (statusContratoId) {
    const statusContrato = campos.find((campo) => campo.id === statusContratoId);
    const opcoes = JSON.parse(statusContrato?.opcoesJson ?? "[]") as string[];
    const valorConclusao = opcoes.includes("CONTRATO CONCLUÍDO") ? "CONTRATO CONCLUÍDO" : VALORES.ASSINADO;
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: statusContratoId } },
      create: { cardId, campoId: statusContratoId, valor: valorConclusao },
      update: { valor: valorConclusao },
    });
  }
  await tx.bpmCardHistorico.create({ data: {
    cardId, acao: ACAO_HISTORICO_CONTRATO, usuarioId,
    valorNovoJson: JSON.stringify({
      status: "CONTRATO CONCLUÍDO",
      dataAssinatura: valor(CHAVES_CAMPOS.DATA_ASSINATURA),
      anexoId,
      pagamento: avaliacao.pagamento,
      tarefasEncerradas: encerradas.count,
    }),
  } });
}
