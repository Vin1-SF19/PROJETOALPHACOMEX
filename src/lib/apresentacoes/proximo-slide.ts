export const MENSAGEM_SEM_PROXIMO_SLIDE = "Adicione um slide para ver a prévia";

export function obterProximoSlide<T extends { id: string; ordem: number }>(
  slides: T[],
  slideAtivoId: string | null,
): T | undefined {
  if (!slideAtivoId) return undefined;

  const slidesOrdenados = [...slides].sort((a, b) => a.ordem - b.ordem);
  const indiceAtivo = slidesOrdenados.findIndex((slide) => slide.id === slideAtivoId);
  return indiceAtivo >= 0 ? slidesOrdenados[indiceAtivo + 1] : undefined;
}

/** Usado para saber quando o slide salvo é o que aparece como miniatura da apresentação. */
export function ehPrimeiroSlide<T extends { id: string; ordem: number }>(
  slides: T[],
  slideId: string | null,
): boolean {
  if (!slideId || slides.length === 0) return false;
  const primeiro = slides.reduce((menor, atual) => (atual.ordem < menor.ordem ? atual : menor));
  return primeiro.id === slideId;
}
