import type { Prisma } from "@prisma/client";

/** Responsável já é vínculo, mesmo quando falta uma linha legada de membro.
 * Cards reais exigem responsável; leads ainda sem vínculo vêm do staging NoLoss.
 * Nunca interpretar membros.none como um card livre com responsável atribuído.
 */
export function filtroVinculoCardBpm(userId: number, admin: boolean, equipeIds: number[] = []): Prisma.BpmCardWhereInput {
  return admin ? {} : { AND: [{ OR: [{ responsavelId: userId }, { membros: { some: { userId } } }, ...(equipeIds.length ? [{ responsavelId: { in: equipeIds } }, { membros: { some: { userId: { in: equipeIds } } } }] : [])] }] };
}
