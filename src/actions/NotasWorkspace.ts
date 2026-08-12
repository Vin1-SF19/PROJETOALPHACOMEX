"use server";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import {
  atualizarWorkspaceSchema,
  abrirAbaNotaSchema,
  reordenarAbasNotasSchema,
  type AtualizarWorkspaceInput,
  type AbrirAbaNotaInput,
  type ReordenarAbasNotasInput,
} from "@/lib/validations/notas";
import { podeVisualizarNota } from "@/lib/notas/permissoes";
import { criarFiltroAcessoNota } from "@/lib/notas/acesso";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "" };
}

export async function ObterWorkspaceNotas() {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const [workspace, abas] = await Promise.all([
    db.userNotesWorkspace.findUnique({ where: { userId: usuario.id } }),
    db.userOpenNoteTab.findMany({
      where: { userId: usuario.id, note: criarFiltroAcessoNota(usuario) },
      orderBy: { position: "asc" },
      include: { note: { select: { id: true, title: true, color: true, deletedAt: true } } },
    }),
  ]);

  return {
    success: true as const,
    data: {
      workspace: workspace ?? {
        userId: usuario.id,
        isTaskbarVisible: true,
        viewerMode: "RECOLHIDO" as const,
        viewerHeight: 320,
        activeNoteId: null,
      },
      abas: abas
        .filter((aba) => !aba.note.deletedAt)
        .map((aba) => ({
          id: aba.id,
          noteId: aba.noteId,
          title: aba.note.title,
          color: aba.note.color,
          isPinned: aba.isPinned,
          isActive: aba.isActive,
        })),
    },
  };
}

export async function AbrirAbaNota(input: AbrirAbaNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = abrirAbaNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  if (!(await podeVisualizarNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão para abrir esta nota" };
  }

  const maiorPosicao = await db.userOpenNoteTab.aggregate({
    where: { userId: usuario.id },
    _max: { position: true },
  });

  await db.$transaction([
    db.userOpenNoteTab.updateMany({ where: { userId: usuario.id }, data: { isActive: false } }),
    db.userOpenNoteTab.upsert({
      where: { userId_noteId: { userId: usuario.id, noteId: parsed.data.noteId } },
      create: {
        userId: usuario.id,
        noteId: parsed.data.noteId,
        position: (maiorPosicao._max.position ?? -1) + 1,
        isActive: true,
      },
      update: { isActive: true },
    }),
  ]);

  return { success: true as const };
}

export async function FecharAbaNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  // Abas fixadas não fecham pelo fluxo normal (mesma regra aplicada no store client) —
  // reforçado aqui para não depender só da UI esconder o botão de fechar.
  await db.userOpenNoteTab.deleteMany({ where: { userId: usuario.id, noteId, isPinned: false } });
  return { success: true as const };
}

export async function AtivarAbaNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  await db.$transaction([
    db.userOpenNoteTab.updateMany({ where: { userId: usuario.id }, data: { isActive: false } }),
    db.userOpenNoteTab.updateMany({
      where: { userId: usuario.id, noteId },
      data: { isActive: true },
    }),
  ]);

  return { success: true as const };
}

export async function ReordenarAbasNotas(input: ReordenarAbasNotasInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = reordenarAbasNotasSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  await db.$transaction(
    parsed.data.ordemNoteIds.map((noteId, index) =>
      db.userOpenNoteTab.updateMany({
        where: { userId: usuario.id, noteId },
        data: { position: index },
      }),
    ),
  );

  return { success: true as const };
}

export async function AtualizarWorkspaceNotas(input: AtualizarWorkspaceInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = atualizarWorkspaceSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  await db.userNotesWorkspace.upsert({
    where: { userId: usuario.id },
    create: {
      userId: usuario.id,
      isTaskbarVisible: dados.isTaskbarVisible ?? true,
      viewerMode: dados.viewerMode ?? "RECOLHIDO",
      viewerHeight: dados.viewerHeight ?? 320,
      activeNoteId: dados.activeNoteId ?? null,
    },
    update: {
      isTaskbarVisible: dados.isTaskbarVisible,
      viewerMode: dados.viewerMode,
      viewerHeight: dados.viewerHeight,
      activeNoteId: dados.activeNoteId,
    },
  });

  return { success: true as const };
}
