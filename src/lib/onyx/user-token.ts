import "server-only";
import db from "@/lib/prisma";

/**
 * Busca o token (PAT) individual do usuário no Onyx a partir do id da sessão.
 * Nunca usa credencial de outro usuário ou PAT administrativo como fallback.
 */
export async function getUserOnyxToken(sessionUserId: string | number | undefined | null): Promise<string | null> {
  const id = Number(sessionUserId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const row = await db.usuarios.findUnique({
    where: { id },
    select: { token_onyx: true },
  });

  if (row?.token_onyx?.trim()) return row.token_onyx.trim();

  return null;
}
