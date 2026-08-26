import db from "@/lib/prisma";

import { dadosCacheDeEvento } from "./cache-eventos";
import { listarEventosPagina } from "./client";
import {
  GoogleCalendarError,
  type GoogleCalendarErrorKind,
} from "./errors";
import type { GoogleEventoDTO } from "./types";

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
// Dez campos persistidos por evento. Lotes de 50 mantêm folga abaixo do
// limite conservador de 999 parâmetros do SQLite, inclusive com defaults.
const TAMANHO_LOTE_CACHE = 50;
// O timeout padrão de 5 segundos do Prisma é insuficiente para um cursor
// incremental acumulado (milhares de eventos). O cache e o cursor precisam
// continuar atômicos para evitar perda de alterações entre páginas.
const TIMEOUT_TRANSACAO_CACHE_MS = 120_000;

function dividirEmLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    lotes.push(itens.slice(inicio, inicio + tamanho));
  }
  return lotes;
}

interface CalendarioParaSincronizar {
  id: string;
  googleCalendarId: string;
  syncToken: string | null;
}

export interface ContadoresSincronizacaoCalendario {
  eventosRecebidos: number;
  eventosAtualizados: number;
  eventosRemovidos: number;
  paginasProcessadas: number;
}

export type ResultadoSincronizacaoCalendario =
  | {
      ok: true;
      contadores: ContadoresSincronizacaoCalendario;
      sincronizadoEm: Date;
    }
  | {
      ok: false;
      erro: string;
      codigo?: CodigoFalhaSincronizacaoCalendario;
      permanent?: boolean;
      retryable?: boolean;
      contadores: ContadoresSincronizacaoCalendario;
    };

export type CodigoFalhaSincronizacaoCalendario =
  | "FENCING_PERDIDO"
  | "GOOGLE_AUTH_EXPIRED"
  | "GOOGLE_FORBIDDEN"
  | "GOOGLE_NOT_FOUND"
  | "GOOGLE_GONE"
  | "GOOGLE_RATE_LIMITED"
  | "GOOGLE_INVALID_REQUEST"
  | "GOOGLE_UNAVAILABLE"
  | "GOOGLE_UNKNOWN";

const FALHAS_GOOGLE_SEGURAS: Record<
  GoogleCalendarErrorKind,
  {
    codigo: Exclude<CodigoFalhaSincronizacaoCalendario, "FENCING_PERDIDO">;
    erro: string;
    permanent: boolean;
  }
> = {
  auth_expired: {
    codigo: "GOOGLE_AUTH_EXPIRED",
    erro: "A autenticação da Agenda Alpha foi rejeitada.",
    permanent: true,
  },
  forbidden: {
    codigo: "GOOGLE_FORBIDDEN",
    erro: "A Agenda Alpha não possui permissão para acessar este calendário.",
    permanent: true,
  },
  not_found: {
    codigo: "GOOGLE_NOT_FOUND",
    erro: "O calendário selecionado não está mais disponível.",
    permanent: true,
  },
  gone: {
    codigo: "GOOGLE_GONE",
    erro: "O cursor de sincronização expirou e não pôde ser recuperado.",
    permanent: false,
  },
  rate_limited: {
    codigo: "GOOGLE_RATE_LIMITED",
    erro: "A sincronização foi temporariamente limitada pelo provedor.",
    permanent: false,
  },
  invalid_request: {
    codigo: "GOOGLE_INVALID_REQUEST",
    erro: "O provedor rejeitou a solicitação de sincronização.",
    permanent: true,
  },
  unavailable: {
    codigo: "GOOGLE_UNAVAILABLE",
    erro: "O provedor de calendário está temporariamente indisponível.",
    permanent: false,
  },
  unknown: {
    codigo: "GOOGLE_UNKNOWN",
    erro: "Não foi possível concluir a sincronização com o provedor.",
    permanent: false,
  },
};

export interface ContextoFencingSincronizacao {
  ownerId: string;
  fencingToken: number;
}

export interface OpcoesSincronizacaoCalendario {
  fencing?: ContextoFencingSincronizacao;
}

class FencingSincronizacaoPerdidoError extends Error {
  constructor() {
    super("O lease distribuído da sincronização não é mais válido.");
    this.name = "FencingSincronizacaoPerdidoError";
  }
}

/**
 * Sincroniza um calendário selecionado com o cache local (`GoogleCalendarEventoCache`).
 * Full sync (janela de tempo limitada) quando não há `syncToken`; incremental quando há.
 * Em `410 Gone`, busca um full sync completo antes de substituir cache/token.
 * Se a recuperação falhar, o snapshot e o cursor anteriores permanecem intactos.
 */
export async function sincronizarCalendario(
  calendario: CalendarioParaSincronizar,
  emailUsuario: string,
  permitirRetryFullSync = true,
  opcoes: OpcoesSincronizacaoCalendario = {},
): Promise<ResultadoSincronizacaoCalendario> {
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
  let eventosRecebidos = 0;
  let eventosAtualizados = 0;
  let eventosRemovidos = 0;
  const eventosParaPersistir: GoogleEventoDTO[] = [];

  const obterContadores = (): ContadoresSincronizacaoCalendario => ({
    eventosRecebidos,
    eventosAtualizados,
    eventosRemovidos,
    paginasProcessadas,
  });

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
      eventosRecebidos += pagina.eventos.length;

      eventosParaPersistir.push(...pagina.eventos);

      pageToken = pagina.proximoPageToken ?? undefined;
      if (pagina.proximoSyncToken) syncTokenFinal = pagina.proximoSyncToken;

      if (pageToken && paginasProcessadas >= MAX_PAGINAS_POR_SYNC) {
        // Não salva syncToken (sync ficou incompleto) — próxima tentativa continua de onde parou,
        // via full sync de novo, mas pelo menos devolve o controle à tela em vez de travar.
        return {
          ok: false,
          erro: `Este calendário tem muitos eventos na janela sincronizada (mais de ${MAX_PAGINAS_POR_SYNC * 250}). Sincronização parcial.`,
          contadores: obterContadores(),
        };
      }
    } while (pageToken);

    if (!syncTokenFinal) {
      return {
        ok: false,
        erro: "O Google não retornou um cursor final de sincronização.",
        contadores: obterContadores(),
      };
    }

    // Cache e cursor mudam juntos somente depois que TODAS as páginas tiveram sucesso.
    const sincronizadoEm = new Date();
    await db.$transaction(async (tx) => {
      const exigirFencingValido = async () => {
        if (!opcoes.fencing) return;
        const lease = await tx.googleCalendarSyncLease.findUnique({
          where: { calendarioId: calendario.id },
          select: {
            ownerId: true,
            fencingToken: true,
            leaseExpiresAt: true,
          },
        });
        if (
          !lease ||
          lease.ownerId !== opcoes.fencing.ownerId ||
          lease.fencingToken !== opcoes.fencing.fencingToken ||
          lease.leaseExpiresAt.getTime() <= Date.now()
        ) {
          throw new FencingSincronizacaoPerdidoError();
        }
      };

      await exigirFencingValido();
      let atualizadosNaTransacao = 0;
      let removidosNaTransacao = 0;

      if (!usandoIncremental) {
        await tx.googleCalendarEventoCache.deleteMany({
          where: { calendarioId: calendario.id },
        });
      }

      const eventosFinais = [
        ...new Map(
          eventosParaPersistir.map((evento) => [evento.googleEventId, evento]),
        ).values(),
      ];
      const cancelados = eventosFinais.filter(
        (evento) => evento.status === "cancelled",
      );
      const ativos = eventosFinais.filter(
        (evento) => evento.status !== "cancelled",
      );

      for (const lote of dividirEmLotes(cancelados, TAMANHO_LOTE_CACHE)) {
        await tx.googleCalendarEventoCache.deleteMany({
          where: {
            calendarioId: calendario.id,
            googleEventId: { in: lote.map((evento) => evento.googleEventId) },
          },
        });
        removidosNaTransacao += lote.length;
      }

      for (const lote of dividirEmLotes(ativos, TAMANHO_LOTE_CACHE)) {
        if (usandoIncremental) {
          await tx.googleCalendarEventoCache.deleteMany({
            where: {
              calendarioId: calendario.id,
              googleEventId: { in: lote.map((evento) => evento.googleEventId) },
            },
          });
        }
        await tx.googleCalendarEventoCache.createMany({
          data: lote.map((evento) => ({
            calendarioId: calendario.id,
            googleEventId: evento.googleEventId,
            ...dadosCacheDeEvento(evento),
          })),
        });
        atualizadosNaTransacao += lote.length;
      }

      // Segunda barreira antes de avançar o cursor: se o lease expirou durante
      // a aplicação do lote, a transação inteira é revertida.
      await exigirFencingValido();
      await tx.googleCalendarSelecionado.update({
        where: { id: calendario.id },
        data: {
          syncToken: syncTokenFinal,
          ultimaSincronizacaoEm: sincronizadoEm,
        },
      });
      eventosAtualizados = atualizadosNaTransacao;
      eventosRemovidos = removidosNaTransacao;
    }, {
      maxWait: 10_000,
      timeout: TIMEOUT_TRANSACAO_CACHE_MS,
    });

    return { ok: true, contadores: obterContadores(), sincronizadoEm };
  } catch (erro) {
    if (erro instanceof GoogleCalendarError && erro.kind === "gone" && permitirRetryFullSync) {
      return sincronizarCalendario(
        { ...calendario, syncToken: null },
        emailUsuario,
        false,
        opcoes,
      );
    }

    if (erro instanceof FencingSincronizacaoPerdidoError) {
      return {
        ok: false,
        erro: erro.message,
        codigo: "FENCING_PERDIDO",
        permanent: false,
        retryable: true,
        contadores: obterContadores(),
      };
    }
    if (erro instanceof GoogleCalendarError) {
      const falha = FALHAS_GOOGLE_SEGURAS[erro.kind];
      return {
        ok: false,
        erro: falha.erro,
        codigo: falha.codigo,
        permanent: falha.permanent,
        retryable: erro.retryable,
        contadores: obterContadores(),
      };
    }
    const erroInesperado = erro instanceof Error ? erro : null;
    console.error("[agenda-alpha] Falha local inesperada durante a sincronização", {
      calendarioId: calendario.id,
      nome: erroInesperado?.name ?? "Erro desconhecido",
      mensagem: erroInesperado?.message ?? "Sem mensagem",
    });
    return {
      ok: false,
      erro: "Falha inesperada ao sincronizar este calendário.",
      contadores: obterContadores(),
    };
  }
}
