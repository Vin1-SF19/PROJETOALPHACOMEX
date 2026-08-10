"use server";
import db from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "../../auth";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
  compartilharNotaSchema,
  removerAcessoNotaSchema,
  type CompartilharNotaInput,
  type RemoverAcessoNotaInput,
} from "@/lib/validations/notas";
import {
  podeCompartilharNota,
  podeAlterarPermissoesNota,
  podeComentarNota,
  podeConsultarHistoricoNota,
  podeRestaurarVersaoNota,
  podeVisualizarNota,
} from "@/lib/notas/permissoes";
import { canalNotasDoUsuario } from "@/lib/notas/notificacoes";
import { isAdminRole } from "@/lib/roles";
import { z } from "zod";

async function sessaoUsuario() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: Number(session.user.id), role: session.user.role ?? "", nome: session.user.nome ?? "Alguém" };
}

async function notificar(userId: number, evento: string, payload: object) {
  try {
    await pusherServer.trigger(canalNotasDoUsuario(userId), evento, payload);
  } catch (error) {
    console.error("Falha ao enviar notificação de nota:", error);
  }
}

export async function CompartilharNota(input: CompartilharNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = compartilharNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  if (!(await podeCompartilharNota(usuario, dados.noteId))) {
    return { success: false as const, error: "Sem permissão para compartilhar esta nota" };
  }

  const nota = await db.note.findUnique({ where: { id: dados.noteId }, select: { title: true, visibility: true } });
  if (!nota) return { success: false as const, error: "Nota não encontrada" };

  if (dados.subjectType === "USUARIO") {
    const destinatarioIdValidacao = Number(dados.subjectId);
    if (!Number.isSafeInteger(destinatarioIdValidacao)) {
      return { success: false as const, error: "Usuário de destino inválido" };
    }
    const usuarioDestino = await db.usuarios.findUnique({ where: { id: destinatarioIdValidacao }, select: { id: true } });
    if (!usuarioDestino) {
      return { success: false as const, error: "Usuário de destino não encontrado" };
    }
  }

  await db.notePermission.upsert({
    where: { noteId_subjectType_subjectId: { noteId: dados.noteId, subjectType: dados.subjectType, subjectId: dados.subjectId } },
    create: { noteId: dados.noteId, subjectType: dados.subjectType, subjectId: dados.subjectId, role: dados.role, createdById: usuario.id },
    update: { role: dados.role },
  });

  if (nota.visibility === "PRIVADA") {
    await db.note.update({ where: { id: dados.noteId }, data: { visibility: "COMPARTILHADA" } });
  }

  if (dados.subjectType === "USUARIO") {
    const destinatarioId = Number(dados.subjectId);
    if (Number.isSafeInteger(destinatarioId) && destinatarioId !== usuario.id) {
      await notificar(destinatarioId, "nota-compartilhada", {
        noteId: dados.noteId,
        noteTitle: nota.title,
        tipo: "COMPARTILHADA",
        mensagem: `compartilhou a nota "${nota.title || "Sem título"}" com você`,
        autorNome: usuario.nome,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { success: true as const };
}

export async function RemoverAcessoNota(input: RemoverAcessoNotaInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = removerAcessoNotaSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  const permissao = await db.notePermission.findUnique({
    where: { id: parsed.data.permissionId },
    select: { noteId: true },
  });
  if (!permissao) return { success: false as const, error: "Permissão não encontrada" };

  if (!(await podeAlterarPermissoesNota(usuario, permissao.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.notePermission.delete({ where: { id: parsed.data.permissionId } });
  return { success: true as const };
}

export async function ListarPermissoesNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  if (!(await podeVisualizarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão", data: [] };
  }

  const permissoes = await db.notePermission.findMany({ where: { noteId }, orderBy: { createdAt: "asc" } });

  const idsUsuarios = permissoes
    .filter((p) => p.subjectType === "USUARIO")
    .map((p) => Number(p.subjectId))
    .filter((id) => Number.isSafeInteger(id));

  const usuariosEncontrados = idsUsuarios.length
    ? await db.usuarios.findMany({ where: { id: { in: idsUsuarios } }, select: { id: true, nome: true } })
    : [];
  const nomesPorId = new Map(usuariosEncontrados.map((u) => [u.id, u.nome]));

  const permissoesComNome = permissoes.map((permissao) => ({
    ...permissao,
    subjectDisplayName:
      permissao.subjectType === "USUARIO"
        ? (nomesPorId.get(Number(permissao.subjectId)) ?? `Usuário #${permissao.subjectId}`)
        : permissao.subjectId,
  }));

  return { success: true as const, data: permissoesComNome };
}

export async function TransferirPropriedadeNota(input: { noteId: string; novoOwnerId: number }) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const schema = z.object({ noteId: z.string().min(1), novoOwnerId: z.number().int().positive() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  const nota = await db.note.findUnique({ where: { id: parsed.data.noteId }, select: { ownerId: true } });
  if (!nota) return { success: false as const, error: "Nota não encontrada" };

  const ehDono = nota.ownerId === usuario.id;
  if (!ehDono && !isAdminRole(usuario.role)) {
    return { success: false as const, error: "Somente o dono ou um administrador pode transferir a propriedade" };
  }

  const novoDono = await db.usuarios.findUnique({ where: { id: parsed.data.novoOwnerId }, select: { id: true } });
  if (!novoDono) return { success: false as const, error: "Usuário de destino não encontrado" };

  await db.note.update({ where: { id: parsed.data.noteId }, data: { ownerId: parsed.data.novoOwnerId } });
  return { success: true as const };
}

const criarComentarioSchema = z.object({
  noteId: z.string().min(1),
  content: z.string().trim().min(1).max(4000),
  parentId: z.string().min(1).optional(),
  mencoesUserIds: z.array(z.number().int().positive()).max(20).optional(),
});
type CriarComentarioInput = z.infer<typeof criarComentarioSchema>;

export async function CriarComentarioNota(input: CriarComentarioInput) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const parsed = criarComentarioSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };
  const dados = parsed.data;

  const nota = await db.note.findUnique({ where: { id: dados.noteId }, select: { title: true, visibility: true, ownerId: true } });
  if (!nota) return { success: false as const, error: "Nota não encontrada" };

  if (nota.visibility === "PRIVADA" && nota.ownerId !== usuario.id) {
    return { success: false as const, error: "Notas privadas não têm comentários" };
  }
  if (!(await podeComentarNota(usuario, dados.noteId))) {
    return { success: false as const, error: "Sem permissão para comentar" };
  }

  const comentario = await db.noteComment.create({
    data: { noteId: dados.noteId, authorId: usuario.id, content: dados.content, parentId: dados.parentId ?? null },
  });

  if (nota.ownerId !== usuario.id) {
    await notificar(nota.ownerId, "nota-comentario", {
      noteId: dados.noteId,
      noteTitle: nota.title,
      tipo: "COMENTARIO",
      mensagem: "comentou na sua nota",
      autorNome: usuario.nome,
      createdAt: new Date().toISOString(),
    });
  }

  // Menções (Seção 16): notifica só quem já tem acesso; quem não tem, a UI oferece compartilhar
  // separadamente (NoteCommentsPanel) — nunca se envia conteúdo da nota na notificação.
  for (const mencionadoId of dados.mencoesUserIds ?? []) {
    if (mencionadoId === usuario.id) continue;

    const mencionado = await db.usuarios.findUnique({ where: { id: mencionadoId }, select: { role: true } });
    if (!mencionado) continue;

    const temAcesso = await podeVisualizarNota({ id: mencionadoId, role: mencionado.role }, dados.noteId);
    if (!temAcesso) continue;

    await notificar(mencionadoId, "nota-mencao", {
      noteId: dados.noteId,
      noteTitle: nota.title,
      tipo: "MENCAO",
      mensagem: "mencionou você em um comentário",
      autorNome: usuario.nome,
      createdAt: new Date().toISOString(),
    });
  }

  return { success: true as const, data: comentario };
}

export async function ListarComentariosNota(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  if (!(await podeVisualizarNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão", data: [] };
  }

  const comentarios = await db.noteComment.findMany({
    where: { noteId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, nome: true } } },
  });

  return { success: true as const, data: comentarios };
}

export async function ResolverComentario(commentId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const comentario = await db.noteComment.findUnique({ where: { id: commentId }, select: { noteId: true } });
  if (!comentario) return { success: false as const, error: "Comentário não encontrado" };

  if (!(await podeComentarNota(usuario, comentario.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  await db.noteComment.update({ where: { id: commentId }, data: { isResolved: true } });
  return { success: true as const };
}

export async function ExcluirComentarioNota(commentId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const comentario = await db.noteComment.findUnique({ where: { id: commentId }, select: { noteId: true, authorId: true } });
  if (!comentario) return { success: false as const, error: "Comentário não encontrado" };

  const podeExcluir = comentario.authorId === usuario.id || isAdminRole(usuario.role) || (await podeAlterarPermissoesNota(usuario, comentario.noteId));
  if (!podeExcluir) return { success: false as const, error: "Sem permissão" };

  await db.noteComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  return { success: true as const };
}

export async function ObterHistoricoVersoes(noteId: string) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado", data: [] };

  if (!(await podeConsultarHistoricoNota(usuario, noteId))) {
    return { success: false as const, error: "Sem permissão", data: [] };
  }

  const versoes = await db.noteVersion.findMany({
    where: { noteId },
    orderBy: { version: "desc" },
    include: { changedBy: { select: { id: true, nome: true } } },
  });

  return { success: true as const, data: versoes };
}

export async function RestaurarVersaoNota(input: { noteId: string; version: number }) {
  const usuario = await sessaoUsuario();
  if (!usuario) return { success: false as const, error: "Não autorizado" };

  const schema = z.object({ noteId: z.string().min(1), version: z.number().int().positive() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Dados inválidos" };

  if (!(await podeRestaurarVersaoNota(usuario, parsed.data.noteId))) {
    return { success: false as const, error: "Sem permissão" };
  }

  const versaoAlvo = await db.noteVersion.findUnique({
    where: { noteId_version: { noteId: parsed.data.noteId, version: parsed.data.version } },
  });
  if (!versaoAlvo) return { success: false as const, error: "Versão não encontrada" };

  const notaAtual = await db.note.findUnique({ where: { id: parsed.data.noteId }, select: { currentVersion: true, ownerId: true, title: true } });
  if (!notaAtual) return { success: false as const, error: "Nota não encontrada" };

  const novaVersao = notaAtual.currentVersion + 1;
  const conteudoRestaurado = (versaoAlvo.contentJson ?? {}) as Prisma.InputJsonValue;

  await db.$transaction([
    db.note.update({
      where: { id: parsed.data.noteId },
      data: {
        title: versaoAlvo.title,
        contentJson: conteudoRestaurado,
        plainText: versaoAlvo.plainText,
        currentVersion: novaVersao,
        updatedById: usuario.id,
      },
    }),
    db.noteVersion.create({
      data: {
        noteId: parsed.data.noteId,
        version: novaVersao,
        title: versaoAlvo.title,
        contentJson: conteudoRestaurado,
        plainText: versaoAlvo.plainText,
        changedById: usuario.id,
        changeSummary: `Restaurado a partir da versão ${parsed.data.version}`,
      },
    }),
  ]);

  if (notaAtual.ownerId !== usuario.id) {
    await notificar(notaAtual.ownerId, "nota-versao-restaurada", {
      noteId: parsed.data.noteId,
      noteTitle: notaAtual.title,
      tipo: "VERSAO_RESTAURADA",
      mensagem: `restaurou a versão ${parsed.data.version} da sua nota`,
      autorNome: usuario.nome,
      createdAt: new Date().toISOString(),
    });
  }

  return { success: true as const };
}
