import "server-only";

import type { Prisma } from "@prisma/client";

import { calcularNovoContratoFinanceiro, FINANCIAL_FIELD_KEYS } from "@/lib/bpm/pipeline-financeiro";
import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";

/** Recalcula os campos derivados da primeira etapa após salvar entradas manuais. */
export async function atualizarCalculoNovoContrato(
  tx: Prisma.TransactionClient,
  cardId: string,
  pipelineId: string,
): Promise<void> {
  const campos = await tx.bpmCampo.findMany({
    where: {
      ativo: true,
      chave: { in: [...new Set(Object.values(FINANCIAL_FIELD_KEYS))] },
      OR: [
        { pipelineId },
        { pipelinesAssociados: { some: { pipelineId } } },
      ],
    },
    select: { id: true, chave: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true, opcoesJson: true, opcoes: { where: { ativo: true }, select: { rotulo: true } } },
  });
  const porChave = new Map(campos.flatMap((campo) => campo.chave ? [[campo.chave, campo] as const] : []));
  const [valores, canonicos] = await Promise.all([
    tx.bpmCardCampoValor.findMany({
      where: { cardId, campoId: { in: campos.map((campo) => campo.id) } },
      select: { campoId: true, valor: true },
    }),
    carregarValoresCanonicosCampos(cardId, campos, tx),
  ]);
  const chavePorId = new Map(campos.map((campo) => [campo.id, campo.chave]));
  const valoresPorChave = Object.fromEntries(Object.entries(canonicos).flatMap(([id, valor]) => {
    const chave = chavePorId.get(id);
    return chave ? [[chave, valor] as const] : [];
  }));
  for (const item of valores) {
    const chave = chavePorId.get(item.campoId);
    if (chave && item.valor?.trim()) valoresPorChave[chave] = item.valor;
  }
  const calculo = calcularNovoContratoFinanceiro(valoresPorChave);
  const k = FINANCIAL_FIELD_KEYS;
  const derivadas = [k.VALOR_IRRF, k.VALOR_CSRF, k.TOTAL_RETENCOES, k.VALOR_LIQUIDO, k.MEMORIA_CALCULO];
  for (const chave of derivadas) {
    const campo = porChave.get(chave);
    if (!campo) continue;
    const valor = calculo.automaticValues[chave] ?? null;
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: campo.id } },
      create: { cardId, campoId: campo.id, valor },
      update: { valor },
    });
  }
  const status = porChave.get(k.STATUS_FINANCEIRO);
  if (!status) return;
  const opcoes = status.opcoes.map((item) => item.rotulo);
  if (!opcoes.length && status.opcoesJson) {
    try {
      const parsed: unknown = JSON.parse(status.opcoesJson);
      if (Array.isArray(parsed)) opcoes.push(...parsed.filter((item): item is string => typeof item === "string"));
    } catch { /* configuração inválida não autoriza alterar o status */ }
  }
  if (!opcoes.includes("Aguardando pagamento")) return;
  const atual = valoresPorChave[k.STATUS_FINANCEIRO];
  const proximo = calculo.automaticValues[k.STATUS_FINANCEIRO];
  if (proximo && (!atual || atual === proximo)) {
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId, campoId: status.id } },
      create: { cardId, campoId: status.id, valor: proximo },
      update: { valor: proximo },
    });
  } else if (!proximo && atual === "Aguardando pagamento") {
    await tx.bpmCardCampoValor.update({
      where: { cardId_campoId: { cardId, campoId: status.id } },
      data: { valor: null },
    });
  }
}
