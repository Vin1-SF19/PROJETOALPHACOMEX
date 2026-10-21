import "server-only";

import db from "@/lib/prisma";
import { materializarExecucoesEventosBpm } from "./eventos";
import { processarFilaAutomacoesCentraisBpm } from "./central-runtime";

/**
 * Flush síncrono e genérico das automações de um card. É usado em mutações que
 * historicamente devolvem efeitos imediatos ao usuário; definição e execução
 * continuam integralmente no Motor Central.
 */
export async function executarAutomacoesCentraisDoCardAgora(cardId: string) {
  const materializacao = await materializarExecucoesEventosBpm(100, db, { cardId });
  const fila = await processarFilaAutomacoesCentraisBpm(50, { cardId });
  return { materializacao, fila };
}

/** Somente a minuta do movimento recém-confirmado, inclusive no resgate da fila. */
export async function executarMinutaMovimentoLivreAgora(cardId: string, eventoId: string) {
  const escopo = { modo: "MINUTA_MOVIMENTO_LIVRE", cardId, eventoId } as const;
  const materializacao = await materializarExecucoesEventosBpm(100, db, escopo);
  const fila = await processarFilaAutomacoesCentraisBpm(50, escopo);
  return { materializacao, fila };
}
