import { isAdminRole, normalizeRole } from "@/lib/roles";

export const INVENTORY_PERMISSION = "estoque";
export const LEGACY_INVENTORY_PERMISSION = "ServiçosGerais";

const INVENTORY_MANAGEMENT_ROLES = new Set([
  "ADMIN",
  "TI",
  "CEO",
  "FINANCEIRO",
  "RECURSOSHUMANOS",
]);

/** Qualquer colaborador ativo pode consultar somente o que está em sua posse. */
export function canViewPersonalInventory(): boolean {
  return true;
}

/** Gestão ampla é deliberadamente restrita aos setores autorizados pelo negócio. */
export function canManageInventory(role: string | null | undefined): boolean {
  return INVENTORY_MANAGEMENT_ROLES.has(normalizeRole(role));
}

/** A confirmação física de devolução pertence exclusivamente ao TI. */
export function canConfirmInventoryReturns(role: string | null | undefined): boolean {
  return normalizeRole(role) === "TI";
}

export function hasInventoryPermission(
  role: string | null | undefined,
  permissions: readonly string[],
): boolean {
  return (
    isAdminRole(role) ||
    permissions.includes(INVENTORY_PERMISSION) ||
    permissions.includes(LEGACY_INVENTORY_PERMISSION)
  );
}
