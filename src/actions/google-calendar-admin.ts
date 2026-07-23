"use server";

import { revalidatePath } from "next/cache";

import { registrarAuditoriaCalendarioAlpha } from "@/lib/google-calendar/auditoria";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import {
  atualizarEvento as atualizarEventoGoogleApi,
  atualizarEventoParcial as atualizarEventoParcialGoogleApi,
  cancelarEvento as cancelarEventoGoogleApi,
  criarEvento as criarEventoGoogleApi,
  listarCalendarios,
} from "@/lib/google-calendar/client";
import { dadosCacheDeEvento } from "@/lib/google-calendar/cache-eventos";
import { isAdminRole } from "@/lib/google-calendar/colegas";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";
import type { GoogleEventoDTO } from "@/lib/google-calendar/types";
import {
  atualizarEventoSchema,
  atualizarEventoParcialSchema,
  cancelarEventoSchema,
  criarEventoSchema,
  type AtualizarEventoInput,
  type AtualizarEventoParcialInput,
  type CancelarEventoInput,
  type CriarEventoInput,
} from "@/lib/validations/google-calendar";
import db from "@/lib/prisma";

type ResultadoAcao<T> = { success: true; data: T } | { success: false; error: string };
type ResultadoAtualizacaoParcial = {
  conflito: boolean;
  evento: GoogleEventoDTO | null;
  etag?: string;
};

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

function paraInputEventoParcialGoogle(dados: AtualizarEventoParcialInput, timezonePadrao: string) {
  return {
    titulo: dados.titulo,
    descricaoGoogle: dados.descricaoGoogle,
    localizacao: dados.localizacao,
    timezone: dados.inicio !== undefined ? (dados.timezone ?? timezonePadrao) : undefined,
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
  { ok: true; adminUserId: number; colegaUserId: number; colegaEmail: string } | { ok: false; error: string }
> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { ok: false, error: "Não autorizado." };

  const usuarioAtual = await db.usuarios.findUnique({ where: { id: acesso.userId }, select: { role: true } });
  if (!isAdminRole(usuarioAtual?.role)) {
    return { ok: false, error: "Só Admin/CEO pode alterar a agenda de outro colaborador." };
  }

  const colega = await db.usuarios.findUnique({ where: { id: colegaId }, select: { email: true, status: true } });
  if (!colega || colega.status !== "ATIVO") return { ok: false, error: "Colaborador não encontrado." };

  return {
    ok: true,
    adminUserId: acesso.userId,
    colegaUserId: colegaId,
    colegaEmail: colega.email,
  };
}

async function resolverCalendarioGravavelDoColega(
  colegaEmail: string,
  calendarId: string,
): Promise<
  | { ok: true; calendarId: string; timezone: string }
  | { ok: false; error: string }
> {
  const calendariosGoogle = await listarCalendarios(colegaEmail);
  const calendario = calendariosGoogle.find(
    (item) => item.googleCalendarId === calendarId,
  );
  if (!calendario) {
    return { ok: false, error: "Calendário não encontrado na conta do colaborador." };
  }
  if (calendario.papelAcesso !== "owner" && calendario.papelAcesso !== "writer") {
    return {
      ok: false,
      error: "Este calendário do colaborador está disponível só para leitura.",
    };
  }
  return {
    ok: true,
    calendarId: calendario.googleCalendarId,
    timezone: calendario.timezone || "America/Sao_Paulo",
  };
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
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    const eventoCriado = await criarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
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
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    await atualizarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
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

/**
 * Variante parcial para o IAlpha. O calendário é sempre revalidado contra a conta Workspace do
 * colega resolvida pelo servidor; um `calendarId` arbitrário do chamador não autoriza impersonation.
 */
export async function atualizarEventoParcialParaColega(
  colegaId: number,
  input: AtualizarEventoParcialInput,
): Promise<ResultadoAcao<ResultadoAtualizacaoParcial>> {
  const alvo = await resolverAlvoAdmin(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = atualizarEventoParcialSchema.safeParse(input);
  if (!validacao.success) return { success: false, error: primeiroErroZod(validacao.error) };
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };

    const calendarioCache = await db.googleCalendarSelecionado.findFirst({
      where: {
        conexao: { userId: alvo.colegaUserId },
        googleCalendarId: dados.calendarId,
      },
    });
    const eventoCache = calendarioCache
      ? await db.googleCalendarEventoCache.findUnique({
          where: {
            calendarioId_googleEventId: {
              calendarioId: calendarioCache.id,
              googleEventId: dados.googleEventId,
            },
          },
        })
      : null;

    if (dados.etagConhecido && eventoCache && eventoCache.etag !== dados.etagConhecido) {
      return { success: true, data: { conflito: true, evento: null } };
    }

    const eventoAtualizado = await atualizarEventoParcialGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: dados.etagConhecido,
      evento: paraInputEventoParcialGoogle(
        dados,
        calendario.timezone,
      ),
    });

    if (calendarioCache) {
      const dadosCache = dadosCacheDeEvento(eventoAtualizado);
      await db.googleCalendarEventoCache.upsert({
        where: {
          calendarioId_googleEventId: {
            calendarioId: calendarioCache.id,
            googleEventId: dados.googleEventId,
          },
        },
        create: {
          calendarioId: calendarioCache.id,
          googleEventId: eventoAtualizado.googleEventId,
          ...dadosCache,
        },
        update: dadosCache,
      });
    }

    await registrarAuditoriaCalendarioAlpha(
      alvo.adminUserId,
      "CALENDARIO_ALPHA_ADMIN_EDITOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return {
      success: true,
      data: {
        conflito: false,
        evento: eventoAtualizado,
        etag: eventoAtualizado.etag,
      },
    };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return { success: true, data: { conflito: true, evento: null } };
    }
    return {
      success: false,
      error: "Não foi possível atualizar o evento na agenda do colaborador.",
    };
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
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    await cancelarEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: dados.etagConhecido,
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.adminUserId,
      "CALENDARIO_ALPHA_ADMIN_CANCELOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { ok: true } };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return {
        success: false,
        error:
          "O evento mudou desde a última leitura. Consulte a agenda do colaborador novamente antes de cancelar.",
      };
    }
    return { success: false, error: "Não foi possível cancelar o evento na agenda do colaborador." };
  }
}
