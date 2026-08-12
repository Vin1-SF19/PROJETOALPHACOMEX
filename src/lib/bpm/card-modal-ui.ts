export type EstadoFollowUpModal = "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO";

export function followUpBloqueiaFechamento(
  etapaNome: string | null | undefined,
  estado: EstadoFollowUpModal,
  podeEditar: boolean,
): boolean {
  if (!podeEditar || etapaNome?.trim().toLocaleLowerCase("pt-BR") !== "em tratativa") return false;
  return estado === "CARREGANDO" || estado === "ERRO" || estado === "EM_ANDAMENTO";
}
