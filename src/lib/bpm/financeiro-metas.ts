import "server-only";

import db from "@/lib/prisma";
import { avaliarFormalizacaoFinanceira } from "@/lib/bpm/financeiro-formalizacao";

const CHAVES = [
  "alpha.financeiro.status.contrato.assinatura",
  "alpha.data.da.assinatura",
  "alpha.contrato.assinado.anexo",
  "alpha.pagamento.confirmado",
];

/** Só expõe documento com vínculo explícito e assinatura comprovada no card financeiro. */
export async function buscarAnexosAssinadosFinanceiroPorContrato(contratoIds: string[]) {
  const resultado = new Map<string, string>();
  const ambiguos = new Set<string>();
  if (!contratoIds.length) return resultado;
  const contextos = await db.bpmCardServicoContexto.findMany({
    where: { contratoComercialId: { in: contratoIds }, card: { pipeline: { chave: "financeiro" } } },
    select: {
      contratoComercialId: true,
      card: {
        select: {
          campoValores: {
            where: { campo: { chave: { in: CHAVES } } },
            select: { valor: true, campo: { select: { id: true, chave: true } } },
          },
          anexos: {
            where: { campo: { chave: "alpha.contrato.assinado.anexo" } },
            select: { id: true, campoId: true },
          },
        },
      },
    },
  });
  for (const contexto of contextos) {
    if (!contexto.contratoComercialId) continue;
    const valores = new Map(contexto.card.campoValores.map((item) => [item.campo.chave, item.valor]));
    const campoAnexo = contexto.card.campoValores.find((item) => item.campo.chave === "alpha.contrato.assinado.anexo");
    const anexoId = campoAnexo?.valor?.trim() ?? null;
    const avaliacao = avaliarFormalizacaoFinanceira({
      statusAssinatura: valores.get("alpha.financeiro.status.contrato.assinatura"),
      dataAssinatura: valores.get("alpha.data.da.assinatura"),
      anexoAssinadoId: anexoId,
      anexoAssinadoVinculado: Boolean(anexoId && contexto.card.anexos.some((item) => item.id === anexoId && item.campoId === campoAnexo?.campo.id)),
      pagamentoConfirmado: valores.get("alpha.pagamento.confirmado"),
    });
    if (avaliacao.contrato !== "Concluído" || !anexoId) continue;
    if (ambiguos.has(contexto.contratoComercialId)) continue;
    const anterior = resultado.get(contexto.contratoComercialId);
    // Mais de um documento assinado para o mesmo contrato requer conciliação,
    // não uma escolha silenciosa por ordem de consulta.
    if (anterior && anterior !== anexoId) {
      resultado.delete(contexto.contratoComercialId);
      ambiguos.add(contexto.contratoComercialId);
    }
    else if (!anterior) resultado.set(contexto.contratoComercialId, anexoId);
  }
  return resultado;
}
