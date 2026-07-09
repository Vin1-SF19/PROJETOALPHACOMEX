"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { bancoInputSchema } from "@/lib/validations/extrato";

export async function VincularNovoBanco(dados: unknown) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = bancoInputSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos" };
    }
    const input = parsed.data;

    await db.bancosVinculados.create({
      data: {
        bancoId: input.bancoId,
        nomeBanco: input.nome,
        logo: input.logo,
        descricao: input.descricao || null,
        periodoId: input.periodoId,
      },
    });

    revalidatePath(`/PainelAlpha/ExtratosBancarios`);
    return { success: true };
  } catch (error) {
    console.error("[VincularNovoBanco]", error);
    return { success: false, error: "Erro interno." };
  }
}

export async function AtualizarAnotacaoBanco(id: number, anotacao: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const idNumerico = Number(id);
    if (isNaN(idNumerico)) return { success: false, error: "Id inválido." };

    await db.bancosVinculados.update({
      where: { id: idNumerico },
      data: { anotacao: String(anotacao ?? "").slice(0, 500) },
    });
    return { success: true };
  } catch (error) {
    console.error("[AtualizarAnotacaoBanco]", error);
    return { success: false, error: "Erro ao salvar anotação." };
  }
}

export async function ExcluirBancoVinculado(bancoId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const idNumerico = Number(bancoId);
    if (isNaN(idNumerico)) return { success: false, error: "Id inválido." };

    await db.bancosVinculados.delete({ where: { id: idNumerico } });
    return { success: true };
  } catch (error) {
    console.error("[ExcluirBancoVinculado]", error);
    return { success: false, error: "Erro ao excluir banco." };
  }
}
