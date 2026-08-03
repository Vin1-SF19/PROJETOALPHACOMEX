export const APRESENTACAO_SLIDE_W = 1280;
export const APRESENTACAO_SLIDE_H = 720;

/** Escala uniforme que contém o slide 16:9 inteiro dentro do viewport disponível. */
export function calcularEscalaApresentacao(
  viewportWidth: number,
  viewportHeight: number,
  slideWidth = APRESENTACAO_SLIDE_W,
  slideHeight = APRESENTACAO_SLIDE_H,
): number {
  if (
    !Number.isFinite(viewportWidth)
    || !Number.isFinite(viewportHeight)
    || !Number.isFinite(slideWidth)
    || !Number.isFinite(slideHeight)
    || viewportWidth <= 0
    || viewportHeight <= 0
    || slideWidth <= 0
    || slideHeight <= 0
  ) {
    return 1;
  }
  return Math.min(viewportWidth / slideWidth, viewportHeight / slideHeight);
}
