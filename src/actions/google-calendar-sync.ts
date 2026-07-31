"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import {
  orquestrarSincronizacaoCalendario,
  type ResultadoOrquestracaoSincronizacao,
} from "@/lib/google-calendar/sync-orchestrator";
import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";
import db from "@/lib/prisma";

const MAX_CALENDARIOS_POR_SYNC_MANUAL = 50;

const sincronizarAgendaAlphaSchema = z
  .object({
    calendarioIds: z
      .array(z.string().trim().min(1).max(100))
      .max(MAX_CALENDARIOS_POR_SYNC_MANUAL)
      .optional(),
  })
  .strict();

export type SincronizarAgendaAlphaInput = z.input<typeof sincronizarAgendaAlphaSchema>;

export type StatusSincronizacaoAgenda =
  | "sucesso"
  | "parcial"
  | "erro"
  | "cooldown"
  | "em_andamento"
  | "sem_calendarios";

export interface ResultadoCalendarioSincronizado {
  calendarioId: string;
  googleCalendarId: string;
  nome: string;
  resultado: ResultadoOrquestracaoSincronizacao;
}

export interface ResumoSincronizacaoAgenda {
  status: StatusSincronizacaoAgenda;
  calendarios: ResultadoCalendarioSincronizado[];
  contadores: {
    calendariosSolicitados: number;
    calendariosSincronizados: number;
    calendariosEmCooldown: number;
    calendariosCooldownAposErro: number;
    calendariosEmAndamento: number;
    calendariosComErro: number;
    eventosRecebidos: number;
    eventosAtualizados: number;
    eventosRemovidos: number;
    paginasProcessadas: number;
  };
  erros: Array<{ calendarioId: string; nome: string; mensagem: string }>;
  ultimaSincronizacaoEm: string | null;
}

export type ResultadoSincronizarAgendaAlpha =
  | { success: true; data: ResumoSincronizacaoAgenda }
  | { success: false; error: string };

function mensagemConexaoInativa(motivo: "sem_conexao" | "desativada"): string {
  return motivo === "desativada"
    ? "Agenda Alpha está desativada para sua conta."
    : "Ative a Agenda Alpha antes de sincronizar.";
}

function statusConsolidado(
  contadores: ResumoSincronizacaoAgenda["contadores"],
): StatusSincronizacaoAgenda {
  if (contadores.calendariosSolicitados === 0) return "sem_calendarios";
  if (contadores.calendariosComErro === contadores.calendariosSolicitados) return "erro";
  if (contadores.calendariosEmAndamento === contadores.calendariosSolicitados) return "em_andamento";
  if (contadores.calendariosEmCooldown === contadores.calendariosSolicitados) return "cooldown";
  if (
    contadores.calendariosComErro > 0 ||
    contadores.calendariosCooldownAposErro > 0 ||
    contadores.calendariosEmAndamento > 0 ||
    contadores.calendariosEmCooldown > 0
  ) {
    return "parcial";
  }
  return "sucesso";
}

/**
 * Sincronização manual consolidada da conexão ativa. Cada calendário é
 * coordenado separadamente por dedupe/cooldown in-process.
 */
export async function sincronizarAgendaAlpha(
  input: SincronizarAgendaAlphaInput = {},
): Promise<ResultadoSincronizarAgendaAlpha> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = sincronizarAgendaAlphaSchema.safeParse(input);
  if (!validacao.success) {
    return {
      success: false,
      error: validacao.error.issues[0]?.message ?? "Dados inválidos para sincronização.",
    };
  }

  const usuarioGoogle = await obterUsuarioGoogleAtivo(acesso.userId);
  if (!usuarioGoogle.ok) {
    return { success: false, error: mensagemConexaoInativa(usuarioGoogle.motivo) };
  }

  const conexao = await db.googleCalendarConexao.findUnique({
    where: { id: usuarioGoogle.conexaoId },
    select: {
      id: true,
      userId: true,
      ultimaSincronizacaoEm: true,
      calendarios: {
        where: validacao.data.calendarioIds
          ? { id: { in: validacao.data.calendarioIds } }
          : undefined,
        take: MAX_CALENDARIOS_POR_SYNC_MANUAL + 1,
        orderBy: { nome: "asc" },
        select: {
          id: true,
          googleCalendarId: true,
          nome: true,
          syncToken: true,
        },
      },
    },
  });

  if (!conexao || conexao.userId !== acesso.userId) {
    return { success: false, error: "Conexão da Agenda Alpha não encontrada." };
  }
  if (conexao.calendarios.length > MAX_CALENDARIOS_POR_SYNC_MANUAL) {
    return {
      success: false,
      error: `Selecione no máximo ${MAX_CALENDARIOS_POR_SYNC_MANUAL} calendários por sincronização manual.`,
    };
  }

  const idsSolicitados = new Set(validacao.data.calendarioIds ?? []);
  if (
    idsSolicitados.size > 0 &&
    conexao.calendarios.some((calendario) => !idsSolicitados.has(calendario.id))
  ) {
    return { success: false, error: "Um ou mais calendários não pertencem à conexão ativa." };
  }
  if (idsSolicitados.size > 0 && conexao.calendarios.length !== idsSolicitados.size) {
    return { success: false, error: "Um ou mais calendários não pertencem à conexão ativa." };
  }

  const calendarios: ResultadoCalendarioSincronizado[] = [];
  for (const calendario of conexao.calendarios) {
    const resultado = await orquestrarSincronizacaoCalendario({
      userId: acesso.userId,
      calendario,
      emailUsuario: usuarioGoogle.emailUsuario,
    });
    calendarios.push({
      calendarioId: calendario.id,
      googleCalendarId: calendario.googleCalendarId,
      nome: calendario.nome,
      resultado,
    });
  }

  const contadores: ResumoSincronizacaoAgenda["contadores"] = {
    calendariosSolicitados: calendarios.length,
    calendariosSincronizados: 0,
    calendariosEmCooldown: 0,
    calendariosCooldownAposErro: 0,
    calendariosEmAndamento: 0,
    calendariosComErro: 0,
    eventosRecebidos: 0,
    eventosAtualizados: 0,
    eventosRemovidos: 0,
    paginasProcessadas: 0,
  };
  const erros: ResumoSincronizacaoAgenda["erros"] = [];

  for (const calendario of calendarios) {
    const resultado = calendario.resultado;
    if (resultado.status === "sincronizado") contadores.calendariosSincronizados += 1;
    if (resultado.status === "cooldown") {
      contadores.calendariosEmCooldown += 1;
      if (resultado.resultadoAnterior === "erro") {
        contadores.calendariosCooldownAposErro += 1;
        erros.push({
          calendarioId: calendario.calendarioId,
          nome: calendario.nome,
          mensagem:
            "A última tentativa de sincronização falhou. Aguarde o fim do cooldown antes de tentar novamente.",
        });
      }
    }
    if (resultado.status === "em_andamento") contadores.calendariosEmAndamento += 1;
    if (resultado.status === "erro") {
      contadores.calendariosComErro += 1;
      erros.push({
        calendarioId: calendario.calendarioId,
        nome: calendario.nome,
        mensagem: resultado.erro,
      });
    }
    if (resultado.status === "sincronizado" || resultado.status === "erro") {
      contadores.eventosRecebidos += resultado.contadores.eventosRecebidos;
      contadores.eventosAtualizados += resultado.contadores.eventosAtualizados;
      contadores.eventosRemovidos += resultado.contadores.eventosRemovidos;
      contadores.paginasProcessadas += resultado.contadores.paginasProcessadas;
    }
  }

  let ultimaSincronizacaoEm = conexao.ultimaSincronizacaoEm;
  if (
    contadores.calendariosSincronizados > 0 &&
    contadores.calendariosSincronizados === contadores.calendariosSolicitados &&
    contadores.calendariosComErro === 0 &&
    contadores.calendariosCooldownAposErro === 0 &&
    contadores.calendariosEmAndamento === 0 &&
    contadores.calendariosEmCooldown === 0
  ) {
    ultimaSincronizacaoEm = new Date();
    await db.googleCalendarConexao.update({
      where: { id: conexao.id },
      data: {
        status: "ATIVA",
        ultimaSincronizacaoEm,
      },
    });
    revalidatePath("/PainelAlpha/CalendarioAlpha");
  }

  return {
    success: true,
    data: {
      status: statusConsolidado(contadores),
      calendarios,
      contadores,
      erros,
      ultimaSincronizacaoEm: ultimaSincronizacaoEm?.toISOString() ?? null,
    },
  };
}
