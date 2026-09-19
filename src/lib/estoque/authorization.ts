import "server-only";

import { auth } from "../../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { canConfirmInventoryReturns, canManageInventory } from "@/lib/estoque/access";
export { INVENTORY_PERMISSION, LEGACY_INVENTORY_PERMISSION } from "@/lib/estoque/access";

export interface InventoryActor {
  userId: number;
  role: string;
  permissions: string[];
  isAdmin: boolean;
  canManage: boolean;
  canConfirmReturns: boolean;
}

export async function getInventoryActor(): Promise<InventoryActor | null> {
  const session = await auth();
  const userId = Number(session?.user?.id ?? 0);
  if (!session?.user || !Number.isSafeInteger(userId) || userId <= 0) return null;

  const user = await db.usuarios.findFirst({
    where: { id: userId, status: "ATIVO" },
    select: { role: true },
  });
  if (!user) return null;

  const permissions = await getPermissoesEfetivas(userId);

  return {
    userId,
    role: user.role,
    permissions,
    isAdmin: isAdminRole(user.role),
    canManage: canManageInventory(user.role),
    canConfirmReturns: canConfirmInventoryReturns(user.role),
  };
}

export async function requireInventoryManager(): Promise<InventoryActor> {
  const actor = await requireInventoryActor();
  if (!actor.canManage) throw new Error("A gestão do Estoque Alpha é restrita aos setores autorizados.");
  return actor;
}

export async function requireInventoryReturnApprover(): Promise<InventoryActor> {
  const actor = await requireInventoryActor();
  if (!actor.canConfirmReturns) throw new Error("Somente o setor de TI pode confirmar devoluções do estoque.");
  return actor;
}

export async function requireInventoryActor(): Promise<InventoryActor> {
  const actor = await getInventoryActor();
  if (!actor) throw new Error("Sem permissão para acessar o Estoque Alpha.");
  return actor;
}
