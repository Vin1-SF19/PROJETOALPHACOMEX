import db from "@/lib/prisma";

import { dadosCacheDeEvento } from "./cache-eventos";
import { listarEventosPagina } from "./client";
import { GoogleCalendarError } from "./errors";

// Janela do full sync inicial — cobre a visão de Ano (±180 dias) sem repetir o problema de
// performance original (455 dias + 1 cliente JWT por página). Sync incremental (via syncToken)
// cobre mudanças dentro desta janela depois da primeira sincronização; eventos fora dela
// (ex: ano passado) só aparecem se o usuário navegar até lá antes da primeira sincronização
// completar — limitação conhecida e documentada, não uma sincronização "perpétua" de tudo.
const JANELA_FULL_SYNC_PASSADO_DIAS = 180;
const JANELA_FULL_SYNC_FUTURO_DIAS = 180;

// Teto de segurança contra contas com volume anormal de eventos — sem isso, uma única
// sincronização poderia paginar centenas de vezes e travar o carregamento da tela por minutos.
const MAX_PAGINAS_POR_SYNC = 30;

interface CalendarioParaSincronizar {
  id: string;
  googleCalendarId: string;
  syncToken: string | null;
}

/**
 * Sincroniza um calendário selecionado com o cache local (`GoogleCalendarEventoCache`).
 * Full sync (janela de tempo limitada) quando não há `syncToken`; incremental quando há.
 * Em `410 Gone`, reseta o cache e refaz full sync uma única vez (evita loop infinito).
 */
export async function sincronizarCalendario(
  calendario: CalendarioParaSincronizar,
  emailUsuario: string,
  permitirRetryFullSync = true,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const usandoIncremental = Boolean(calendario.syncToken);
  const agora = Date.now();
  const timeMin = usandoIncremental
    ? undefined
    : new Date(agora - JANELA_FULL_SYNC_PASSADO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = usandoIncremental
    ? undefined
    : new Date(agora + JANELA_FULL_SYNC_FUTURO_DIAS * 24 * 60 * 60 * 1000).toISOString();

  let pageToken: string | undefined;
  let syncTokenFinal: string | null = null;
  let paginasProcessadas = 0;

  try {
    do {
      const pagina = await listarEventosPagina({
        emailUsuario,
        calendarId: calendario.googleCalendarId,
        pageToken,
        syncToken: usandoIncremental ? (calendario.syncToken ?? undefined) : undefined,
        timeMin,
        timeMax,
      });
      paginasProcessadas += 1;

      for (const evento of pagina.eventos) {
        if (evento.status === "cancelled") {
          await db.googleCalendarEventoCache.deleteMany({
            where: { calendarioId: calendario.id, googleEventId: evento.googleEventId },
          });
          continue;
        }

        const dadosCache = dadosCacheDeEvento(evento);

        await db.googleCalendarEventoCache.upsert({
          where: {
            calendarioId_googleEventId: { calendarioId: calendario.id, googleEventId: evento.googleEventId },
          },
          create: { calendarioId: calendario.id, googleEventId: evento.googleEventId, ...dadosCache },
          update: dadosCache,
        });
      }

      pageToken = pagina.proximoPageToken ?? undefined;
      if (pagina.proximoSyncToken) syncTokenFinal = pagina.proximoSyncToken;

      if (pageToken && paginasProcessadas >= MAX_PAGINAS_POR_SYNC) {
        // Não salva syncToken (sync ficou incompleto) — próxima tentativa continua de onde parou,
        // via full sync de novo, mas pelo menos devolve o controle à tela em vez de travar.
        return {
          ok: false,
          erro: `Este calendário tem muitos eventos na janela sincronizada (mais de ${MAX_PAGINAS_POR_SYNC * 250}). Sincronização parcial.`,
        };
      }
    } while (pageToken);

    // Cursor só avança depois que TODAS as páginas tiveram sucesso.
    if (syncTokenFinal) {
      await db.googleCalendarSelecionado.update({
        where: { id: calendario.id },
        data: { syncToken: syncTokenFinal, ultimaSincronizacaoEm: new Date() },
      });
    }

    return { ok: true };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.kind === "gone" && permitirRetryFullSync) {
      await db.googleCalendarEventoCache.deleteMany({ where: { calendarioId: calendario.id } });
      await db.googleCalendarSelecionado.update({ where: { id: calendario.id }, data: { syncToken: null } });
      return sincronizarCalendario({ ...calendario, syncToken: null }, emailUsuario, false);
    }

    if (erro instanceof GoogleCalendarError) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }
}
