"use server";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { extractCardTimelineEvents } from "@/lib/timeline/extractors/card";

export async function ListarTimelineCardBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    await exigirAcessoBpmCard(cardId, userId, session.user.role ?? null, "visualizarHistorico");
    const eventos = await extractCardTimelineEvents(cardId, db);
    return { success: true as const, data: eventos };
  } catch (error) {
    console.error("[ListarTimelineCardBpm]", error);
    const msg = error instanceof Error && error.message.includes("autorizad") ? error.message : "Erro ao carregar linha do tempo";
    return { success: false as const, error: msg, data: [] };
  }
}
