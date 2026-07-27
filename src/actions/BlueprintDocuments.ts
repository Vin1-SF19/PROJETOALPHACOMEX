"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { salvarDocumentoSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

export async function ListarDocumentosBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const documentos = await db.blueprintDocument.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
    return { success: true, data: documentos };
  } catch (error) {
    console.error("[ListarDocumentosBlueprint]", error);
    return { success: false, error: "Erro ao buscar documentos", data: [] };
  }
}

export async function SalvarDocumentoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = salvarDocumentoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, documentId, title, contentJson, contentText } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarDocumento");

    if (documentId) {
      const existente = await db.blueprintDocument.findUnique({ where: { id: documentId }, select: { projectId: true } });
      if (!existente || existente.projectId !== projectId) return { success: false, error: "Documento não encontrado" };
    }

    const documento = documentId
      ? await db.blueprintDocument.update({
          where: { id: documentId },
          data: { title, contentJson, contentText, updatedById: userId },
        })
      : await db.blueprintDocument.create({
          data: { projectId, title, contentJson, contentText, createdById: userId },
        });

    await db.blueprintActivity.create({
      data: {
        projectId,
        userId,
        action: documentId ? "ATUALIZACAO" : "CRIACAO",
        entityType: "DOCUMENTO",
        entityId: documento.id,
      },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: documento };
  } catch (error) {
    console.error("[SalvarDocumentoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao salvar documento";
    return { success: false, error: msg };
  }
}

export async function ExcluirDocumentoBlueprint(documentId: string, projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "editarDocumento");

    const existente = await db.blueprintDocument.findUnique({ where: { id: documentId }, select: { projectId: true } });
    if (!existente || existente.projectId !== projectId) return { success: false, error: "Documento não encontrado" };

    await db.blueprintDocument.delete({ where: { id: documentId } });
    await db.blueprintActivity.create({
      data: { projectId, userId, action: "EXCLUSAO", entityType: "DOCUMENTO", entityId: documentId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirDocumentoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir documento";
    return { success: false, error: msg };
  }
}
