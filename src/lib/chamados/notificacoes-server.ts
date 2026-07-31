import { pusherServer } from "@/lib/pusher-server.ts";
import {
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  type ChamadoConcluidoPayload,
  type NovoChamadoPayload,
} from "@/lib/chamados/notificacoes";

export async function notificarNovoChamado(payload: NovoChamadoPayload): Promise<boolean> {
  try {
    await pusherServer.trigger(CHAMADOS_ADMIN_CHANNEL, NOVO_CHAMADO_EVENT, payload);
    return true;
  } catch (error) {
    console.error("[Pusher] Falha ao notificar novo chamado:", error);
    return false;
  }
}

export async function notificarChamadoConcluido(
  usuarioId: number,
  payload: ChamadoConcluidoPayload,
): Promise<boolean> {
  try {
    await pusherServer.trigger(
      canalChamadosDoUsuario(usuarioId),
      CHAMADO_CONCLUIDO_EVENT,
      payload,
    );
    return true;
  } catch (error) {
    console.error("[Pusher] Falha ao notificar conclusão do chamado:", error);
    return false;
  }
}
