"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { adicionarMembroSchema, atualizarMembroRoleSchema } from "@/lib/validations/blueprint";
import { exigirAcessoBlueprint } from "@/lib/blueprint/ownership";

export async function ListarMembrosBlueprint(projectId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "visualizar");

    const membros = await db.blueprintMember.findMany({
      where: { projectId },
      include: { usuario: { select: { id: true, nome: true, imagemUrl: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { success: true, data: membros };
  } catch (error) {
    console.error("[ListarMembrosBlueprint]", error);
    return { success: false, error: "Erro ao buscar membros", data: [] };
  }
}

export async function AdicionarMembroBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = adicionarMembroSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { projectId, userId: novoUserId, role } = parsed.data;

    await exigirAcessoBlueprint(projectId, userId, session.user.role ?? null, "adicionarParticipantes");

    const usuarioExiste = await db.usuarios.findUnique({ where: { id: novoUserId }, select: { id: true } });
    if (!usuarioExiste) return { success: false, error: "Usuário não encontrado" };

    const membro = await db.blueprintMember.upsert({
      where: { projectId_userId: { projectId, userId: novoUserId } },
      create: { projectId, userId: novoUserId, role, addedById: userId },
      update: { role },
    });

    await db.blueprintActivity.create({
      data: { projectId, userId, action: "ADICAO_MEMBRO", entityType: "MEMBRO", entityId: membro.id, newValueJson: JSON.stringify({ userId: novoUserId, role }) },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${projectId}`);
    return { success: true, data: membro };
  } catch (error) {
    console.error("[AdicionarMembroBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao adicionar membro";
    return { success: false, error: msg };
  }
}

export async function AtualizarRoleMembroBlueprint(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const parsed = atualizarMembroRoleSchema.safeParse(dados);
    if (!parsed.success) return { success: false, error: parsed.error.flatten() };
    const { memberId, role } = parsed.data;

    const membro = await db.blueprintMember.findUnique({ where: { id: memberId } });
    if (!membro) return { success: false, error: "Membro não encontrado" };

    await exigirAcessoBlueprint(membro.projectId, userId, session.user.role ?? null, "adicionarParticipantes");

    if (membro.role === "PROPRIETARIO" && role !== "PROPRIETARIO") {
      const outrosProprietarios = await db.blueprintMember.count({
        where: { projectId: membro.projectId, role: "PROPRIETARIO", id: { not: memberId } },
      });
      if (outrosProprietarios === 0) {
        return { success: false, error: "O projeto precisa de ao menos um Proprietário" };
      }
    }

    const atualizado = await db.blueprintMember.update({ where: { id: memberId }, data: { role } });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${membro.projectId}`);
    return { success: true, data: atualizado };
  } catch (error) {
    console.error("[AtualizarRoleMembroBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao atualizar membro";
    return { success: false, error: msg };
  }
}

export async function RemoverMembroBlueprint(memberId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };
    const userId = Number(session.user.id);

    const membro = await db.blueprintMember.findUnique({ where: { id: memberId } });
    if (!membro) return { success: false, error: "Membro não encontrado" };

    await exigirAcessoBlueprint(membro.projectId, userId, session.user.role ?? null, "adicionarParticipantes");

    if (membro.role === "PROPRIETARIO") {
      const outrosProprietarios = await db.blueprintMember.count({
        where: { projectId: membro.projectId, role: "PROPRIETARIO", id: { not: memberId } },
      });
      if (outrosProprietarios === 0) {
        return { success: false, error: "O projeto precisa de ao menos um Proprietário" };
      }
    }

    await db.blueprintMember.delete({ where: { id: memberId } });
    await db.blueprintActivity.create({
      data: { projectId: membro.projectId, userId, action: "REMOCAO_MEMBRO", entityType: "MEMBRO", entityId: memberId },
    });

    revalidatePath(`/PainelAlpha/AlphaBlueprint/${membro.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("[RemoverMembroBlueprint]", error);
    const msg = error instanceof Error && error.message === "Não autorizado" ? "Não autorizado" : "Erro ao remover membro";
    return { success: false, error: msg };
  }
}
