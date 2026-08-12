"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { z } from "zod";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "./Cards";
import {
  criarEventoNoCalendario,
} from "@/actions/google-calendar-eventos";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import {
  atualizarEventoParcial as atualizarEventoParcialGoogle,
  cancelarEvento as cancelarEventoGoogle,
  obterEvento as obterEventoGoogle,
} from "@/lib/google-calendar/client";
import {
  obterUsuarioGoogleAtivo,
  obterUsuarioGoogleAtivoPorCalendario,
} from "@/lib/google-calendar/usuario-google";
import { dadosCacheDeEvento } from "@/lib/google-calendar/cache-eventos";
import { GoogleCalendarError } from "@/lib/google-calendar/errors";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const DURACAO_PADRAO_MINUTOS = 60; // decisão confirmada com o usuário (plano-novos-leads-bpm.md, Bloco 2)

async function confirmarLinkMeetCriado(params: {
  userId: number;
  calendarioId: string;
  googleCalendarId: string;
  googleEventId: string;
}) {
  const usuarioGoogle = await obterUsuarioGoogleAtivo(params.userId);
  if (!usuarioGoogle.ok) return null;

  let ultimoEvento: Awaited<ReturnType<typeof obterEventoGoogle>> | null = null;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    if (tentativa > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300 * tentativa));
    }
    ultimoEvento = await obterEventoGoogle({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: params.googleCalendarId,
      googleEventId: params.googleEventId,
    });
    if (ultimoEvento.linkMeet) {
      await db.googleCalendarEventoCache.update({
        where: {
          calendarioId_googleEventId: {
            calendarioId: params.calendarioId,
            googleEventId: params.googleEventId,
          },
        },
        data: dadosCacheDeEvento(ultimoEvento),
      });
      return ultimoEvento.linkMeet;
    }
  }

  if (ultimoEvento) {
    await cancelarEventoGoogle({
      emailUsuario: usuarioGoogle.emailUsuario,
      calendarId: params.googleCalendarId,
      googleEventId: params.googleEventId,
      etagConhecido: ultimoEvento.etag,
    });
    await db.googleCalendarEventoCache.deleteMany({
      where: { calendarioId: params.calendarioId, googleEventId: params.googleEventId },
    });
  }
  return null;
}

async function reagendarEventoVinculado(params: {
  googleEventId: string;
  googleCalendarId: string;
  googleMeetLink: string;
  inicio: Date;
  fim: Date;
}) {
  const vinculos = await db.googleCalendarEventoCache.findMany({
    where: {
      googleEventId: params.googleEventId,
      linkMeet: params.googleMeetLink,
      calendario: { googleCalendarId: params.googleCalendarId, gravavel: true },
    },
    select: {
      calendarioId: true,
      etag: true,
      calendario: { select: { timezone: true } },
    },
    take: 2,
  });
  if (vinculos.length !== 1) {
    return { success: false as const, error: "Não foi possível confirmar o organizador e o espaço desta reunião. Revise o vínculo na Agenda Alpha." };
  }
  const vinculo = vinculos[0];
  const usuarioGoogle = await obterUsuarioGoogleAtivoPorCalendario(vinculo.calendarioId);
  if (!usuarioGoogle.ok) {
    return { success: false as const, error: "A Agenda Alpha do organizador não está ativa." };
  }

  const eventoAtual = await obterEventoGoogle({
    emailUsuario: usuarioGoogle.emailUsuario,
    calendarId: params.googleCalendarId,
    googleEventId: params.googleEventId,
  });
  if (eventoAtual.linkMeet !== params.googleMeetLink) {
    return { success: false as const, error: "O espaço do Google Meet foi alterado fora do painel. Revise o evento antes de reagendar." };
  }

  const eventoAtualizado = await atualizarEventoParcialGoogle({
    emailUsuario: usuarioGoogle.emailUsuario,
    calendarId: params.googleCalendarId,
    googleEventId: params.googleEventId,
    etagConhecido: eventoAtual.etag,
    evento: {
      inicio: params.inicio,
      fim: params.fim,
      diaInteiro: false,
      timezone: vinculo.calendario.timezone || "America/Sao_Paulo",
    },
  });
  if (eventoAtualizado.linkMeet !== params.googleMeetLink) {
    return { success: false as const, error: "O Google devolveu um espaço de reunião diferente. O card não foi alterado; revise o evento na Agenda Alpha." };
  }
  await db.googleCalendarEventoCache.update({
    where: {
      calendarioId_googleEventId: {
        calendarioId: vinculo.calendarioId,
        googleEventId: params.googleEventId,
      },
    },
    data: dadosCacheDeEvento(eventoAtualizado),
  });
  return { success: true as const };
}

const agendarSchema = z.object({
  cardId: z.string().min(1),
  dataHora: z.coerce.date(),
});

/**
 * Resolve o calendário "principal" de quem está agendando — mesmo critério já usado
 * pelo Bibble ao criar eventos via chat (src/lib/bibble/calendar-tools.ts):
 * googleCalendarId === "primary" ou igual ao próprio e-mail; se só houver 1 calendário
 * gravável, usa ele. Sem ambiguidade automática — se houver mais de 1 candidato, falha
 * com mensagem clara em vez de escolher arbitrariamente.
 */
async function resolverCalendarioPrincipal(userId: number) {
  const usuario = await db.usuarios.findUnique({ where: { id: userId }, select: { email: true } });
  const emailUsuario = usuario?.email.trim().toLocaleLowerCase();

  const calendarios = await db.googleCalendarSelecionado.findMany({
    where: { conexao: { userId }, gravavel: true },
    select: { id: true, googleCalendarId: true, nome: true, timezone: true },
  });

  if (calendarios.length === 0) {
    return { ok: false as const, erro: "Nenhum calendário gravável encontrado. Conecte sua Agenda Alpha em Perfil → Agenda." };
  }

  const principais = calendarios.filter((c) => {
    const id = c.googleCalendarId.trim().toLocaleLowerCase();
    return id === "primary" || Boolean(emailUsuario && id === emailUsuario);
  });
  if (principais.length === 1) return { ok: true as const, calendario: principais[0] };
  if (calendarios.length === 1) return { ok: true as const, calendario: calendarios[0] };

  return {
    ok: false as const,
    erro: "Você tem mais de um calendário configurado — abra a Agenda Alpha e defina qual usar antes de agendar pelo card.",
  };
}

export async function AgendarReuniaoGoogleMeetBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = agendarSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, dataHora } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: { id: true, googleEventId: true, empresa: { select: { razaoSocial: true, nomeFantasia: true } } },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (card.googleEventId) {
      return { success: false, error: "Este card já tem uma reunião agendada — use Reagendar em vez de criar uma nova." };
    }

    const calendarioResolvido = await resolverCalendarioPrincipal(userId);
    if (!calendarioResolvido.ok) return { success: false, error: calendarioResolvido.erro };
    const { calendario } = calendarioResolvido;

    const inicio = dataHora;
    const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60_000);
    const nomeEmpresa = card.empresa.nomeFantasia || card.empresa.razaoSocial;

    const resultado = await criarEventoNoCalendario({
      calendarId: calendario.googleCalendarId,
      titulo: `Reunião — ${nomeEmpresa}`,
      timezone: calendario.timezone || "America/Sao_Paulo",
      diaInteiro: false,
      inicio,
      fim,
      participantes: [],
      criarMeet: true,
    });

    if (!resultado.success) return { success: false, error: resultado.error };

    const eventoCache = await db.googleCalendarEventoCache.findUnique({
      where: {
        calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: resultado.data.googleEventId },
      },
      select: { linkMeet: true },
    });
    const googleMeetLink = eventoCache?.linkMeet ?? await confirmarLinkMeetCriado({
      userId,
      calendarioId: calendario.id,
      googleCalendarId: calendario.googleCalendarId,
      googleEventId: resultado.data.googleEventId,
    });
    if (!googleMeetLink) {
      return {
        success: false,
        error: "O Google não confirmou o link do Meet. O evento incompleto foi desfeito; tente agendar novamente.",
      };
    }

    await db.$transaction(async (tx) => {
      await tx.bpmCard.update({
        where: { id: cardId },
        data: {
          dataReuniao: inicio,
          googleEventId: resultado.data.googleEventId,
          googleCalendarId: calendario.googleCalendarId,
          googleMeetLink,
        },
      });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "REUNIAO_AGENDADA",
          usuarioId: userId,
          valorNovoJson: JSON.stringify({ dataReuniao: inicio, googleEventId: resultado.data.googleEventId }),
        },
        tx,
      );
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId, tipo: "REUNIAO_ALTERADA" });
    return { success: true, data: { googleEventId: resultado.data.googleEventId } };
  } catch (error) {
    console.error("[AgendarReuniaoGoogleMeetBpm]", error instanceof GoogleCalendarError
      ? { kind: error.kind, status: error.status, message: error.message }
      : { message: error instanceof Error ? error.message : "Erro desconhecido" });
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao agendar reunião";
    return { success: false, error: msg };
  }
}

const reagendarSchema = z.object({
  cardId: z.string().min(1),
  dataHora: z.coerce.date(),
});

export async function ReagendarReuniaoBpm(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = reagendarSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { cardId, dataHora } = parsed.data;

    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "editarCard");

    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        googleEventId: true,
        googleCalendarId: true,
        googleMeetLink: true,
        dataReuniao: true,
        transcricaoReuniao: true,
      },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (!card.googleEventId || !card.googleCalendarId || !card.googleMeetLink) {
      return { success: false, error: "Este card ainda não tem reunião agendada — use Agendar pelo Google Meet primeiro." };
    }
    if (card.transcricaoReuniao?.trim()) {
      return {
        success: false,
        error: "Esta reunião já possui transcrição recebida e não pode ser reutilizada em outra data. Avance o card para preservar o vínculo da evidência.",
      };
    }

    const inicio = dataHora;
    const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60_000);

    const resultado = await reagendarEventoVinculado({
      googleCalendarId: card.googleCalendarId,
      googleEventId: card.googleEventId,
      googleMeetLink: card.googleMeetLink,
      inicio,
      fim,
    });

    if (!resultado.success) return { success: false, error: resultado.error };

    await db.$transaction(async (tx) => {
      await tx.bpmCard.update({ where: { id: cardId }, data: { dataReuniao: inicio } });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "REUNIAO_REAGENDADA",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({ dataReuniao: card.dataReuniao }),
          valorNovoJson: JSON.stringify({
            dataReuniao: inicio,
            googleEventId: card.googleEventId,
            googleMeetLink: card.googleMeetLink,
            transcricaoPreservada: Boolean(card.transcricaoReuniao?.trim()),
          }),
        },
        tx,
      );
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId, tipo: "REUNIAO_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[ReagendarReuniaoBpm]", error instanceof GoogleCalendarError
      ? { kind: error.kind, status: error.status, message: error.message }
      : { message: error instanceof Error ? error.message : "Erro desconhecido" });
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao reagendar reunião";
    return { success: false, error: msg };
  }
}
