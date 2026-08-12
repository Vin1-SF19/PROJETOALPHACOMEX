"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { z } from "zod";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { registrarHistoricoCard } from "./Cards";
import {
  criarEventoNoCalendario,
  atualizarEventoParcialNoCalendario,
} from "@/actions/google-calendar-eventos";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

const ROTA_BASE = "/PainelAlpha/AlphaCRM";
const DURACAO_PADRAO_MINUTOS = 60; // decisão confirmada com o usuário (plano-novos-leads-bpm.md, Bloco 2)

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

    // O link do Meet real só é conhecido depois de criado — criarEventoNoCalendario já grava
    // o evento completo (incluindo linkMeet) em GoogleCalendarEventoCache; buscamos de lá em
    // vez de fazer uma segunda chamada à API do Google.
    const eventoCache = await db.googleCalendarEventoCache.findUnique({
      where: {
        calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: resultado.data.googleEventId },
      },
      select: { linkMeet: true },
    });

    await db.$transaction(async (tx) => {
      await tx.bpmCard.update({
        where: { id: cardId },
        data: {
          dataReuniao: inicio,
          googleEventId: resultado.data.googleEventId,
          googleCalendarId: calendario.googleCalendarId,
          googleMeetLink: eventoCache?.linkMeet ?? null,
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
    console.error("[AgendarReuniaoGoogleMeetBpm]", error);
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
      select: { id: true, googleEventId: true, googleCalendarId: true, dataReuniao: true },
    });
    if (!card) return { success: false, error: "Card não encontrado" };
    if (!card.googleEventId || !card.googleCalendarId) {
      return { success: false, error: "Este card ainda não tem reunião agendada — use Agendar pelo Google Meet primeiro." };
    }

    const inicio = dataHora;
    const fim = new Date(inicio.getTime() + DURACAO_PADRAO_MINUTOS * 60_000);

    const resultado = await atualizarEventoParcialNoCalendario({
      calendarId: card.googleCalendarId,
      googleEventId: card.googleEventId,
      inicio,
      fim,
    });

    if (!resultado.success) return { success: false, error: resultado.error };
    if (resultado.data.conflito) {
      return { success: false, error: "O evento foi alterado por fora do painel — abra a Agenda Alpha para revisar antes de reagendar." };
    }

    await db.$transaction(async (tx) => {
      await tx.bpmCard.update({ where: { id: cardId }, data: { dataReuniao: inicio } });
      await registrarHistoricoCard(
        {
          cardId,
          acao: "REUNIAO_REAGENDADA",
          usuarioId: userId,
          valorAnteriorJson: JSON.stringify({ dataReuniao: card.dataReuniao }),
          valorNovoJson: JSON.stringify({ dataReuniao: inicio }),
        },
        tx,
      );
    });

    revalidatePath(`${ROTA_BASE}/pipeline`);
    await notificarPipelineBpm({ cardId, tipo: "REUNIAO_ALTERADA" });
    return { success: true };
  } catch (error) {
    console.error("[ReagendarReuniaoBpm]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao reagendar reunião";
    return { success: false, error: msg };
  }
}
