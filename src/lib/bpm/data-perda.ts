/** A data da perda vem da movimentação persistida, nunca do relógio do navegador. */
export function ultimaDataPerda(
  historico: readonly {
    acao: string;
    valorNovoJson: string | null;
    createdAt: Date;
  }[],
  etapaLostId: string,
): Date | null {
  let ultima: Date | null = null;
  for (const evento of historico) {
    if (evento.acao !== "CARD_MOVIDO") continue;
    try {
      const valor: unknown = JSON.parse(evento.valorNovoJson ?? "null");
      if (!valor || typeof valor !== "object" || (valor as { etapaId?: unknown }).etapaId !== etapaLostId) continue;
      if (!ultima || evento.createdAt > ultima) ultima = evento.createdAt;
    } catch {
      // Um evento legado inválido não substitui uma data verificável.
    }
  }
  return ultima;
}
