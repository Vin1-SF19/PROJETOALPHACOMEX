import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { normalizeRole } from "@/lib/roles";
/** Indicador visual para cards ainda não acessados na entrada do Operacional. */
export const NOME_ETAPA_BOAS_VINDAS = "Boas-vindas";
export const NOME_PIPELINE_OPERACIONAL = "Operacional";

export function etapaEhBoasVindas(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_BOAS_VINDAS);
}

export function pipelineEhOperacional(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_PIPELINE_OPERACIONAL);
}

export function usuarioPodeVincularPessoaBoasVindasOperacional(role?: string | null): boolean {
  const normalizada = normalizeRole(role);
  return normalizada === "ADMIN" || normalizada === "DIRETOR";
}

export function vinculoPessoaBoasVindasOperacionalRestrito(pipelineNome: string, etapaNome: string): boolean {
  return pipelineEhOperacional(pipelineNome) && etapaEhBoasVindas(etapaNome);
}
