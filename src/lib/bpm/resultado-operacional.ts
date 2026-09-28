import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";

/** Resultado do processo, independente do estado comercial do contrato. */
export function processoOperacionalDeferido(
  etapaNome: string | null | undefined,
  encaminhamentos: readonly { pipeline: string | null; etapa: string | null }[] | null | undefined,
): boolean {
  return etapaEhFechado(etapaNome) && Boolean(encaminhamentos?.some(
    (destino) => destino.pipeline === "Operacional" && destino.etapa === "Processo deferido",
  ));
}
