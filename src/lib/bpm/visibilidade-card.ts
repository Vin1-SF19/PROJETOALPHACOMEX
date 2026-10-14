import type { Prisma } from "@prisma/client";

/** Responsável já é vínculo, mesmo quando falta uma linha legada de membro.
 * Cards reais exigem responsável; leads ainda sem vínculo vêm do staging NoLoss.
 * Nunca interpretar membros.none como um card livre com responsável atribuído.
 */
export function filtroVinculoCardBpm(userId: number, admin: boolean): Prisma.BpmCardWhereInput {
  return admin ? {} : { AND: [{ OR: [{ responsavelId: userId }, { membros: { some: { userId } } }] }] };
}
