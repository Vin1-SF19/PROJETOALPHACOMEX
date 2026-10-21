import { isSameRole } from "@/lib/roles";

/** Identidade já usada em usuarios.role, Setor e SetorPermissao. */
export const SETOR_LIDER_COMERCIAL = "Lider Comercial";
export const SETOR_LIDER_OPERACIONAL = "Lider Operacional";

/** Rótulos legados de cursos preservados para não desvincular conteúdo existente. */
export const SETORES_ALPHA_SKILLS: readonly string[] = [
  "T.I", "Comercial", SETOR_LIDER_COMERCIAL, "Operacional", SETOR_LIDER_OPERACIONAL, "Financeiro", "Recursos-Humanos", "Serviços Gerais",
];

/** Preserva a identidade das lideranças; não concede permissões nem renomeia outros papéis. */
export function canonicalizarSetorLideranca(setor: string): string {
  if (isSameRole(setor, SETOR_LIDER_COMERCIAL)) return SETOR_LIDER_COMERCIAL;
  if (isSameRole(setor, SETOR_LIDER_OPERACIONAL)) return SETOR_LIDER_OPERACIONAL;
  return setor;
}
