"use server";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { usuarioEhDiretoriaBpm } from "@/lib/bpm/boas-vindas";
import { listarPendenciasBpm } from "@/lib/bpm/pendencias/motor";

export async function ListarPendenciasBpm() {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado", data: [] };
    const userId = Number(session.user.id);
    const role = session.user.role ?? null;
    const isAdminOuDiretoria = isAdminRole(role) || usuarioEhDiretoriaBpm(role);
    const itens = await listarPendenciasBpm(userId, isAdminOuDiretoria, db);
    return { success: true as const, data: itens };
  } catch (error) {
    console.error("[ListarPendenciasBpm]", error);
    return { success: false as const, error: "Erro ao carregar pendências", data: [] };
  }
}
