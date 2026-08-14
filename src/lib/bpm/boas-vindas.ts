import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { normalizeRole } from "@/lib/roles";

/**
 * Regra operacional do pipeline Operacional: cards em Boas-vindas ficam
 * restritos à diretoria até deixarem a etapa.
 *
 * Hoje a base não possui uma role "DIRETOR". A única conta de diretoria é a
 * role global `Admin`; CEO e TI não recebem esta exceção automaticamente.
 */
export const NOME_ETAPA_BOAS_VINDAS = "Boas-vindas";
export const ACESSO_BOAS_VINDAS_NEGADO_MENSAGEM =
  "Apenas a diretoria pode acessar cards em Boas-vindas.";

export function etapaEhBoasVindas(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_BOAS_VINDAS);
}

export function usuarioEhDiretoriaBpm(role: string | null | undefined): boolean {
  return normalizeRole(role) === "ADMIN";
}
