"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verificarAcessoCalendarioAlpha } from "@/lib/google-calendar/autorizacao";
import { atualizarTarefaGoogleTasks, criarTarefaGoogleTasks, concluirTarefaGoogleTasks, listarListasGoogleTasks, listarTarefasGoogleTasks } from "@/lib/google-calendar/tasks";
import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";
import db from "@/lib/prisma";

type Resultado<T> = { success: true; data: T } | { success: false; error: string };
const tarefaSchema = z.object({ taskListId: z.string().min(1).max(300), titulo: z.string().trim().min(1).max(1024), notas: z.string().trim().max(8192).optional(), vencimentoEm: z.coerce.date().optional() }).strict();
const concluirSchema = z.object({ tarefaCacheId: z.string().min(1) }).strict();
const atualizarSchema = z.object({
  tarefaCacheId: z.string().min(1),
  titulo: z.string().trim().min(1).max(1024),
  notas: z.string().trim().max(8192).optional(),
  vencimentoEm: z.coerce.date().optional(),
}).strict();

async function contextoAtivo(): Promise<Resultado<{ conexaoId: string; emailUsuario: string }>> {
  const acesso = await verificarAcessoCalendarioAlpha();
  if (!acesso.autorizado) return { success: false, error: "Não autorizado." };
  const usuario = await obterUsuarioGoogleAtivo(acesso.userId);
  return usuario.ok ? { success: true, data: { conexaoId: usuario.conexaoId, emailUsuario: usuario.emailUsuario } } : { success: false, error: "Ative a Agenda Alpha antes de sincronizar tarefas." };
}

export async function sincronizarTarefasAgendaAlpha(): Promise<Resultado<{ listas: number; tarefas: number }>> {
  const contexto = await contextoAtivo();
  if (!contexto.success) return contexto;
  try {
    const listas = await listarListasGoogleTasks(contexto.data.emailUsuario);
    let total = 0;
    for (const lista of listas) {
      const cacheLista = await db.googleCalendarTaskListCache.upsert({
        where: { conexaoId_googleTaskListId: { conexaoId: contexto.data.conexaoId, googleTaskListId: lista.googleTaskListId } },
        create: { conexaoId: contexto.data.conexaoId, googleTaskListId: lista.googleTaskListId, titulo: lista.titulo, ultimaSincronizacaoEm: new Date() },
        update: { titulo: lista.titulo, ultimaSincronizacaoEm: new Date() },
      });
      const tarefas = await listarTarefasGoogleTasks(contexto.data.emailUsuario, lista.googleTaskListId);
      total += tarefas.length;
      for (const tarefa of tarefas) {
        await db.googleCalendarTaskCache.upsert({
          where: { taskListId_googleTaskId: { taskListId: cacheLista.id, googleTaskId: tarefa.googleTaskId } },
          create: { taskListId: cacheLista.id, ...tarefa },
          update: { ...tarefa },
        });
      }
    }
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { listas: listas.length, tarefas: total } };
  } catch {
    return { success: false, error: "Não foi possível sincronizar tarefas do Google." };
  }
}

export async function criarTarefaAgendaAlpha(input: z.input<typeof tarefaSchema>): Promise<Resultado<{ id: string }>> {
  const parsed = tarefaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const contexto = await contextoAtivo();
  if (!contexto.success) return contexto;
  const lista = await db.googleCalendarTaskListCache.findFirst({ where: { conexaoId: contexto.data.conexaoId, googleTaskListId: parsed.data.taskListId }, select: { id: true } });
  if (!lista) return { success: false, error: "Lista de tarefas não encontrada. Sincronize primeiro." };
  try {
    const tarefa = await criarTarefaGoogleTasks({ emailUsuario: contexto.data.emailUsuario, ...parsed.data });
    const salva = await db.googleCalendarTaskCache.upsert({ where: { taskListId_googleTaskId: { taskListId: lista.id, googleTaskId: tarefa.googleTaskId } }, create: { taskListId: lista.id, ...tarefa }, update: { ...tarefa } });
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { id: salva.id } };
  } catch { return { success: false, error: "Não foi possível criar a tarefa no Google." }; }
}

export async function concluirTarefaAgendaAlpha(input: z.input<typeof concluirSchema>): Promise<Resultado<{ id: string }>> {
  const parsed = concluirSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Tarefa inválida." };
  const contexto = await contextoAtivo();
  if (!contexto.success) return contexto;
  const tarefa = await db.googleCalendarTaskCache.findFirst({ where: { id: parsed.data.tarefaCacheId, taskList: { conexaoId: contexto.data.conexaoId } }, include: { taskList: { select: { googleTaskListId: true } } } });
  if (!tarefa) return { success: false, error: "Tarefa não encontrada." };
  try {
    const atualizada = await concluirTarefaGoogleTasks({ emailUsuario: contexto.data.emailUsuario, taskListId: tarefa.taskList.googleTaskListId, taskId: tarefa.googleTaskId });
    await db.googleCalendarTaskCache.update({ where: { id: tarefa.id }, data: atualizada });
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { id: tarefa.id } };
  } catch { return { success: false, error: "Não foi possível concluir a tarefa no Google." }; }
}

export async function atualizarTarefaAgendaAlpha(input: z.input<typeof atualizarSchema>): Promise<Resultado<{ id: string }>> {
  const parsed = atualizarSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const contexto = await contextoAtivo();
  if (!contexto.success) return contexto;
  const tarefa = await db.googleCalendarTaskCache.findFirst({ where: { id: parsed.data.tarefaCacheId, taskList: { conexaoId: contexto.data.conexaoId } }, include: { taskList: { select: { googleTaskListId: true } } } });
  if (!tarefa) return { success: false, error: "Tarefa não encontrada." };
  try {
    const atualizada = await atualizarTarefaGoogleTasks({
      emailUsuario: contexto.data.emailUsuario,
      taskListId: tarefa.taskList.googleTaskListId,
      taskId: tarefa.googleTaskId,
      titulo: parsed.data.titulo,
      notas: parsed.data.notas,
      vencimentoEm: parsed.data.vencimentoEm,
    });
    await db.googleCalendarTaskCache.update({ where: { id: tarefa.id }, data: atualizada });
    revalidatePath("/PainelAlpha/CalendarioAlpha");
    return { success: true, data: { id: tarefa.id } };
  } catch { return { success: false, error: "Não foi possível atualizar a tarefa no Google." }; }
}
