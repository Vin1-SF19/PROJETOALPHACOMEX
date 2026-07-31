"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { registrarAuditoriaCalendarioAlpha } from "@/lib/google-calendar/auditoria";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import {
  atualizarEventoParcial as atualizarEventoParcialGoogleApi,
  cancelarEvento as cancelarEventoGoogleApi,
  criarEvento as criarEventoGoogleApi,
  listarCalendarios,
  obterEvento as obterEventoGoogleApi,
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

const detalhesEventoColegaSchema = z
  .object({
    calendarId: z.string().trim().min(1).max(300),
    googleEventId: z.string().trim().min(1).max(1024),
  })
  .strict();

export type CarregarDetalhesEventoColegaInput = z.input<typeof detalhesEventoColegaSchema>;
const colegaIdSchema = z.number().int().positive();

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

function paraInputEventoParcialGoogle(
  dados: AtualizarEventoParcialInput | AtualizarEventoInput,
  timezonePadrao: string,
  preservarParticipantesQuandoListaVazia = false,
) {
  return {
    titulo: dados.titulo,
    descricaoGoogle: dados.descricaoGoogle,
    localizacao: dados.localizacao,
    timezone: dados.inicio !== undefined ? (dados.timezone ?? timezonePadrao) : undefined,
    diaInteiro: dados.diaInteiro,
    inicio: dados.inicio,
    fim: dados.fim,
    participantes:
      preservarParticipantesQuandoListaVazia && dados.participantes?.length === 0
        ? undefined
        : dados.participantes,
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
  const colegaIdValidado = colegaIdSchema.safeParse(colegaId);
  if (!colegaIdValidado.success) {
    return { ok: false, error: "Colaborador inválido." };
  }

  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { ok: false, error: "Não autorizado." };

  const usuarioAtual = await db.usuarios.findUnique({ where: { id: acesso.userId }, select: { role: true } });
  if (!isAdminRole(usuarioAtual?.role)) {
    return { ok: false, error: "Só Admin/CEO pode alterar a agenda de outro colaborador." };
  }

  const colega = await db.usuarios.findUnique({
    where: { id: colegaIdValidado.data },
    select: {
      email: true,
      status: true,
      googleCalendarConexao: { select: { status: true } },
    },
  });
  if (
    !colega ||
    colega.status !== "ATIVO" ||
    colega.googleCalendarConexao?.status !== "ATIVA"
  ) {
    return { ok: false, error: "Agenda do colaborador não está ativa." };
  }

  return {
    ok: true,
    adminUserId: acesso.userId,
    colegaUserId: colegaIdValidado.data,
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

/** Carrega do Google o evento completo de um colega antes da edição Admin/CEO. */
export async function carregarDetalhesEventoColegaParaEdicao(
  colegaId: number,
  input: CarregarDetalhesEventoColegaInput,
): Promise<ResultadoAcao<GoogleEventoDTO>> {
  const alvo = await resolverAlvoAdmin(colegaId);
  if (!alvo.ok) return { success: false, error: alvo.error };

  const validacao = detalhesEventoColegaSchema.safeParse(input);
  if (!validacao.success) {
    return { success: false, error: primeiroErroZod(validacao.error) };
  }
  const dados = validacao.data;

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };

    const evento = await obterEventoGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
    });
    return { success: true, data: evento };
  } catch (erro) {
    if (
      erro instanceof GoogleCalendarError &&
      (erro.kind === "not_found" || erro.kind === "gone")
    ) {
      return { success: false, error: "Evento não encontrado na agenda do colaborador." };
    }
    return {
      success: false,
      error: "Não foi possível carregar os detalhes do evento do colaborador agora.",
    };
  }
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
  if (!dados.etagConhecido) {
    return {
      success: false,
      error: "Abra novamente o evento para carregar a versão atual antes de salvar.",
    };
  }

  try {
    const calendario = await resolverCalendarioGravavelDoColega(
      alvo.colegaEmail,
      dados.calendarId,
    );
    if (!calendario.ok) return { success: false, error: calendario.error };
    await atualizarEventoParcialGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: dados.etagConhecido,
      evento: paraInputEventoParcialGoogle(dados, calendario.timezone, true),
    });

    await registrarAuditoriaCalendarioAlpha(
      alvo.adminUserId,
      "CALENDARIO_ALPHA_ADMIN_EDITOU_EVENTO_COLEGA",
      `colegaId=${colegaId} googleEventId=${dados.googleEventId}`,
    );

    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { conflito: false } };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.status === 412) {
      return { success: true, data: { conflito: true } };
    }
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
    const etagParaPatch = dados.etagConhecido ?? eventoCache?.etag;
    if (!etagParaPatch) {
      return {
        success: false,
        error: "Abra novamente o evento para carregar a versão atual antes de salvar.",
      };
    }

    const eventoAtualizado = await atualizarEventoParcialGoogleApi({
      emailUsuario: alvo.colegaEmail,
      calendarId: calendario.calendarId,
      googleEventId: dados.googleEventId,
      etagConhecido: etagParaPatch,
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
