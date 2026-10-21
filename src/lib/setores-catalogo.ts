import { isSameRole } from "@/lib/roles";

/** Identidade já usada em usuarios.role, Setor e SetorPermissao. */
export const SETOR_LIDER_COMERCIAL = "Lider Comercial";

/** Rótulos legados de cursos preservados para não desvincular conteúdo existente. */
export const SETORES_ALPHA_SKILLS: readonly string[] = [
  "T.I", "Comercial", SETOR_LIDER_COMERCIAL, "Operacional", "Financeiro", "Recursos-Humanos", "Serviços Gerais",
];

/** Corrige apenas este setor; não renomeia outros papéis ou concede permissões. */
export function canonicalizarSetorLiderComercial(setor: string): string {
  return isSameRole(setor, SETOR_LIDER_COMERCIAL) ? SETOR_LIDER_COMERCIAL : setor;
}
