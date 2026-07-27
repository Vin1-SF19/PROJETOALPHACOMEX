"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { criarRequisitoSchema, atualizarRequisitoSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

function gerarCodigoRequisito(sequencial: number): string {
  return `REQ-${String(sequencial).padStart(3, "0")}`;
}

export async function ListarRequisitosBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const requisitos = await db.blueprintRequirement.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: requisitos };
  } catch (error) {
    console.error("[ListarRequisitosBlueprint]", error);
    return { success: false, error: "Erro ao buscar requisitos", data: [] };
  }
}

export async function CriarRequisitoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = criarRequisitoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, ...campos } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "criarRequisito");

    const requisito = await db.$transaction(async (tx) => {
      const total = await tx.blueprintRequirement.count({ where: { projectId } });
      const novo = await tx.blueprintRequirement.create({
        data: { projectId, code: gerarCodigoRequisito(total + 1), ...campos, createdById: userId },
      });
      await tx.blueprintActivity.create({
        data: { projectId, userId, action: "CRIACAO", entityType: "REQUISITO", entityId: novo.id },
      });
      return novo;
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: requisito };
  } catch (error) {
    console.error("[CriarRequisitoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao criar requisito";
    return { success: false, error: msg };
  }
}

export async function AtualizarRequisitoBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = atualizarRequisitoSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { requirementId, ...campos } = parsed.data;

    const requisito = await db.blueprintRequirement.findUnique({ where: { id: requirementId } });
    if (!requisito) return { success: false, error: "Requisito não encontrado" };

    await exigirAcessoBlueprint(requisito.projectId, userId, session.user.role ?? null, "criarRequisito");

    const atualizado = await db.blueprintRequirement.update({ where: { id: requirementId }, data: campos });

    await db.blueprintActivity.create({
      data: {
        projectId: requisito.projectId,
        userId,
        action: "ATUALIZACAO",
        entityType: "REQUISITO",
        entityId: requirementId,
        previousValueJson: JSON.stringify({ status: requisito.status }),
        newValueJson: JSON.stringify({ status: atualizado.status }),
      },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${requisito.projectId}`);
    return { success: true, data: atualizado };
  } catch (error) {
    console.error("[AtualizarRequisitoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao atualizar requisito";
    return { success: false, error: msg };
  }
}

export async function ExcluirRequisitoBlueprint(requirementId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const requisito = await db.blueprintRequirement.findUnique({ where: { id: requirementId } });
    if (!requisito) return { success: false, error: "Requisito não encontrado" };

    await exigirAcessoBlueprint(requisito.projectId, userId, session.user.role ?? null, "criarRequisito");

    await db.blueprintRequirement.delete({ where: { id: requirementId } });
    await db.blueprintActivity.create({
      data: { projectId: requisito.projectId, userId, action: "EXCLUSAO", entityType: "REQUISITO", entityId: requirementId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${requisito.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[ExcluirRequisitoBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao excluir requisito";
    return { success: false, error: msg };
  }
}

/** Converte um trecho de texto (documento/canvas/comentário/pergunta) em requisito rastreável. */
export async function ConverterSelecaoEmRequisitoBlueprint(dados: {
  projectId: string;
  title: string;
  description?: string;
  type: string;
  sourceType: string;
  sourceId?: string;
}) {
  const parsed = criarRequisitoSchema.safeParse({
    projectId: dados.projectId,
    title: dados.title,
    description: dados.description,
    type: dados.type,
    sourceType: dados.sourceType,
    sourceId: dados.sourceId,
  });
  if (!parsed.success) return { success: false, error: parsed.error.flatten() };
  return CriarRequisitoBlueprint(parsed.data);
}
