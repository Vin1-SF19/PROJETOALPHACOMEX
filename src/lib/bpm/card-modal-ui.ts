export type EstadoFollowUpModal = "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO";

export function followUpBloqueiaFechamento(
  etapaNome: string | null | undefined,
  estado: EstadoFollowUpModal,
): boolean {
  if (etapaNome?.trim().toLocaleLowerCase("pt-BR") !== "em tratativa") return false;
  return estado === "CARREGANDO" || estado === "ERRO" || estado === "EM_ANDAMENTO";
}

export type CampoRequisitoUi = { id: string; contexto: "ORIGEM" | "DESTINO" | "AMBOS" };

export function separarCamposRequisitos<T extends CampoRequisitoUi>(campos: T[], idsEtapaAtual: Set<string>) {
  const origem: T[] = [];
  const editaveisDestino: T[] = [];
  for (const campo of campos) {
    if (campo.contexto === "ORIGEM" || idsEtapaAtual.has(campo.id)) origem.push(campo);
    else editaveisDestino.push(campo);
  }
  return { origem, editaveisDestino };
}

export function montarPayloadCamposDestino<T extends { id: string }>(campos: T[], valores: Record<string, string>) {
  return Object.fromEntries(campos.map((campo) => [campo.id, valores[campo.id] ?? ""]));
}
