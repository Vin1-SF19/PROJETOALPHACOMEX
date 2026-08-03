export const Roles = {
  ADMIN: "Admin",
  TI: "TI",
  USER: "User",
} as const;

/**
 * Normaliza roles/setores usados pelo Painel Alpha.
 *
 * A role de usuário também representa o setor no POP. Remover pontuação e
 * acentos mantém compatibilidade entre a role nova `TI` e documentos legados
 * cadastrados como `T.I`, sem alterar o valor persistido ou o rótulo exibido.
 */
export function normalizeRole(role?: string | null): string {
  return (role ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

export const ADMIN_ACCESS_ROLES = ["Admin", "CEO", "TI"] as const;

/** Admin, CEO e TI possuem o mesmo bypass administrativo global. */
export function isAdminRole(role?: string | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "CEO" || normalized === "TI";
}

/** Compara roles/setores tolerando caixa, acentos, espaços e pontuação. */
export function isSameRole(left?: string | null, right?: string | null): boolean {
  const leftNormalized = normalizeRole(left);
  return leftNormalized.length > 0 && leftNormalized === normalizeRole(right);
}
