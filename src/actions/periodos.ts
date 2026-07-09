"use server";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { periodoInputSchema } from "@/lib/validations/extrato";

export async function CriarNovoPeriodo(mes: string, ano: string, extratoId: number) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado" };

    const parsed = periodoInputSchema.safeParse({ mes, ano, extratoId });
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos" };
    }
    const input = parsed.data;

    const novo = await db.periodosAnalise.create({
      data: {
        mes: input.mes,
        ano: input.ano,
        extratoId: input.extratoId,
      },
    });

    revalidatePath(`/PainelAlpha/ExtratosBancarios/${input.extratoId}`);
    return { success: true, data: novo };
  } catch (error) {
    console.error("[CriarNovoPeriodo]", error);
    return { success: false, error: "Erro ao criar período." };
  }
}
