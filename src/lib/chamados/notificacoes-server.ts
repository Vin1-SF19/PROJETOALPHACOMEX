import db from "@/lib/prisma";
import { isSameRole } from "@/lib/roles";
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

/** Resolve destinatários pelo cadastro ativo, nunca pelo rótulo enviado no evento. */
async function usuariosDoDestino(setorDestinoId?: number | null): Promise<number[]> {
  const setores = await db.setor.findMany({
    where: { ativo: true, isBase: false }, select: { id: true, nome: true },
  });
  const candidatos = setorDestinoId == null
    ? setores.filter((setor) => isSameRole(setor.nome, "TI"))
    : setores.filter((setor) => setor.id === setorDestinoId);
  if (candidatos.length !== 1) return [];
  const usuarios = await db.usuarios.findMany({
    where: { status: "ATIVO" }, select: { id: true, role: true },
  });
  return usuarios.filter((usuario) => isSameRole(usuario.role, candidatos[0].nome)).map((usuario) => usuario.id);
}

async function emitir(canais: string[], evento: string, payload: object): Promise<void> {
  const unicos = [...new Set(canais)];
  for (let inicio = 0; inicio < unicos.length; inicio += 100) {
    const lote = unicos.slice(inicio, inicio + 100);
    await pusherServer.trigger(lote.length === 1 ? lote[0] : lote, evento, payload);
  }
}

export async function notificarNovoChamado(payload: NovoChamadoPayload): Promise<boolean> {
  try {
    const usuarios = await usuariosDoDestino(payload.setorDestinoId);
    const canais = usuarios.filter((id) => id !== payload.usuarioId).map(canalChamadosDoUsuario);
    await emitir([CHAMADOS_ADMIN_CHANNEL, ...canais], NOVO_CHAMADO_EVENT, payload);
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
  destino: { usuarioIds?: number[]; administradores?: boolean; setorDestinoId?: number | null; setorDestinoNome?: string | null; excluirUsuarioIds?: number[] },
  payload: ChamadoMensagemPayload,
): Promise<boolean> {
  try {
    const fila = "setorDestinoId" in destino ? await usuariosDoDestino(destino.setorDestinoId) : [];
    const excluidos = new Set(destino.excluirUsuarioIds ?? []);
    const canaisUsuarios = [...new Set([...(destino.usuarioIds ?? []), ...fila])]
      .filter((id) => Number.isSafeInteger(id) && id > 0 && !excluidos.has(id))
      .map(canalChamadosDoUsuario);
    const canais = destino.administradores ? [...canaisUsuarios, CHAMADOS_ADMIN_CHANNEL] : canaisUsuarios;
    if (canais.length === 0) return false;
    await emitir(canais, CHAMADO_MENSAGEM_EVENT, payload);
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
