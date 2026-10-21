type CardComData = { id: string; createdAt?: Date | string | null };

function instante(valor: CardComData["createdAt"]): number {
  const data = valor instanceof Date ? valor.getTime() : valor ? Date.parse(valor) : NaN;
  return Number.isFinite(data) ? data : -Infinity;
}

/** Uma única cronologia para cards reais e NoLoss (receivedAt projetado como createdAt). */
export function ordenarCardsMaisRecentesPrimeiro<T extends CardComData>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => {
    const dataA = instante(a.createdAt);
    const dataB = instante(b.createdAt);
    if (dataA !== dataB) return dataA < dataB ? 1 : -1;
    return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
  });
}
