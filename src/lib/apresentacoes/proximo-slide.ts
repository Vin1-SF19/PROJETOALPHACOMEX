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
