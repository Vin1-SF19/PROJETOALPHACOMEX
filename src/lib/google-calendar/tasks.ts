import { google, tasks_v1 } from "googleapis";

import { classificarErroGoogle } from "./errors";
import { ESCOPO_GOOGLE_TASKS } from "./scopes";

export interface GoogleTaskListDTO {
  googleTaskListId: string;
  titulo: string;
}

export interface GoogleTaskDTO {
  googleTaskId: string;
  titulo: string;
  notas: string | null;
  status: "needsAction" | "completed";
  vencimentoEm: Date | null;
  concluidaEm: Date | null;
  excluida: boolean;
  oculta: boolean;
  parentGoogleTaskId: string | null;
  posicao: string | null;
  atualizadoGoogleEm: Date;
}

function clienteTasks(emailUsuario: string): tasks_v1.Tasks {
  const email = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Credenciais da Agenda Alpha não configuradas.");
  return google.tasks({
    version: "v1",
    auth: new google.auth.JWT({ email, key, scopes: [ESCOPO_GOOGLE_TASKS], subject: emailUsuario }),
  });
}

function mapTask(task: tasks_v1.Schema$Task): GoogleTaskDTO {
  return {
    googleTaskId: task.id ?? "",
    titulo: task.title?.trim() || "Sem título",
    notas: task.notes ?? null,
    status: task.status === "completed" ? "completed" : "needsAction",
    vencimentoEm: task.due ? new Date(task.due) : null,
    concluidaEm: task.completed ? new Date(task.completed) : null,
    excluida: task.deleted === true,
    oculta: task.hidden === true,
    parentGoogleTaskId: task.parent ?? null,
    posicao: task.position ?? null,
    atualizadoGoogleEm: task.updated ? new Date(task.updated) : new Date(),
  };
}

export async function listarListasGoogleTasks(emailUsuario: string): Promise<GoogleTaskListDTO[]> {
  try {
    const tasks = clienteTasks(emailUsuario);
    const resposta = await tasks.tasklists.list({ maxResults: 100 });
    return (resposta.data.items ?? []).flatMap((list) => list.id ? [{ googleTaskListId: list.id, titulo: list.title ?? "Sem título" }] : []);
  } catch (error) {
    throw classificarErroGoogle(error);
  }
}

export async function listarTarefasGoogleTasks(emailUsuario: string, taskListId: string): Promise<GoogleTaskDTO[]> {
  try {
    const tasks = clienteTasks(emailUsuario);
    const itens: GoogleTaskDTO[] = [];
    let pageToken: string | undefined;
    do {
      const resposta = await tasks.tasks.list({ tasklist: taskListId, maxResults: 100, showCompleted: true, showDeleted: true, showHidden: true, pageToken });
      itens.push(...(resposta.data.items ?? []).map(mapTask));
      pageToken = resposta.data.nextPageToken ?? undefined;
    } while (pageToken);
    return itens;
  } catch (error) {
    throw classificarErroGoogle(error);
  }
}

export async function criarTarefaGoogleTasks(input: { emailUsuario: string; taskListId: string; titulo: string; notas?: string; vencimentoEm?: Date }): Promise<GoogleTaskDTO> {
  try {
    const resposta = await clienteTasks(input.emailUsuario).tasks.insert({
      tasklist: input.taskListId,
      requestBody: { title: input.titulo, notes: input.notas, due: input.vencimentoEm?.toISOString() },
    });
    return mapTask(resposta.data);
  } catch (error) {
    throw classificarErroGoogle(error);
  }
}

export async function concluirTarefaGoogleTasks(input: { emailUsuario: string; taskListId: string; taskId: string }): Promise<GoogleTaskDTO> {
  try {
    const resposta = await clienteTasks(input.emailUsuario).tasks.patch({
      tasklist: input.taskListId,
      task: input.taskId,
      requestBody: { status: "completed" },
    });
    return mapTask(resposta.data);
  } catch (error) {
    throw classificarErroGoogle(error);
  }
}

export async function atualizarTarefaGoogleTasks(input: { emailUsuario: string; taskListId: string; taskId: string; titulo: string; notas?: string; vencimentoEm?: Date }): Promise<GoogleTaskDTO> {
  try {
    const resposta = await clienteTasks(input.emailUsuario).tasks.patch({
      tasklist: input.taskListId,
      task: input.taskId,
      requestBody: {
        title: input.titulo,
        // String vazia é intencional: permite limpar a descrição já existente.
        notes: input.notas ?? "",
        due: input.vencimentoEm?.toISOString(),
      },
    });
    return mapTask(resposta.data);
  } catch (error) {
    throw classificarErroGoogle(error);
  }
}
