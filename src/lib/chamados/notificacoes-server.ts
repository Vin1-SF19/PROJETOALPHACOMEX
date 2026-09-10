import { pusherServer } from "@/lib/pusher-server.ts";
import {
  CHAMADO_ASSUMIDO_EVENT,
  CHAMADO_CONCLUIDO_EVENT,
  CHAMADO_MENSAGEM_EVENT,
  CHAMADOS_ADMIN_CHANNEL,
  NOVO_CHAMADO_EVENT,
  canalChamadosDoUsuario,
  type ChamadoAssumidoPayload,
  type ChamadoConcluidoPayload,
  type ChamadoMensagemPayload,
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

export async function notificarChamadoAssumido(
  usuarioId: number,
  payload: ChamadoAssumidoPayload,
): Promise<boolean> {
  try {
    await pusherServer.trigger(
      canalChamadosDoUsuario(usuarioId),
      CHAMADO_ASSUMIDO_EVENT,
      payload,
    );
    return true;
  } catch (error) {
    console.error("[Pusher] Falha ao notificar atendimento do chamado:", error);
    return false;
  }
}

export async function notificarMensagemChamado(
  destino: { usuarioIds?: number[]; administradores?: boolean },
  payload: ChamadoMensagemPayload,
): Promise<boolean> {
  const canaisUsuarios = [...new Set(destino.usuarioIds ?? [])]
    .filter((usuarioId) => Number.isSafeInteger(usuarioId) && usuarioId > 0)
    .map(canalChamadosDoUsuario);
  const canais = destino.administradores
    ? [...canaisUsuarios, CHAMADOS_ADMIN_CHANNEL]
    : canaisUsuarios;
  if (canais.length === 0) return false;

  try {
    await pusherServer.trigger(
      canais.length === 1 ? canais[0] : canais,
      CHAMADO_MENSAGEM_EVENT,
      payload,
    );
    return true;
  } catch (error) {
    console.error("[Pusher] Falha ao notificar mensagem do chamado:", error);
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
