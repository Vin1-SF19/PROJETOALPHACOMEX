import db from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher-server.ts";

import {
  CALENDARIO_ALPHA_COMPROMISSO_EVENT,
  canalCalendarioAlphaDoUsuario,
  type CalendarioAlphaCompromissoPayload,
} from "./notificacoes";

const JANELAS = [
  { nome: "10min" as const, minutos: 10 },
  { nome: "5min" as const, minutos: 5 },
];

// Metade do intervalo do cron (roda a cada 5min) — cobre a janela sem sobrepor a execução
// vizinha nem deixar buraco entre elas.
const TOLERANCIA_MS = 2.5 * 60 * 1000;

/**
 * Verifica eventos com `inicioEm` caindo dentro da janela de 10min/5min a partir de `agora` e
 * notifica o dono do compromisso + colegas que visualizam aquela agenda (GoogleCalendarColegaVisivel,
 * `visivel: true`) — mesmo escopo de destinatário já decidido para a Agenda Alpha. Idempotência
 * via GoogleCalendarAlertaCompromisso: 1 linha por (evento, destinatário, janela), então mesmo
 * rodando a cada 5min o mesmo alerta nunca dispara 2x. Espelha o padrão de
 * `src/lib/bpm/alertas-tarefas.ts` (dupla checagem otimista dentro de `$transaction`).
 */
export async function executarAlertasCompromissosCalendarioAlpha(agora = new Date()) {
  let examinados = 0;
  let disparados = 0;

  for (const janela of JANELAS) {
    const alvo = new Date(agora.getTime() + janela.minutos * 60 * 1000);
    const eventos = await db.googleCalendarEventoCache.findMany({
      where: {
        status: { not: "cancelled" },
        diaInteiro: false,
        inicioEm: {
          gte: new Date(alvo.getTime() - TOLERANCIA_MS),
          lt: new Date(alvo.getTime() + TOLERANCIA_MS),
        },
      },
      select: {
        id: true,
        calendarioId: true,
        googleEventId: true,
        titulo: true,
        inicioEm: true,
        calendario: {
          select: {
            nome: true,
            corHex: true,
            conexao: { select: { userId: true, status: true } },
          },
        },
      },
      take: 200,
    });

    examinados += eventos.length;

    for (const evento of eventos) {
      if (evento.calendario.conexao.status !== "ATIVA" || !evento.inicioEm) continue;

      const donoId = evento.calendario.conexao.userId;
      const colegasVisualizando = await db.googleCalendarColegaVisivel.findMany({
        where: { colegaId: donoId, visivel: true },
        select: { userId: true },
      });
      const destinatarios = [donoId, ...colegasVisualizando.map((c) => c.userId)];

      for (const destinatarioId of destinatarios) {
        const payload: CalendarioAlphaCompromissoPayload = {
          id: evento.id,
          googleEventId: evento.googleEventId,
          titulo: evento.titulo || "(sem título)",
          inicioEm: evento.inicioEm.toISOString(),
          janela: janela.nome,
          calendarioNome: evento.calendario.nome,
          calendarioCorHex: evento.calendario.corHex,
          createdAt: agora.toISOString(),
        };

        const disparou = await db.$transaction(async (tx) => {
          try {
            await tx.googleCalendarAlertaCompromisso.create({
              data: {
                calendarioId: evento.calendarioId,
                googleEventId: evento.googleEventId,
                destinatarioId,
                janela: janela.nome,
              },
            });
            return true;
          } catch {
            // Unique constraint já existe — este destinatário/janela já foi notificado.
            return false;
          }
        });

        if (!disparou) continue;
        disparados += 1;
        await pusherServer.trigger(
          canalCalendarioAlphaDoUsuario(destinatarioId),
          CALENDARIO_ALPHA_COMPROMISSO_EVENT,
          payload,
        );
      }
    }
  }

  return { examinados, disparados };
}
