import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { parametrosEncaminhamentoSchema } from "./schemas";
import { validarGrafoAutomacao } from "./central-schemas";

export function ehFechamentoComercialLivre(pipeline: { chave?: string | null; nome: string }, etapa: { chave?: string | null; nome: string }): boolean {
  return (pipeline.chave === "comercial" || pipeline.nome === "Revisão de Radar") && etapaEhFechado(etapa.nome, etapa.chave);
}

/** Somente o fluxo inteiro de encaminhamento, sem ações adicionais. */
export function parametrosFinanceiroMovimentoLivre(valor: unknown) {
  try {
    const grafo = validarGrafoAutomacao(valor);
    if (grafo.nos.length !== 2) return null;
    const inicio = grafo.nos.find(no => no.id === grafo.inicioId);
    if (inicio?.tipo !== "ACAO" || inicio.acaoTipo !== "CRIAR_CARD_OUTRO_PIPELINE"
      || !grafo.nos.some(no => no.id === inicio.proximoId && no.tipo === "FIM")
      || inicio.parametros.vincularAoOriginal !== true || inicio.parametros.somenteSeNaoExistirAtivo !== true) return null;
    return parametrosEncaminhamentoSchema.parse(inicio.parametros);
  } catch { return null; }
}
