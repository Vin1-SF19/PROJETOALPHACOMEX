"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { criarComentarioSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

export async function ListarComentariosBlueprint(projectId: string, targetType?: string, targetId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const comentarios = await db.blueprintComment.findMany({
      where: { projectId, ...(targetType ? { targetType, targetId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: comentarios };
  } catch (error) {
    console.error("[ListarComentariosBlueprint]", error);
    return { success: false, error: "Erro ao buscar comentários", data: [] };
  }
}

export async function CriarComentarioBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarComentarioSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, ...campos } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const comentario = await db.$transaction(async (tx) => {
      const novo = await tx.blueprintComment.create({
        data: { projectId, ...campos, authorId: userId },
      });
      await tx.blueprintActivity.create({
        data: { projectId, userId, action: "CRIACAO", entityType: "COMENTARIO", entityId: novo.id },
      });
      return novo;
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: comentario };
  } catch (error) {
    console.error("[CriarComentarioBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao criar comentário";
    return { success: false, error: msg };
  }
}

export async function ResolverComentarioBlueprint(commentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const comentario = await db.blueprintComment.findUnique({ where: { id: commentId } });
    if (!comentario) return { success: false, error: "Comentário não encontrado" };

    await exigirAcessoBlueprint(comentario.projectId, userId, session.user.role ?? null, "visualizar");

    const atualizado = await db.blueprintComment.update({
      where: { id: commentId },
      data: { resolved: true, resolvedById: userId, resolvedAt: new Date() },
    });

    await db.blueprintActivity.create({
      data: { projectId: comentario.projectId, userId, action: "RESOLUCAO", entityType: "COMENTARIO", entityId: commentId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${comentario.projectId}`);
    return { success: true, data: atualizado };
  } catch (error) {
    console.error("[ResolverComentarioBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao resolver comentário";
    return { success: false, error: msg };
  }
}

export async function ReabrirComentarioBlueprint(commentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const comentario = await db.blueprintComment.findUnique({ where: { id: commentId } });
    if (!comentario) return { success: false, error: "Comentário não encontrado" };

    await exigirAcessoBlueprint(comentario.projectId, userId, session.user.role ?? null, "visualizar");

    await db.blueprintComment.update({ where: { id: commentId }, data: { resolved: false, resolvedById: null, resolvedAt: null } });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${comentario.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ReabrirComentarioBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao reabrir comentário";
    return { success: false, error: msg };
  }
}

export async function EditarComentarioBlueprint(commentId: string, content: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const comentario = await db.blueprintComment.findUnique({ where: { id: commentId } });
    if (!comentario) return { success: false, error: "Comentário não encontrado" };
    if (comentario.authorId !== userId) return { success: false, error: "Só o autor pode editar o próprio comentário" };

    const conteudo = content.trim().slice(0, 4000);
    if (!conteudo) return { success: false, error: "Comentário não pode ficar vazio" };

    const atualizado = await db.blueprintComment.update({ where: { id: commentId }, data: { content: conteudo } });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${comentario.projectId}`);
    return { success: true, data: atualizado };
  } catch (error) {
    console.error("[EditarComentarioBlueprint]", error);
    return { success: false, error: "Erro ao editar comentário" };
  }
}

export async function ExcluirComentarioBlueprint(commentId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const comentario = await db.blueprintComment.findUnique({ where: { id: commentId } });
    if (!comentario) return { success: false, error: "Comentário não encontrado" };

    const acesso = await exigirAcessoBlueprint(comentario.projectId, userId, session.user.role ?? null, "visualizar");
    const podeExcluir = comentario.authorId === userId || acesso.isAdminGlobal || acesso.role === "PROPRIETARIO" || acesso.role === "ADMINISTRADOR";
    if (!podeExcluir) return { success: false, error: "Não autorizado" };

    await db.blueprintComment.delete({ where: { id: commentId } });
    await db.blueprintActivity.create({
      data: { projectId: comentario.projectId, userId, action: "EXCLUSAO", entityType: "COMENTARIO", entityId: commentId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${comentario.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirComentarioBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir comentário";
    return { success: false, error: msg };
  }
}
