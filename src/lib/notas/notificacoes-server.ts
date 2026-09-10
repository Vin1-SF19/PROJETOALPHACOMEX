import "server-only";

import { pusherServer } from "@/lib/pusher-server.ts";
import {
  canalNotasDoUsuario,
  type NotaNotificacaoEvento,
  type NotaNotificacaoPayload,
} from "@/lib/notas/notificacoes";

/** Publica uma notificação privada de nota sem desfazer a operação de origem se o realtime falhar. */
export async function notificarUsuarioNota(
  userId: number,
  evento: NotaNotificacaoEvento,
  payload: NotaNotificacaoPayload,
): Promise<boolean> {
  if (!Number.isSafeInteger(userId) || userId <= 0) return false;

  try {
    await pusherServer.trigger(canalNotasDoUsuario(userId), evento, payload);
    return true;
  } catch (error) {
    console.error("Falha ao enviar notificação de nota:", error);
    return false;
  }
}
