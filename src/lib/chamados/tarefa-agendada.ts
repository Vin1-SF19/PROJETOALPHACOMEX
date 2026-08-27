import { atualizarTarefaGoogleTasks, concluirTarefaGoogleTasks, criarTarefaGoogleTasks, listarListasGoogleTasks } from "@/lib/google-calendar/tasks";
import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";
import db from "@/lib/prisma";

type ChamadoParaAgenda = {
  id: number;
  titulo: string;
  descricao: string;
  updatedAt: Date;
};

function ehUsuarioTi(role: string | null | undefined): boolean {
  return role?.trim().toUpperCase() === "TI";
}

function formatarHorario(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function notasDaTarefa(chamado: ChamadoParaAgenda): string {
  const descricao = chamado.descricao.trim().slice(0, 4_000);
  return [
    `Chamado #${chamado.id}`,
    descricao && `Descrição: ${descricao}`,
    `Horário de início: ${formatarHorario(chamado.updatedAt)}`,
  ].filter(Boolean).join("\n\n");
}

function notasComConclusao(notas: string | null, concluidoEm: Date): string {
  const semLinkLegado = (notas ?? "")
    .replace(/^Abrir chamado:.*(?:\r?\n)?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const semConclusaoAnterior = semLinkLegado
    .replace(/(?:\r?\n){1,2}Horário de conclusão:.*$/m, "")
    .trim();
  return [semConclusaoAnterior, `Horário de conclusão: ${formatarHorario(concluidoEm)}`]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Cria a tarefa do técnico ao assumir um chamado. A hora é local à Agenda Alpha,
 * pois a API Google Tasks armazena apenas a data de vencimento.
 */
export async function criarTarefaAgendadaParaChamado(input: {
  chamado: ChamadoParaAgenda;
  tecnicoId: number;
  tecnicoRole: string | null | undefined;
}): Promise<void> {
  if (!ehUsuarioTi(input.tecnicoRole)) return;

  const existente = await db.googleCalendarTaskSchedule.findUnique({
    where: { chamadoId: input.chamado.id },
    select: { id: true },
  });
  if (existente) return;

  const usuario = await obterUsuarioGoogleAtivo(input.tecnicoId);
  if (!usuario.ok) throw new Error("Agenda Alpha do técnico não está ativa.");

  const listasRemotas = await listarListasGoogleTasks(usuario.emailUsuario);
  const listaRemota = listasRemotas[0];
  if (!listaRemota) throw new Error("O técnico não possui uma lista do Google Tasks disponível.");

  const lista = await db.googleCalendarTaskListCache.upsert({
    where: {
      conexaoId_googleTaskListId: {
        conexaoId: usuario.conexaoId,
        googleTaskListId: listaRemota.googleTaskListId,
      },
    },
    create: {
      conexaoId: usuario.conexaoId,
      googleTaskListId: listaRemota.googleTaskListId,
      titulo: listaRemota.titulo,
      ultimaSincronizacaoEm: new Date(),
    },
    update: { titulo: listaRemota.titulo, ultimaSincronizacaoEm: new Date() },
  });

  const inicioEm = input.chamado.updatedAt;
  const fimPlanejadoEm = new Date(inicioEm.getTime() + 60 * 60 * 1_000);
  const tarefaGoogle = await criarTarefaGoogleTasks({
    emailUsuario: usuario.emailUsuario,
    taskListId: lista.googleTaskListId,
    titulo: `Chamado #${input.chamado.id} — ${input.chamado.titulo}`.slice(0, 1024),
    notas: notasDaTarefa(input.chamado),
    vencimentoEm: inicioEm,
  });

  const tarefa = await db.googleCalendarTaskCache.upsert({
    where: {
      taskListId_googleTaskId: {
        taskListId: lista.id,
        googleTaskId: tarefaGoogle.googleTaskId,
      },
    },
    create: { taskListId: lista.id, ...tarefaGoogle },
    update: { ...tarefaGoogle },
  });

  await db.googleCalendarTaskSchedule.create({
    data: {
      chamadoId: input.chamado.id,
      tarefaCacheId: tarefa.id,
      usuarioAgendaId: input.tecnicoId,
      inicioEm,
      fimPlanejadoEm,
    },
  });
}

/** Conclui no Google e registra localmente o instante exato do fechamento do chamado. */
export async function concluirTarefaAgendadaDoChamado(input: {
  chamadoId: number;
  concluidoEm: Date;
  tecnicoId: number;
  tecnicoRole: string | null | undefined;
}): Promise<void> {
  if (!ehUsuarioTi(input.tecnicoRole)) return;

  const agendamento = await db.googleCalendarTaskSchedule.findUnique({
    where: { chamadoId: input.chamadoId },
    include: { tarefaCache: { include: { taskList: true } } },
  });
  if (!agendamento || agendamento.status === "CONCLUIDO") return;
  if (agendamento.usuarioAgendaId !== input.tecnicoId) return;

  const usuario = await obterUsuarioGoogleAtivo(input.tecnicoId);
  if (!usuario.ok) throw new Error("Agenda Alpha do técnico não está ativa.");

  const tarefaConcluida = await concluirTarefaGoogleTasks({
    emailUsuario: usuario.emailUsuario,
    taskListId: agendamento.tarefaCache.taskList.googleTaskListId,
    taskId: agendamento.tarefaCache.googleTaskId,
  });
  const tarefaGoogle = await atualizarTarefaGoogleTasks({
    emailUsuario: usuario.emailUsuario,
    taskListId: agendamento.tarefaCache.taskList.googleTaskListId,
    taskId: agendamento.tarefaCache.googleTaskId,
    titulo: tarefaConcluida.titulo,
    notas: notasComConclusao(tarefaConcluida.notas ?? agendamento.tarefaCache.notas, input.concluidoEm),
    vencimentoEm: tarefaConcluida.vencimentoEm ?? undefined,
  });

  await db.$transaction([
    db.googleCalendarTaskCache.update({
      where: { id: agendamento.tarefaCacheId },
      data: tarefaGoogle,
    }),
    db.googleCalendarTaskSchedule.update({
      where: { id: agendamento.id },
      data: { status: "CONCLUIDO", fimConcluidoEm: input.concluidoEm },
    }),
  ]);
}
