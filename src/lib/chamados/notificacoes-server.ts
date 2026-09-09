import { pusherServer } from "@/lib/pusher-server.ts";
import {
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  type ChamadoConcluidoPayload,
  type NovoChamadoPayload,
} from "@/lib/chamados/notificacoes";
import {
  CALENDARIO_ALPHA_CHAMADO_ATUALIZADO_EVENT,
  canalCalendarioAlphaDoUsuario,
  type CalendarioAlphaChamadoAtualizadoPayload,
} from "@/lib/google-calendar/notificacoes";

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

/** Atualiza, sem toast, as Agendas Alpha abertas do solicitante e do técnico. */
export async function notificarAgendaChamadoAtualizada(
  usuarioIds: number[],
  payload: CalendarioAlphaChamadoAtualizadoPayload,
): Promise<boolean> {
  const canais = [...new Set(usuarioIds)]
    .filter((userId) => Number.isSafeInteger(userId) && userId > 0)
    .map(canalCalendarioAlphaDoUsuario);
  if (canais.length === 0) return false;

  try {
    await pusherServer.trigger(
      canais,
      CALENDARIO_ALPHA_CHAMADO_ATUALIZADO_EVENT,
      payload,
    );
    return true;
  } catch (error) {
    console.error("[Pusher] Falha ao atualizar a Agenda Alpha do chamado:", error);
    return false;
  }
}
