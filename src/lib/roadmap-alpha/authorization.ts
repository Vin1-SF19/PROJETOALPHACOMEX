import { auth } from "../../../auth";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export interface RoadmapAccess {
  userId: number;
  role: string;
  canMutate: boolean;
  canAccessProduction: boolean;
}

export async function requireRoadmapAccess(requireMutation = false): Promise<RoadmapAccess> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session?.user?.id || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user || user.status !== "ATIVO") throw new Error("FORBIDDEN");

  const canMutate = isAdminRole(user.role);
  let hasProductionPermission = canMutate;
  if (!canMutate) {
    const permissions = await getPermissoesEfetivas(userId);
    if (!permissions.includes("roadmap")) throw new Error("FORBIDDEN");
    hasProductionPermission = permissions.includes("roadmapProduction");
  }
  if (requireMutation && !canMutate) throw new Error("FORBIDDEN");

  return { userId, role: user.role, canMutate, canAccessProduction: hasProductionPermission };
}

export async function requireRoadmapProductionAccess(requireAdmin = false): Promise<RoadmapAccess> {
  const access = await requireRoadmapAccess();
  if (!access.canAccessProduction || (requireAdmin && !access.canMutate)) {
    throw new Error("FORBIDDEN");
  }
  return access;
}
