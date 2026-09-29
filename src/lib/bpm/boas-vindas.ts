import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { normalizeRole } from "@/lib/roles";
/** Indicador visual para cards ainda não acessados na entrada do Operacional. */
export const NOME_ETAPA_BOAS_VINDAS = "Boas-vindas";
export const NOME_PIPELINE_OPERACIONAL = "Operacional";
export const PIPELINE_OPERACIONAL_ATIVO_ID = "cmuih4tnh000409gm5z34jvss";
export const DIRETOR_OPERACIONAL_VITOR_ID = 10;

export function etapaEhBoasVindas(nome: string): boolean {
  const normalizada = normalizarNomeEtapa(nome).replace(/[-\s]+/g, " ");
  return normalizada === normalizarNomeEtapa(NOME_ETAPA_BOAS_VINDAS).replace(/[-\s]+/g, " ");
}

export function pipelineEhOperacional(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_PIPELINE_OPERACIONAL);
}

export function usuarioPodeVincularPessoaBoasVindasOperacional(role?: string | null, userId?: number): boolean {
  return podeAgirBoasVindasOperacional(userId ?? -1, role);
}

export function vinculoPessoaBoasVindasOperacionalRestrito(pipelineNome: string, etapaNome: string): boolean {
  return pipelineEhOperacional(pipelineNome) && etapaEhBoasVindas(etapaNome);
}

/** Exceção individual aprovada para a direção operacional, sem ampliar a role OPERACIONAL. */
export function podeAgirBoasVindasOperacional(userId: number, role?: string | null): boolean {
  return normalizeRole(role) === "ADMIN" || userId === DIRETOR_OPERACIONAL_VITOR_ID;
}

export function pendenciasSaidaBoasVindasOperacional(dados: {
  responsavelId: number;
  responsavelRole: string | null;
  responsavelCargo: string | null;
  dataReuniao: Date | null;
  googleEventId: string | null;
  googleMeetLink: string | null;
}): string[] {
  const pendencias: string[] = [];
  if (dados.responsavelId === DIRETOR_OPERACIONAL_VITOR_ID
    || normalizeRole(dados.responsavelRole) !== "OPERACIONAL"
    || !/analista/i.test(dados.responsavelCargo ?? "")) pendencias.push("Analista responsável");
  if (!dados.dataReuniao || !dados.googleEventId || !dados.googleMeetLink) {
    pendencias.push("Primeira reunião Google Meet agendada");
  }
  return pendencias;
}
