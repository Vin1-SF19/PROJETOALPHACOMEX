"use server";

import { z } from "zod";
import { auth } from "../../../auth";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { gerarFichaViabilidadeCardBpm } from "@/lib/bpm/ficha-viabilidade-server";

export async function GerarFichaViabilidadeBpm(dados: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
  const parsed = z.object({ cardId: z.string().min(1) }).safeParse(dados);
  if (!parsed.success) return { success: false as const, error: "Card inválido" };
  try {
    await exigirAcessoBpmCard(parsed.data.cardId, Number(session.user.id), session.user.role ?? null, "visualizar");
    return { success: true as const, data: await gerarFichaViabilidadeCardBpm(parsed.data.cardId) };
  } catch (erro) {
    return { success: false as const, error: erro instanceof Error && erro.message === "Não autorizado"
      ? "Não autorizado" : "Não foi possível gerar a ficha de viabilidade" };
  }
}
