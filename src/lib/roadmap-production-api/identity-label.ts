import "server-only";

import db from "@/lib/prisma";
import type { RoadmapApiIdentity } from "./auth";

export async function resolveAuthorLabel(identity: RoadmapApiIdentity): Promise<string> {
  const user = await db.usuarios.findUnique({
    where: { id: identity.userId },
    select: { nome: true },
  });
  const base = user?.nome?.trim() || `Usuário #${identity.userId}`;
  return identity.credentialId ? `${base} (via API)` : base;
}
