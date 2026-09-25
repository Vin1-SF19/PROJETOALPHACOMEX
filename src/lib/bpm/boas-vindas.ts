import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
/** Indicador visual para cards ainda não acessados na entrada do Operacional. */
export const NOME_ETAPA_BOAS_VINDAS = "Boas-vindas";

export function etapaEhBoasVindas(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_BOAS_VINDAS);
}
