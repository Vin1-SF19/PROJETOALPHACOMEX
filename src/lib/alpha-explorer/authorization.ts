import "server-only";

import {
  EXPLORER_CAPABILITIES,
  type ExplorerCapability,
  type ExplorerGrant,
  userPrivatePrefix,
} from "@/lib/alpha-explorer/capabilities";
import db from "@/lib/prisma";
import { readEffectiveModulePermissions } from "@/lib/permissions/effective";
import { isAdminRole } from "@/lib/roles";
import { z } from "zod";

export const EXPLORER_MODULE_PERMISSION = "exploradorArquivos";

export interface ExplorerUserAuthorization {
  userId: number;
  active: boolean;
  moduleAllowed: boolean;
  admin: boolean;
  grants: ExplorerGrant[];
}

const USER_CAPABILITIES = EXPLORER_CAPABILITIES.filter(
  (capability): capability is Exclude<ExplorerCapability, "manage_permissions"> => capability !== "manage_permissions",
);

const storedCapabilitiesSchema = z.array(z.enum(EXPLORER_CAPABILITIES)).min(1).max(EXPLORER_CAPABILITIES.length);

export async function resolveExplorerAuthorization(userId: number): Promise<ExplorerUserAuthorization> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return { userId, active: false, moduleAllowed: false, admin: false, grants: [] };
  }

  const user = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true, cargo: true, status: true } });
  if (!user || user.status !== "ATIVO") {
    return { userId, active: false, moduleAllowed: false, admin: false, grants: [] };
  }

  const admin = isAdminRole(user.role);
  const permissions: string[] = await readEffectiveModulePermissions(userId).catch((): string[] => []);
  const moduleAllowed = admin || permissions.includes(EXPLORER_MODULE_PERMISSION);
  if (!moduleAllowed) return { userId, active: true, moduleAllowed: false, admin, grants: [] };

  if (admin) {
    return {
      userId,
      active: true,
      moduleAllowed: true,
      admin: true,
      grants: [{ prefix: "", capabilities: EXPLORER_CAPABILITIES, source: "admin", sourceId: user.role }],
    };
  }

  const storedRules = await db.alphaExplorerAcl.findMany({
    where: {
      OR: [
        { subjectType: "USER", subjectId: String(userId) },
        { subjectType: "ROLE", subjectId: user.role },
        ...(user.cargo ? [{ subjectType: "CARGO", subjectId: user.cargo }] : []),
      ],
    },
    select: { id: true, subjectType: true, prefix: true, capabilitiesJson: true },
  });
  const grants: ExplorerGrant[] = [{
    prefix: userPrivatePrefix(userId),
    capabilities: USER_CAPABILITIES,
    source: "ownership",
    sourceId: String(userId),
  }];
  for (const rule of storedRules) {
    let stored: unknown;
    try {
      stored = JSON.parse(rule.capabilitiesJson);
    } catch {
      continue;
    }
    const parsed = storedCapabilitiesSchema.safeParse(stored);
    if (!parsed.success) continue;
    grants.push({
      prefix: rule.prefix,
      capabilities: parsed.data,
      source: rule.subjectType === "USER" ? "user" : "group",
      sourceId: rule.id,
    });
  }

  return { userId, active: true, moduleAllowed, admin, grants };
}
