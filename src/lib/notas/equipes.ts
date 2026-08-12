import type { RolePermissaoNota } from "@/lib/validations/notas";

export const ORDEM_PAPEIS_NOTA: Record<RolePermissaoNota, number> = {
  LEITOR: 1,
  COMENTARISTA: 2,
  EDITOR: 3,
  ADMIN: 4,
};

export function normalizarChaveNomeEquipe(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function maiorPapelNota(
  papeis: readonly (RolePermissaoNota | null | undefined)[],
): RolePermissaoNota | null {
  return papeis.reduce<RolePermissaoNota | null>((maior, papel) => {
    if (!papel) return maior;
    if (!maior || ORDEM_PAPEIS_NOTA[papel] > ORDEM_PAPEIS_NOTA[maior]) return papel;
    return maior;
  }, null);
}
