import "server-only";

import db from "@/lib/prisma";
import {
  deduplicarCamposObrigatorios,
  listarCamposObrigatoriosFaltantes,
  type CampoObrigatorioBpm,
} from "@/lib/bpm/requisitos-etapa";

type ClienteRequisitosEtapa = Pick<
  typeof db,
  "bpmCampo" | "bpmCampoObrigatorioEtapa" | "bpmCardCampoValor"
>;

export async function carregarCamposObrigatoriosEtapa(
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoObrigatorioBpm[]> {
  const [diretos, porEtapa] = await Promise.all([
    client.bpmCampo.findMany({
      where: { pipelineId, etapaId, obrigatorio: true },
      select: { id: true, nome: true },
    }),
    client.bpmCampoObrigatorioEtapa.findMany({
      where: { etapaId, campo: { pipelineId } },
      select: { campo: { select: { id: true, nome: true } } },
    }),
  ]);

  return deduplicarCamposObrigatorios([
    ...diretos,
    ...porEtapa.map((item) => item.campo),
  ]);
}

export async function carregarCamposFaltantesCardEtapa(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoObrigatorioBpm[]> {
  const campos = await carregarCamposObrigatoriosEtapa(pipelineId, etapaId, client);
  if (campos.length === 0) return [];

  const valores = await client.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: campos.map((campo) => campo.id) } },
    select: { campoId: true, valor: true },
  });
  return listarCamposObrigatoriosFaltantes(
    campos,
    Object.fromEntries(valores.map((valor) => [valor.campoId, valor.valor])),
  );
}

