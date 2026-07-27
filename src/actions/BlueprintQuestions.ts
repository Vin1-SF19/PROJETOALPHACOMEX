"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { criarPerguntaSchema, responderPerguntaSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

export async function ListarPerguntasBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const perguntas = await db.blueprintQuestion.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, data: perguntas };
  } catch (error) {
    console.error("[ListarPerguntasBlueprint]", error);
    return { success: false, error: "Erro ao buscar perguntas", data: [] };
  }
}

export async function CriarPerguntaBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarPerguntaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, ...campos } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const pergunta = await db.$transaction(async (tx) => {
      const nova = await tx.blueprintQuestion.create({
        data: { projectId, ...campos, authorId: userId },
      });
      await tx.blueprintActivity.create({
        data: { projectId, userId, action: "CRIACAO", entityType: "PERGUNTA", entityId: nova.id },
      });
      return nova;
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: pergunta };
  } catch (error) {
    console.error("[CriarPerguntaBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao criar pergunta";
    return { success: false, error: msg };
  }
}

export async function ResponderPerguntaBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = responderPerguntaSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { questionId, answer } = parsed.data;

    const pergunta = await db.blueprintQuestion.findUnique({ where: { id: questionId } });
    if (!pergunta) return { success: false, error: "Pergunta não encontrada" };

    await exigirAcessoBlueprint(pergunta.projectId, userId, session.user.role ?? null, "visualizar");

    const atualizada = await db.blueprintQuestion.update({
      where: { id: questionId },
      data: { answer, status: "RESPONDIDA", answeredById: userId, answeredAt: new Date() },
    });

    await db.blueprintActivity.create({
      data: { projectId: pergunta.projectId, userId, action: "RESPOSTA", entityType: "PERGUNTA", entityId: questionId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${pergunta.projectId}`);
    return { success: true, data: atualizada };
  } catch (error) {
    console.error("[ResponderPerguntaBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao responder pergunta";
    return { success: false, error: msg };
  }
}

export async function ResolverPerguntaBlueprint(questionId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const pergunta = await db.blueprintQuestion.findUnique({ where: { id: questionId } });
    if (!pergunta) return { success: false, error: "Pergunta não encontrada" };

    await exigirAcessoBlueprint(pergunta.projectId, userId, session.user.role ?? null, "visualizar");

    await db.blueprintQuestion.update({ where: { id: questionId }, data: { status: "RESOLVIDA" } });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${pergunta.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ResolverPerguntaBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao resolver pergunta";
    return { success: false, error: msg };
  }
}
