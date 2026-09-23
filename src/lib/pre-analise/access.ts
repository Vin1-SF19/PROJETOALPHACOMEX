import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { isAdminRole } from "@/lib/roles";
import { readEffectiveModulePermissions } from "@/lib/permissions/effective";
import { consumeAuthRateLimit } from "@/lib/auth/rate-limit";

type Scope = "cadastro" | "tributario";

export async function canAccessPreAnalise(session: { user?: { id?: string | number | null; role?: string | null } } | null | undefined, scope: Scope): Promise<boolean> {
  if (!session?.user?.id || roleBlocked(session.user.role)) return false;
  if (scope === "cadastro") return true;
  if (isAdminRole(session.user.role)) return true;
  const userId = Number(session.user.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;
  const permissions = await readEffectiveModulePermissions(userId).catch(() => [] as string[]);
  return permissions.some((permission) => ["analise", "radar", "Perse"].includes(permission));
}

function roleBlocked(role?: string | null): boolean {
  return role?.toUpperCase() === "TV";
}

export async function requirePreAnaliseAccess(scope: Scope): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.id || (session as { acessoBloqueado?: boolean }).acessoBloqueado) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!await canAccessPreAnalise(session, scope)) {
    return NextResponse.json({ error: "Sem permissão para consulta" }, { status: 403 });
  }
  try {
    const limit = await consumeAuthRateLimit(`pre_analise_${scope}`, String(session.user.id));
    if (!limit.allowed) {
      return NextResponse.json({ error: "Limite de consultas atingido" }, {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      });
    }
  } catch {
    return NextResponse.json({ error: "Consulta temporariamente indisponível" }, { status: 503 });
  }
  return null;
}
