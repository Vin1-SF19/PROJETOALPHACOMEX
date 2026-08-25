import "server-only";

import db from "@/lib/prisma";

/**
 * Busca os leads do NoLoss ainda pendentes de promoção. Visível a qualquer
 * usuário com acesso ao pipeline (spec confirmada: sem filtro de membro/admin,
 * diferente dos BpmCard reais) — ownership do pipeline é responsabilidade do
 * chamador (exigirAcessoBpmPipeline), esta função só lê o staging.
 */
export async function buscarNolossLeadsPendentes() {
  return db.nolossLead.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      receivedAt: true,
    },
    orderBy: { receivedAt: "asc" },
  });
}
