import "server-only";
import db from "@/lib/prisma";

/**
 * Busca o token (PAT) individual do usuário no Onyx a partir do id da sessão.
 * Quando o usuário não tem token próprio, faz fallback para o token de um admin
 * (necessário para operações que o PAT de serviço não suporta, como persona_id=0).
 */
export async function getUserOnyxToken(sessionUserId: string | number | undefined | null): Promise<string | null> {
  const id = Number(sessionUserId);
  if (!Number.isInteger(id) || id <= 0) return getAdminOnyxToken();

  const row = await db.usuarios.findUnique({
    where: { id },
    select: { token_onyx: true },
  });

  if (row?.token_onyx?.trim()) return row.token_onyx.trim();

  // Fallback: usa token de um admin quando o usuário não tem token cadastrado.
  // Necessário para o Onyx aceitar operações como persona_id=0 (Default AI).
  return getAdminOnyxToken();
}

/** Retorna o token_onyx de qualquer usuário Admin/CEO do banco. */
async function getAdminOnyxToken(): Promise<string | null> {
  const admin = await db.usuarios.findFirst({
    where: { role: { in: ["Admin", "CEO", "TI", "T.I"] }, token_onyx: { not: null } },
    select: { token_onyx: true },
    orderBy: { id: "asc" },
  });
  return admin?.token_onyx?.trim() ?? null;
}
