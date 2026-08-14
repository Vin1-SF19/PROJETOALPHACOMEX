import "server-only";

import db from "@/lib/prisma";

/**
 * Internal audit writer. This is deliberately not a Server Action: callers must
 * authorize the card operation before writing its history.
 */
export async function registrarHistoricoCard(params: {
  cardId: string;
  acao: string;
  usuarioId?: number;
  automacaoOrigem?: string;
  valorAnteriorJson?: string;
  valorNovoJson?: string;
}, client: Pick<typeof db, "bpmCardHistorico"> = db) {
  await client.bpmCardHistorico.create({ data: params });
}
