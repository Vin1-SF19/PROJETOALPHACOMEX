import "server-only";

import type { Prisma } from "@prisma/client";

import { carregarValoresCanonicosCampos } from "@/lib/bpm/campos-configuraveis-server";

/** Copia somente valores disponíveis na origem para os campos publicados no destino. */
export async function copiarCamposCardVinculado(
  tx: Prisma.TransactionClient,
  origemId: string,
  destinoId: string,
  pipelineDestinoId: string,
  etapaDestinoId: string,
): Promise<number> {
  const camposDestino = await tx.bpmCampo.findMany({
    where: {
      ativo: true,
      escopo: "CARD",
      OR: [
        { pipelineId: pipelineDestinoId },
        { pipelinesAssociados: { some: { pipelineId: pipelineDestinoId } } },
      ],
      etapaConfiguracoes: { some: { etapaId: etapaDestinoId, visivel: true } },
      componentesFormulario: { some: { secao: { formulario: { etapaId: etapaDestinoId, ativo: true } } } },
    },
    select: {
      id: true,
      mapeamentoDestino: { select: { campoOrigemId: true, modo: true, ativo: true } },
    },
  });
  if (!camposDestino.length) return 0;

  const origens = [...new Set(camposDestino.map((campo) =>
    campo.mapeamentoDestino?.ativo && campo.mapeamentoDestino.modo === "COPIAR"
      ? campo.mapeamentoDestino.campoOrigemId
      : campo.id,
  ))];
  const [valores, camposOrigem] = await Promise.all([
    tx.bpmCardCampoValor.findMany({
      where: { cardId: origemId, campoId: { in: origens } },
      select: { campoId: true, valor: true },
    }),
    tx.bpmCampo.findMany({
      where: { id: { in: origens }, ativo: true },
      select: { id: true, escopo: true, fonteEntidade: true, fonteAtributo: true, entidadeGlobal: true },
    }),
  ]);
  const canonicos = await carregarValoresCanonicosCampos(origemId, camposOrigem, tx);
  const valoresOrigem = new Map(valores.map((item) => [item.campoId, item.valor]));
  let copiados = 0;
  for (const campo of camposDestino) {
    const origemCampoId = campo.mapeamentoDestino?.ativo && campo.mapeamentoDestino.modo === "COPIAR"
      ? campo.mapeamentoDestino.campoOrigemId
      : campo.id;
    const valor = valoresOrigem.get(origemCampoId)?.trim() || canonicos[origemCampoId]?.trim();
    if (!valor) continue;
    await tx.bpmCardCampoValor.upsert({
      where: { cardId_campoId: { cardId: destinoId, campoId: campo.id } },
      create: { cardId: destinoId, campoId: campo.id, valor },
      update: {},
    });
    copiados += 1;
  }
  return copiados;
}
