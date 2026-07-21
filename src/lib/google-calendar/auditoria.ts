import db from "@/lib/prisma";

/** Auditoria best-effort — nunca bloqueia a operação principal por falha ao gravar. */
export async function registrarAuditoriaCalendarioAlpha(userId: number, acao: string, detalhes?: string): Promise<void> {
  try {
    await db.auditoria.create({
      data: { userId, acao, detalhes },
      select: { id: true },
    });
  } catch {
    // Auditoria não deve expor dados nem alterar o resultado da operação.
  }
}
