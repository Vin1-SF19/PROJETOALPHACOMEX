import "server-only";
import { cache } from "react";

import { MODULOS_REGISTRY } from "@/lib/modulos-registry";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export const KNOWN_MODULE_PERMISSIONS = new Set([
  ...MODULOS_REGISTRY.map((module) => module.permission).filter((permission): permission is string => Boolean(permission)),
  "roadmapProduction",
]);

/** Leitura server-only; durante uma renderização, layout e página compartilham o resultado. */
export const readEffectiveModulePermissions = cache(async (userId: number): Promise<string[]> => {
  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { role: true, permissoes: true },
  });
  if (!user) return [];
  if (isAdminRole(user.role)) return Array.from(KNOWN_MODULE_PERMISSIONS);

  const sectorPermissions = await db.setorPermissao.findMany({
    where: { setor: user.role },
    select: { modulo: true },
  });
  const effective = sectorPermissions.length > 0
    ? new Set(sectorPermissions.map((permission) => permission.modulo))
    : new Set((user.permissoes ?? "").split(",").filter(Boolean));

  const overrides = await db.usuarioPermissaoOverride.findMany({
    where: { usuarioId: userId },
    select: { modulo: true, acao: true },
  });
  for (const override of overrides) {
    if (override.acao === "ADD") effective.add(override.modulo);
    else if (override.acao === "REMOVE") effective.delete(override.modulo);
  }
  return Array.from(effective);
});
