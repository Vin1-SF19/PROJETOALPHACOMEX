import db from "@/lib/prisma";

/**
 * Reaproveita a tabela genérica `Auditoria` já usada pelo CS&NPS (ver
 * `src/lib/cs-nps/autorizacao.ts`, `registrarAuditoriaCsNpsBestEffort`) — nunca criar uma
 * tabela de auditoria paralela específica de Notas.
 */
/** Remove newlines/caracteres de controle de valores livres (ex: nome de arquivo) antes de gravar. */
function sanitizarDetalhes(detalhes: string): string {
  return detalhes.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 500);
}

export async function registrarAuditoriaNotaBestEffort(
  userId: number,
  acao: string,
  detalhes: string,
): Promise<void> {
  try {
    await db.auditoria.create({
      data: { userId, acao, detalhes: sanitizarDetalhes(detalhes) },
      select: { id: true },
    });
  } catch {
    // Auditoria não deve expor dados nem alterar o resultado da operação.
  }
}
