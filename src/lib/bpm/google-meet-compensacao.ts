import "server-only";

import db from "@/lib/prisma";
import { atualizarEventoParcial, cancelarEvento, obterEvento } from "@/lib/google-calendar/client";
import { obterUsuarioGoogleAtivo, obterUsuarioGoogleAtivoPorCalendario } from "@/lib/google-calendar/usuario-google";

export type EventoCriadoSemVinculo = {
  cardId: string; userId: number; calendarioId: string; googleCalendarId: string; googleEventId: string;
};

export type ReagendamentoPendente = {
  cardId: string; calendarioId: string; googleCalendarId: string; googleEventId: string;
  googleMeetLink: string; inicioAnterior: string; fimAnterior: string; inicioNovo: string;
  participantesAnteriores: string[]; timezone: string;
};

export async function cancelarCriacaoSemVinculo(evento: EventoCriadoSemVinculo) {
  const vinculado = await db.bpmCard.findFirst({
    where: { googleEventId: evento.googleEventId, googleCalendarId: evento.googleCalendarId },
    select: { id: true },
  });
  if (vinculado) return;
  const usuario = await obterUsuarioGoogleAtivo(evento.userId);
  if (!usuario.ok) throw new Error("Organizador Google indisponível para compensação");
  try {
    const remoto = await obterEvento({
      emailUsuario: usuario.emailUsuario, calendarId: evento.googleCalendarId, googleEventId: evento.googleEventId,
    });
    if (remoto.status !== "cancelled") {
      await cancelarEvento({
        emailUsuario: usuario.emailUsuario, calendarId: evento.googleCalendarId,
        googleEventId: evento.googleEventId, etagConhecido: remoto.etag,
      });
    }
  } catch (error) {
    if (!error || typeof error !== "object" || !("status" in error) || error.status !== 404) throw error;
  }
  await db.googleCalendarEventoCache.deleteMany({
    where: { calendarioId: evento.calendarioId, googleEventId: evento.googleEventId },
  });
}

export async function reverterReagendamentoSemPersistencia(p: ReagendamentoPendente) {
  const card = await db.bpmCard.findUnique({
    where: { id: p.cardId }, select: { googleEventId: true, googleCalendarId: true, dataReuniao: true },
  });
  if (!card || card.googleEventId !== p.googleEventId || card.googleCalendarId !== p.googleCalendarId) {
    throw new Error("Vínculo do card mudou; reconciliação manual necessária");
  }
  if (card.dataReuniao?.toISOString() === p.inicioNovo) return;
  if (card.dataReuniao?.toISOString() !== p.inicioAnterior) {
    throw new Error("Horário local mudou; reconciliação manual necessária");
  }
  const usuario = await obterUsuarioGoogleAtivoPorCalendario(p.calendarioId);
  if (!usuario.ok) throw new Error("Organizador Google indisponível para rollback");
  const remoto = await obterEvento({
    emailUsuario: usuario.emailUsuario, calendarId: p.googleCalendarId, googleEventId: p.googleEventId,
  });
  if (remoto.status === "cancelled" || remoto.linkMeet !== p.googleMeetLink) {
    throw new Error("Evento Google mudou; reconciliação manual necessária");
  }
  const inicioRemotoMs = remoto.inicio.dataHora ? new Date(remoto.inicio.dataHora).getTime() : NaN;
  if (inicioRemotoMs === new Date(p.inicioAnterior).getTime()) return;
  if (inicioRemotoMs !== new Date(p.inicioNovo).getTime()) {
    throw new Error("Data Google foi alterada por outro usuário; reconciliação manual necessária");
  }
  await atualizarEventoParcial({
    emailUsuario: usuario.emailUsuario, calendarId: p.googleCalendarId,
    googleEventId: p.googleEventId, etagConhecido: remoto.etag,
    evento: {
      inicio: new Date(p.inicioAnterior), fim: new Date(p.fimAnterior), diaInteiro: false,
      timezone: p.timezone, participantes: p.participantesAnteriores,
    },
  });
}

export async function registrarCompensacaoGooglePendente(cardId: string, acao: string, payload: unknown) {
  try {
    await db.bpmCardHistorico.create({ data: { cardId, acao, valorNovoJson: JSON.stringify(payload) } });
  } catch (error) {
    console.error("[GoogleMeet] Falha ao registrar compensação pendente", { cardId, acao, error });
  }
}

export async function reconciliarCompensacoesGoogleBpm(limite = 25) {
  const pendentes = await db.bpmCardHistorico.findMany({
    where: {
      acao: { in: ["REUNIAO_CRIACAO_COMPENSACAO_PENDENTE", "REUNIAO_REAGENDAMENTO_COMPENSACAO_PENDENTE"] },
      OR: [{ valorAnteriorJson: null }, { valorAnteriorJson: { lt: new Date().toISOString() } }],
    },
    select: { id: true, acao: true, valorNovoJson: true }, orderBy: { createdAt: "asc" }, take: limite,
  });
  let concluidos = 0;
  let falhas = 0;
  for (const pendente of pendentes) {
    try {
      if (!pendente.valorNovoJson) throw new Error("Compensação sem dados");
      const payload: unknown = JSON.parse(pendente.valorNovoJson);
      if (pendente.acao === "REUNIAO_CRIACAO_COMPENSACAO_PENDENTE") {
        await cancelarCriacaoSemVinculo(payload as EventoCriadoSemVinculo);
      } else {
        await reverterReagendamentoSemPersistencia(payload as ReagendamentoPendente);
      }
      await db.bpmCardHistorico.update({ where: { id: pendente.id }, data: { acao: "REUNIAO_COMPENSACAO_CONCLUIDA" } });
      concluidos += 1;
    } catch (error) {
      falhas += 1;
      console.error("[reconciliarCompensacoesGoogleBpm]", { pendenteId: pendente.id, error });
      const revisao = error instanceof Error && error.message.includes("reconciliação manual");
      await db.bpmCardHistorico.update({
        where: { id: pendente.id },
        data: revisao
          ? { acao: "REUNIAO_COMPENSACAO_REVISAO" }
          : { valorAnteriorJson: new Date(Date.now() + 15 * 60 * 1000).toISOString() },
      }).catch((registroError) => console.error("[reconciliarCompensacoesGoogleBpm] Falha ao reagendar retry", registroError));
    }
  }
  return { examinados: pendentes.length, concluidos, falhas };
}
