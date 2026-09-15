"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { mapearComConcorrencia } from "@/lib/google-calendar/concurrency";
import {
  adquirirLeaseSincronizacao,
  liberarLeaseSincronizacao,
  renovarLeaseSincronizacao,
  type LeaseSincronizacaoAgenda,
} from "@/lib/google-calendar/distributed-lock";
import { sincronizarCalendario } from "@/lib/google-calendar/sync";
import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";
import db from "@/lib/prisma";

const MAX_INTERVALO_MS = 370 * 24 * 60 * 60 * 1_000;
const CONCORRENCIA_RECONCILIACAO = 3;
const schema = z.object({ inicioISO: z.iso.datetime(), fimISO: z.iso.datetime() }).strict();

/** Preenche, sob lease distribuído, um período fora da janela normal do cache. */
export async function reconciliarIntervaloAgendaAlpha(input: {
  inicioISO: string;
  fimISO: string;
}) {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false as const, error: "Não autorizado." };
  const validacao = schema.safeParse(input);
  if (!validacao.success) return { success: false as const, error: "Intervalo inválido." };
  const inicio = new Date(validacao.data.inicioISO);
  const fim = new Date(validacao.data.fimISO);
  if (fim <= inicio || fim.getTime() - inicio.getTime() > MAX_INTERVALO_MS) {
    return { success: false as const, error: "Intervalo inválido." };
  }
  const usuario = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuario.ok) return { success: false as const, error: "Agenda Alpha indisponível." };
  const calendarios = await db.googleCalendarSelecionado.findMany({
    where: { conexaoId: usuario.conexaoId, visivel: true },
    select: { id: true, googleCalendarId: true, syncToken: true },
  });

  const ownerId = `agenda-intervalo:${acesso.userId}:${randomUUID()}`;
  const resultados = await mapearComConcorrencia(
    calendarios,
    CONCORRENCIA_RECONCILIACAO,
    async (calendario) => {
      let lease: LeaseSincronizacaoAgenda | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let renovacaoEmCurso = Promise.resolve();
      let leasePerdido = false;
      try {
        lease = await adquirirLeaseSincronizacao({
          calendarioId: calendario.id,
          ownerId,
        });
        if (!lease) return false;
        heartbeat = setInterval(() => {
          renovacaoEmCurso = renovacaoEmCurso
            .then(async () => {
              if (!lease || leasePerdido) return;
              const renovado = await renovarLeaseSincronizacao(lease);
              if (!renovado) leasePerdido = true;
              else lease = renovado;
            })
            .catch(() => {
              leasePerdido = true;
            });
        }, 30_000);
        heartbeat.unref?.();
        const resultado = await sincronizarCalendario(
          calendario,
          usuario.emailUsuario,
          false,
          {
            fencing: { ownerId: lease.ownerId, fencingToken: lease.fencingToken },
            intervalo: { inicio, fim },
          },
        );
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        await renovacaoEmCurso;
        return resultado.ok && !leasePerdido;
      } catch {
        return false;
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        await renovacaoEmCurso.catch(() => undefined);
        if (lease) await liberarLeaseSincronizacao(lease).catch(() => false);
      }
    },
  );
  return {
    success: true as const,
    data: { solicitados: calendarios.length, sincronizados: resultados.filter(Boolean).length },
  };
}
