import { validarGrafoAutomacao } from "./central-schemas";

export type EscopoMinutaMovimentoLivre = { modo: "MINUTA_MOVIMENTO_LIVRE"; cardId: string; eventoId: string };
export type FiltroAutomacoesCentrais = { cardId?: string; modo?: never } | EscopoMinutaMovimentoLivre;

/** A exceção autoriza o fluxo inteiro, nunca um nó extraído de outro fluxo. */
export function grafoEhMinutaConfigurada(valor: unknown): boolean {
  try {
    const grafo = validarGrafoAutomacao(valor);
    if (grafo.nos.length !== 2) return false;
    const inicio = grafo.nos.find((no) => no.id === grafo.inicioId);
    return inicio?.tipo === "ACAO" && inicio.acaoTipo === "GERAR_CONTRATO"
      && grafo.nos.some((no) => no.id === inicio.proximoId && no.tipo === "FIM");
  } catch { return false; }
}

export function objetoEventoMinuta(valor: string | null): Record<string, unknown> {
  try {
    const objeto: unknown = JSON.parse(valor ?? "null");
    return objeto && typeof objeto === "object" && !Array.isArray(objeto)
      ? Object.fromEntries(Object.entries(objeto)) : {};
  } catch { return {}; }
}
