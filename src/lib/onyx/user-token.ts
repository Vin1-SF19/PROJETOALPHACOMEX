import "server-only";
import db from "@/lib/prisma";

/**
 * Busca o token (PAT) individual do usuário no Onyx a partir do id da sessão.
 *
 * SEGURANÇA: o token é SEMPRE resolvido pelo userId da sessão autenticada —
 * nunca aceito do corpo da requisição. Retorna null quando o usuário não tem
 * token cadastrado (cai no PAT de serviço, comportamento padrão).
 *
 * Use em TODA rota Onyx que faça operações em nome do usuário (chat, criar/
 * editar/excluir agente) para que ele apareça como ele mesmo no Onyx.
 */
export async function getUserOnyxToken(sessionUserId: string | number | undefined | null): Promise<string | null> {
  const id = Number(sessionUserId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const row = await db.usuarios.findUnique({
    where: { id },
    select: { token_onyx: true },
  });

  return row?.token_onyx?.trim() ? row.token_onyx.trim() : null;
}
