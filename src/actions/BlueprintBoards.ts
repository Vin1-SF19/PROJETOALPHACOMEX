"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { salvarBoardSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

export async function ListarBoardsBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const boards = await db.blueprintBoard.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: boards };
  } catch (error) {
    console.error("[ListarBoardsBlueprint]", error);
    return { success: false, error: "Erro ao buscar canvas", data: [] };
  }
}

export async function SalvarBoardBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = salvarBoardSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, boardId, title, viewportJson, elementsJson, version } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarCanvas");

    if (boardId) {
      // Controle de conflito otimista: se a versão enviada não bate com a atual, o cliente
      // está editando uma versão desatualizada (outra aba/usuário salvou depois).
      const atual = await db.blueprintBoard.findUnique({ where: { id: boardId }, select: { version: true, projectId: true } });
      if (!atual || atual.projectId !== projectId) return { success: false, error: "Canvas não encontrado" };
      if (version !== undefined && atual.version !== version) {
        return { success: false, error: "Conflito de versão — o canvas foi alterado em outra sessão. Recarregue antes de salvar." };
      }

      const board = await db.blueprintBoard.update({
        where: { id: boardId },
        data: { title, viewportJson, elementsJson, version: { increment: 1 }, updatedById: userId },
      });
      return { success: true, data: board };
    }

    const board = await db.blueprintBoard.create({
      data: { projectId, title, viewportJson, elementsJson, createdById: userId },
    });

    await db.blueprintActivity.create({
      data: { projectId, userId, action: "CRIACAO", entityType: "CANVAS", entityId: board.id },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: board };
  } catch (error) {
    console.error("[SalvarBoardBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao salvar canvas";
    return { success: false, error: msg };
  }
}

export async function DuplicarBoardBlueprint(boardId: string, projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarCanvas");

    const original = await db.blueprintBoard.findUnique({ where: { id: boardId } });
    if (!original || original.projectId !== projectId) return { success: false, error: "Canvas não encontrado" };

    const copia = await db.blueprintBoard.create({
      data: {
        projectId,
        title: `${original.title} (cópia)`,
        viewportJson: original.viewportJson,
        elementsJson: original.elementsJson,
        createdById: userId,
      },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: copia };
  } catch (error) {
    console.error("[DuplicarBoardBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao duplicar canvas";
    return { success: false, error: msg };
  }
}

export async function ExcluirBoardBlueprint(boardId: string, projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarCanvas");

    const existente = await db.blueprintBoard.findUnique({ where: { id: boardId }, select: { projectId: true } });
    if (!existente || existente.projectId !== projectId) return { success: false, error: "Canvas não encontrado" };

    const totalBoards = await db.blueprintBoard.count({ where: { projectId } });
    if (totalBoards <= 1) return { success: false, error: "Não é possível excluir o último canvas do projeto" };

    await db.blueprintBoard.delete({ where: { id: boardId } });
    await db.blueprintActivity.create({
      data: { projectId, userId, action: "EXCLUSAO", entityType: "CANVAS", entityId: boardId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirBoardBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir canvas";
    return { success: false, error: msg };
  }
}
