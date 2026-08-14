export interface CardDoBoardArrastavel {
  id: string;
  etapaId: string;
}

/**
 * Guarda a ordem completa do board antes de uma altera\u00e7\u00e3o otimista. O clone
 * superficial basta porque o board nunca altera objetos aninhados durante o drag:
 * somente `etapaId` \u00e9 substitu\u00eddo por um novo objeto de card.
 */
export function criarSnapshotBoard<T extends CardDoBoardArrastavel>(cards: readonly T[]): T[] {
  return cards.map((card) => ({ ...card }));
}

export function moverCardOtimistaNoBoard<T extends CardDoBoardArrastavel>(
  cards: readonly T[],
  cardId: string,
  etapaDestinoId: string,
): T[] {
  return cards.map((card) => (
    card.id === cardId ? { ...card, etapaId: etapaDestinoId } : card
  ));
}

/** Retorna uma nova c\u00f3pia para que a restaura\u00e7\u00e3o nunca reutilize o snapshot mut\u00e1vel. */
export function restaurarSnapshotBoard<T extends CardDoBoardArrastavel>(snapshot: readonly T[]): T[] {
  return criarSnapshotBoard(snapshot);
}

export type ResultadoMovimentoOtimistaBoard = "RESTAURADO" | "CONFIRMADO" | "SINCRONIZACAO_PENDENTE";

/**
 * O servidor que confirmou a movimentação é a fronteira de autoridade. Uma
 * falha posterior ao recarregar o board não pode transformar esse sucesso em
 * rollback local.
 */
export async function resolverMovimentoOtimistaBoard({
  mover,
  reconciliar,
  restaurar,
}: {
  mover: () => Promise<boolean>;
  reconciliar: () => Promise<boolean>;
  restaurar: () => Promise<void>;
}): Promise<ResultadoMovimentoOtimistaBoard> {
  let confirmado = false;
  try {
    confirmado = await mover();
  } catch {
    confirmado = false;
  }

  if (!confirmado) {
    await restaurar();
    return "RESTAURADO";
  }

  try {
    return (await reconciliar()) ? "CONFIRMADO" : "SINCRONIZACAO_PENDENTE";
  } catch {
    return "SINCRONIZACAO_PENDENTE";
  }
}

export function podeIniciarArrastoBoard(movimentoPendente: boolean): boolean {
  return !movimentoPendente;
}
