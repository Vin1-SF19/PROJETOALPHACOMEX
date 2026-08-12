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

export type CampoAplicavelEtapaBpm = {
  id: string;
  pipelineId: string;
  etapaId: string | null;
  nome: string;
  tipo: string;
  opcoesJson: string | null;
  obrigatorio: boolean;
  ordem: number;
  valor: string | null;
};

export async function carregarCamposAplicaveisEtapa(
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<Array<Omit<CampoAplicavelEtapaBpm, "valor">>> {
  const selectCampo = {
    id: true,
    pipelineId: true,
    etapaId: true,
    nome: true,
    tipo: true,
    opcoesJson: true,
    obrigatorio: true,
    ordem: true,
  } as const;

  const [diretos, associados] = await Promise.all([
    client.bpmCampo.findMany({
      where: { pipelineId, etapaId },
      select: selectCampo,
    }),
    client.bpmCampoObrigatorioEtapa.findMany({
      where: { etapaId, campo: { pipelineId } },
      select: { campo: { select: selectCampo } },
    }),
  ]);

  const porId = new Map<
    string,
    Omit<CampoAplicavelEtapaBpm, "valor">
  >();
  for (const campo of diretos) {
    porId.set(campo.id, campo);
  }
  for (const item of associados) {
    porId.set(item.campo.id, { ...item.campo, obrigatorio: true });
  }

  const campos = [...porId.values()].sort(
    (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome),
  );
  return campos;
}

export async function carregarCamposAplicaveisCardEtapa(
  cardId: string,
  pipelineId: string,
  etapaId: string,
  client: ClienteRequisitosEtapa = db,
): Promise<CampoAplicavelEtapaBpm[]> {
  const campos = await carregarCamposAplicaveisEtapa(pipelineId, etapaId, client);
  if (campos.length === 0) return [];

  const valores = await client.bpmCardCampoValor.findMany({
    where: { cardId, campoId: { in: campos.map((campo) => campo.id) } },
    select: { campoId: true, valor: true },
  });
  const valorPorCampo = new Map(
    valores.map((valor) => [valor.campoId, valor.valor]),
  );

  return campos.map((campo) => ({
    ...campo,
    valor: valorPorCampo.get(campo.id) ?? null,
  }));
}

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
