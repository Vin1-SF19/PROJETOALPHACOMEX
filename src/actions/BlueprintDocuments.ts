"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { salvarDocumentoSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";
import { persistirDocumentoBlueprint } from "@/lib/blueprint/documento-persistencia";
import { erroSqliteBusy, repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";

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
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    const userId = Number(session.user.id);
    const parsed = salvarDocumentoSchema.safeParse(dados);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    const input = parsed.data;
    await exigirAcessoBlueprint(input.projectId, userId, session.user.role ?? null, "editarDocumento");

    const executar = () => db.$transaction(async (tx) => {
      await exigirAcessoBlueprint(input.projectId, userId, session.user.role ?? null, "editarDocumento", tx);
      return persistirDocumentoBlueprint(tx, input, userId);
    });
    let resultado;
    try {
      resultado = await repetirTransacaoOcupada(executar);
    } catch (error) {
      // Duas primeiras tentativas com a mesma PK podem disputar a criação.
      // O erro de unicidade reverte a transação; a nova leitura resolve a intenção.
      const codigo = error && typeof error === "object" && "code" in error ? error.code : null;
      if (input.documentId || codigo !== "P2002") throw error;
      resultado = await repetirTransacaoOcupada(executar);
    }
    if (!resultado.success) return resultado;
    try { revalidatePath(`/PainelAlpha/AlphaBlueprint/${input.projectId}`); }
    catch (error) { console.error("[SalvarDocumentoBlueprint/cache]", error); }
    return resultado;
  } catch (error) {
    console.error("[SalvarDocumentoBlueprint]", error);
    const mensagem = error instanceof Error ? error.message : "";
    return {
      success: false as const,
      error: ["Não autorizado", "Documento não encontrado", "CONFLITO_DOCUMENTO"].includes(mensagem)
        ? mensagem : erroSqliteBusy(error) ? "O banco está ocupado. Seu rascunho foi preservado; tente novamente." : "Erro ao salvar documento",
    };
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
