"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { criarLembreteSchema, type CriarLembreteInput } from "@/lib/validations/notas";
import { podeVisualizarNota, podeEditarNota } from "@/lib/notas/permissoes";
import { pusherServer } from "@/lib/pusher-server.ts";
import { canalNotasDoUsuario } from "@/lib/notas/notificacoes";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

export async function CriarLembreteNota(input: CriarLembreteInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = criarLembreteSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  if (!(await podeVisualizarNota(usuario, dados.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  const lembrete = await db.noteReminder.create({
    data: { noteId: dados.noteId, userId: usuario.id, remindAt: dados.remindAt },
  });

  return { success: true as const, data: lembrete };
}

export async function ConcluirLembrete(reminderId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const lembrete = await db.noteReminder.findUnique({ where: { id: reminderId }, select: { userId: true } });
  if (!lembrete || lembrete.userId !== usuario.id) return { success: false as const, error: "Sem permissão" };

  await db.noteReminder.update({ where: { id: reminderId }, data: { status: "CONCLUIDO", completedAt: new Date() } });
  return { success: true as const };
}

export async function AdiarLembrete(input: { reminderId: string; novoRemindAt: Date }) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const lembrete = await db.noteReminder.findUnique({ where: { id: input.reminderId }, select: { userId: true } });
  if (!lembrete || lembrete.userId !== usuario.id) return { success: false as const, error: "Sem permissão" };

  await db.noteReminder.update({
    where: { id: input.reminderId },
    data: { remindAt: input.novoRemindAt, status: "ADIADO" },
  });
  return { success: true as const };
}

export async function ExcluirLembrete(reminderId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const lembrete = await db.noteReminder.findUnique({ where: { id: reminderId }, select: { userId: true, noteId: true } });
  if (!lembrete) return { success: false as const, error: "Lembrete não encontrado" };

  const podeExcluir = lembrete.userId === usuario.id || (await podeEditarNota(usuario, lembrete.noteId));
  if (!podeExcluir) return { success: false as const, error: "Sem permissão" };

  await db.noteReminder.delete({ where: { id: reminderId } });
  return { success: true as const };
}

export async function ListarLembretesNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  if (!(await podeVisualizarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão", data: [] };
  }

  const lembretes = await db.noteReminder.findMany({
    where: { noteId, userId: usuario.id },
    orderBy: { remindAt: "asc" },
  });

  return { success: true as const, data: lembretes };
}

/**
 * Sem infraestrutura de cron confirmada no projeto (mesma decisão já tomada para
 * VideoIntrodutorioConfig) — lembretes vencidos são calculados em runtime nesta checagem,
 * disparada quando o usuário tem o painel aberto (ver useNotasNotifications/PainelLayoutClient),
 * nunca por um job agendado real. Notificação real via Pusher no mesmo canal privado do usuário.
 */
export async function VerificarLembretesPendentes() {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  const agora = new Date();
  const lembretesVencidos = await db.noteReminder.findMany({
    where: { userId: usuario.id, status: "PENDENTE", remindAt: { lte: agora } },
    include: { note: { select: { id: true, title: true } } },
  });

  for (const lembrete of lembretesVencidos) {
    try {
      await pusherServer.trigger(canalNotasDoUsuario(usuario.id), "nota-lembrete", {
        noteId: lembrete.note.id,
        noteTitle: lembrete.note.title,
        tipo: "LEMBRETE",
        mensagem: `Lembrete: "${lembrete.note.title || "Sem título"}"`,
        autorNome: "Lembrete",
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Falha ao notificar lembrete de nota:", error);
    }
  }

  return { success: true as const, data: lembretesVencidos.map((l) => ({ id: l.id, noteId: l.noteId, noteTitle: l.note.title })) };
}
