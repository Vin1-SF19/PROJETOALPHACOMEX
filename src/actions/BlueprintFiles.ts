"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { registrarArquivoSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

export async function ListarArquivosBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const arquivos = await db.blueprintFile.findMany({
      where: { projectId, archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: arquivos };
  } catch (error) {
    console.error("[ListarArquivosBlueprint]", error);
    return { success: false, error: "Erro ao buscar arquivos", data: [] };
  }
}

/**
 * Registra os metadados do arquivo já enviado ao Vercel Blob (o upload em si acontece
 * na Route Handler /api/blueprint/upload, que faz o `put()` e retorna a URL — esta action
 * só persiste o registro em BlueprintFile após o upload físico ter sucesso).
 */
export async function RegistrarArquivoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = registrarArquivoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, ...campos } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "enviarArquivo");

    const arquivo = await db.blueprintFile.create({
      data: { projectId, ...campos, uploadedById: userId },
    });

    await db.blueprintActivity.create({
      data: { projectId, userId, action: "UPLOAD", entityType: "ARQUIVO", entityId: arquivo.id, metadataJson: JSON.stringify({ nome: campos.name, mimeType: campos.mimeType }) },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: arquivo };
  } catch (error) {
    console.error("[RegistrarArquivoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao registrar arquivo";
    return { success: false, error: msg };
  }
}

export async function AtualizarArquivoBlueprint(fileId: string, projectId: string, dados: { name?: string; description?: string; category?: string }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "enviarArquivo");

    const existente = await db.blueprintFile.findUnique({ where: { id: fileId }, select: { projectId: true } });
    if (!existente || existente.projectId !== projectId) return { success: false, error: "Arquivo não encontrado" };

    const arquivo = await db.blueprintFile.update({
      where: { id: fileId },
      data: {
        name: dados.name?.trim().slice(0, 255),
        description: dados.description?.trim().slice(0, 1000),
        category: dados.category?.trim().slice(0, 60),
      },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: arquivo };
  } catch (error) {
    console.error("[AtualizarArquivoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao atualizar arquivo";
    return { success: false, error: msg };
  }
}

export async function ArquivarArquivoBlueprint(fileId: string, projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "excluirArquivo");

    const existente = await db.blueprintFile.findUnique({ where: { id: fileId }, select: { projectId: true } });
    if (!existente || existente.projectId !== projectId) return { success: false, error: "Arquivo não encontrado" };

    await db.blueprintFile.update({ where: { id: fileId }, data: { archivedAt: new Date() } });
    await db.blueprintActivity.create({
      data: { projectId, userId, action: "ARQUIVAMENTO", entityType: "ARQUIVO", entityId: fileId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ArquivarArquivoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao arquivar arquivo";
    return { success: false, error: msg };
  }
}

export async function ExcluirArquivoBlueprint(fileId: string, projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "excluirArquivo");

    const arquivo = await db.blueprintFile.findUnique({ where: { id: fileId } });
    if (!arquivo || arquivo.projectId !== projectId) return { success: false, error: "Arquivo não encontrado" };

    await db.blueprintFile.delete({ where: { id: fileId } });
    await db.blueprintActivity.create({
      data: { projectId, userId, action: "EXCLUSAO", entityType: "ARQUIVO", entityId: fileId, previousValueJson: JSON.stringify({ nome: arquivo.name }) },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirArquivoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir arquivo";
    return { success: false, error: msg };
  }
}
