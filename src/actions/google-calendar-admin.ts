"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoriaCalendarioAlpha } from "@/lib/google-calendar/auditoria";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import {
  atualizarEvento as atualizarEventoGoogleApi,
  cancelarEvento as cancelarEventoGoogleApi,
  criarEvento as criarEventoGoogleApi,
} from "@/lib/google-calendar/client";
import { isAdminRole } from "@/lib/google-calendar/colegas";
import {
  atualizarEventoSchema,
  cancelarEventoSchema,
  criarEventoSchema,
  type AtualizarEventoInput,
  type CancelarEventoInput,
  type CriarEventoInput,
} from "@/lib/validations/google-calendar";
import db from "@/lib/prisma";

type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };

function primeiroErroZod(erro: { issues: { message: string }[] }): string {
  return erro.issues[0]?.message ?? "Dados inválidos.";
}

function paraInputEventoGoogle(dados: CriarEventoInput | AtualizarEventoInput) {
  return {
    titulo: dados.titulo,
    descricaoGoogle: dados.descricaoGoogle,
    localizacao: dados.localizacao,
    timezone: dados.timezone,
    diaInteiro: dados.diaInteiro,
    inicio: dados.inicio,
    fim: dados.fim,
    participantes: dados.participantes,
    criarMeet: dados.criarMeet,
  };
}

/**
 * Verifica que o chamador é Admin/CEO E tem o Calendário Alpha habilitado, e resolve o e-mail
 * (Workspace) do colega-alvo — sempre a partir do banco por `colegaId`, nunca aceito do cliente.
 * Só Admin/CEO chega até aqui (decisão confirmada com o usuário: acesso de escrita na agenda
 * de qualquer colaborador é exclusivo de Admin/CEO).
 */
async function resolverAlvoAdmin(colegaId: number): Promise<
  { ok: true; adminUserId: number; colegaEmail: string } | { ok: false; error: string }
> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { ok: false, error: "Não autorizado." };

  const usuarioAtual = await db.usuarios.findUnique({ where: { id: acesso.userId }, select: { role: true } });
  if (!isAdminRole(usuarioAtual?.role)) {
    return { ok: false, error: "Só Admin/CEO pode alterar a agenda de outro colaborador." };
  }

  const colega = await db.usuarios.findUnique({ where: { id: colegaId }, select: { email: true, status: true } });
  if (!colega || colega.status !== "ATIVO") return { ok: false, error: "Colaborador não encontrado." };

  return { ok: true, adminUserId: acesso.userId, colegaEmail: colega.email };
}

export async function criarEventoParaColega(
  colegaId: number,
  input: CriarEventoInput,
): Promise<ResultadoAcao<{ googleEventId: string }>> {
  const alvo = await resolverAlvoAdmin(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = criarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    const eventoCriado = await criarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: dados.calendarId,
      evento: paraInputEventoGoogle(dados),
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.adminUserId,
      "CALENDARIO_ALPHA_ADMIN_CRIOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${eventoCriado.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { googleEventId: eventoCriado.googleEventId } };
  } catch {
    return { success: false, error: "Não foi possível criar o evento na agenda do colaborador." };
  }
}

export async function atualizarEventoParaColega(
  colegaId: number,
  input: AtualizarEventoInput,
): Promise<ResultadoAcao<{ conflito: boolean }>> {
  const alvo = await resolverAlvoAdmin(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = atualizarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    await atualizarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
      evento: paraInputEventoGoogle(dados),
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.adminUserId,
      "CALENDARIO_ALPHA_ADMIN_EDITOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { conflito: false } };
  } catch {
    return { success: false, error: "Não foi possível atualizar o evento na agenda do colaborador." };
  }
}

export async function cancelarEventoParaColega(
  colegaId: number,
  input: CancelarEventoInput,
): Promise<ResultadoAcao<{ ok: true }>> {
  const alvo = await resolverAlvoAdmin(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = cancelarEventoSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    await cancelarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: dados.calendarId,
      googleEventId: dados.googleEventId,
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.adminUserId,
      "CALENDARIO_ALPHA_ADMIN_CANCELOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { ok: true } };
  } catch {
    return { success: false, error: "Não foi possível cancelar o evento na agenda do colaborador." };
  }
}
