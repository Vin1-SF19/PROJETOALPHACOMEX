"use server";

import { z } from "zod";

import type {
  EventoExibicao,
  TarefaAgendaExibicao,
} from "@/components/CalendarioAlpha/lib/tipos";
import { eventoFoiCompartilhadoComUsuario, eventoFoiRecusadoPeloUsuario } from "@/components/CalendarioAlpha/lib/tipos";
import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import {
  criarCorrelationIdAgendaAlpha,
  registrarMetricaPerformanceAgendaAlpha,
} from "@/lib/google-calendar/observability";
import db from "@/lib/prisma";

const LIMITE_INTERVALO_MS = 370 * 24 * 60 * 60 * 1000;

const intervaloAgendaSchema = z
  .object({
    inicioISO: z.iso.datetime(),
    fimISO: z.iso.datetime(),
  })
  .strict()
  .refine(({ inicioISO, fimISO }) => {
    const inicio = new Date(inicioISO).getTime();
    const fim = new Date(fimISO).getTime();
    return fim > inicio && fim - inicio <= LIMITE_INTERVALO_MS;
  }, "Intervalo da agenda inválido.");

export interface SnapshotIntervaloAgendaAlpha {
  eventos: EventoExibicao[];
  tarefas: TarefaAgendaExibicao[];
  carregadoEm: string;
}

type ResultadoSnapshot =
  | { success: true; data: SnapshotIntervaloAgendaAlpha }
  | { success: false; error: string };

/**
 * Leitura consolidada e cache-only do período visível. Uma única autorização e
 * duas consultas substituem a leitura/autorização repetida para cada calendário.
 */
export async function carregarIntervaloAgendaAlpha(input: {
  inicioISO: string;
  fimISO: string;
}): Promise<ResultadoSnapshot> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };

  const validacao = intervaloAgendaSchema.safeParse(input);
  if (!validacao.success) {
    return {
      success: false,
      error: validacao.error.issues[0]?.message ?? "Intervalo da agenda inválido.",
    };
  }

  const inicio = new Date(validacao.data.inicioISO);
  const fim = new Date(validacao.data.fimISO);
  const iniciadoEm = Date.now();
  const correlationId = criarCorrelationIdAgendaAlpha();

  try {
    const [calendarios, tarefasCache] = await Promise.all([
      db.googleCalendarSelecionado.findMany({
        where: {
          conexao: { userId: acesso.userId, status: "ATIVA" },
          visivel: true,
        },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          googleCalendarId: true,
          nome: true,
          corHex: true,
          gravavel: true,
          eventos: {
            where: {
              inicioEm: { lte: fim },
              OR: [{ fimEm: { gte: inicio } }, { fimEm: null }],
            },
            orderBy: { inicioEm: "asc" },
            select: {
              id: true,
              googleEventId: true,
              status: true,
              titulo: true,
              inicioEm: true,
              fimEm: true,
              diaInteiro: true,
              etag: true,
              linkMeet: true,
              eventType: true,
              statusPropertiesJson: true,
            },
          },
        },
      }),
      db.googleCalendarTaskCache.findMany({
        where: {
          OR: [
            {
              taskList: {
                conexao: { userId: acesso.userId, status: "ATIVA" },
              },
            },
            {
              agendamentoChamado: {
                is: { chamado: { usuarioId: acesso.userId } },
              },
            },
          ],
          excluida: false,
          oculta: false,
        },
        orderBy: [{ status: "asc" }, { vencimentoEm: "asc" }],
        take: 100,
        select: {
          id: true,
          titulo: true,
          notas: true,
          status: true,
          vencimentoEm: true,
          inicioLocalEm: true,
          fimLocalEm: true,
          agendamentoChamado: {
            select: {
              inicioEm: true,
              fimPlanejadoEm: true,
              fimConcluidoEm: true,
              status: true,
              chamado: { select: { usuarioId: true } },
            },
          },
          taskList: {
            select: {
              googleTaskListId: true,
              titulo: true,
              conexao: { select: { userId: true } },
            },
          },
        },
      }),
    ]);

    const eventos: EventoExibicao[] = calendarios.flatMap((calendario) =>
      calendario.eventos.map((evento) => ({
        id: evento.id,
        googleEventId: evento.googleEventId,
        status: evento.status,
        titulo: evento.titulo,
        inicioEm: evento.inicioEm?.toISOString() ?? null,
        fimEm: evento.fimEm?.toISOString() ?? null,
        diaInteiro: evento.diaInteiro,
        etag: evento.etag,
        linkMeet: evento.linkMeet,
        eventType: evento.eventType,
        tipo: "evento" as const,
        calendarioId: calendario.id,
        calendarioGoogleId: calendario.googleCalendarId,
        calendarioNome: calendario.nome,
        calendarioCorHex: calendario.corHex,
        calendarioGravavel: calendario.gravavel,
        recusadoPeloUsuario: eventoFoiRecusadoPeloUsuario(
          evento.statusPropertiesJson,
        ),
        compartilhadoComUsuario: eventoFoiCompartilhadoComUsuario(
          evento.statusPropertiesJson,
        ),
      })),
    );

    const tarefas: TarefaAgendaExibicao[] = tarefasCache.map((tarefa) => {
      const gravavel = tarefa.taskList.conexao.userId === acesso.userId;
      return {
        id: tarefa.id,
        taskListGoogleId: gravavel ? tarefa.taskList.googleTaskListId : "",
        listaTitulo: gravavel
          ? tarefa.taskList.titulo
          : "Chamados solicitados",
        titulo: tarefa.titulo,
        notas: tarefa.notas,
        status: tarefa.status === "completed" ? "completed" : "needsAction",
        vencimentoEm: tarefa.vencimentoEm?.toISOString() ?? null,
        inicioAgendadoEm:
          tarefa.agendamentoChamado?.inicioEm.toISOString() ?? null,
        fimPlanejadoAgendadoEm:
          tarefa.agendamentoChamado?.fimPlanejadoEm.toISOString() ?? null,
        fimConcluidoAgendadoEm:
          tarefa.agendamentoChamado?.fimConcluidoEm?.toISOString() ?? null,
        statusAgendamento:
          tarefa.agendamentoChamado?.status === "CONCLUIDO"
            ? "CONCLUIDO"
            : tarefa.agendamentoChamado?.status === "EM_ATENDIMENTO"
              ? "EM_ATENDIMENTO"
              : null,
        inicioLocalEm: tarefa.inicioLocalEm?.toISOString() ?? null,
        fimLocalEm: tarefa.fimLocalEm?.toISOString() ?? null,
        gravavel,
        visualizacaoSolicitante:
          !gravavel &&
          tarefa.agendamentoChamado?.chamado.usuarioId === acesso.userId,
      };
    });

    registrarMetricaPerformanceAgendaAlpha({
      correlationId,
      operation: "snapshot_intervalo",
      outcome: "success",
      latencyMs: Date.now() - iniciadoEm,
      itemCount: eventos.length + tarefas.length,
    });
    return {
      success: true,
      data: { eventos, tarefas, carregadoEm: new Date().toISOString() },
    };
  } catch {
    registrarMetricaPerformanceAgendaAlpha({
      correlationId,
      operation: "snapshot_intervalo",
      outcome: "error",
      latencyMs: Date.now() - iniciadoEm,
    });
    return {
      success: false,
      error: "Não foi possível atualizar este período da Agenda Alpha.",
    };
  }
}
