import "server-only";

import { auth } from "../../auth";
import db from "@/lib/prisma";
import { readEffectiveModulePermissions } from "@/lib/permissions/effective";
import { isAdminRole } from "@/lib/roles";

export class LegacyAccessError extends Error {}

/** A sessão identifica o ator; status, papel e permissões vêm do cadastro atual. */
export async function requireLegacyActor(modules: string[] = []) {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new LegacyAccessError("Sessão expirada. Faça login novamente.");
  const user = await db.usuarios.findUnique({
    where: { id }, select: { id: true, nome: true, role: true, email: true, status: true },
  });
  if (!user || user.status !== "ATIVO") throw new LegacyAccessError("Seu acesso não está ativo.");
  const isAdmin = isAdminRole(user.role);
  const permissions = isAdmin ? [] : await readEffectiveModulePermissions(id);
  if (modules.length && !isAdmin && !modules.some((module) => permissions.includes(module))) {
    throw new LegacyAccessError("Sem permissão para esta operação.");
  }
  return { ...user, isAdmin, permissions };
}

export function legacyActionError(error: unknown, fallback: string) {
  return error instanceof LegacyAccessError ? error.message : fallback;
}
