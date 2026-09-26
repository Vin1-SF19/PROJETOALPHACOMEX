/** Uma etapa posterior precisa ter ordem estritamente maior dentro do mesmo pipeline. */
export function destinoEhPosterior(ordemOrigem: number, ordemDestino: number): boolean {
  return Number.isFinite(ordemOrigem) && Number.isFinite(ordemDestino) && ordemDestino > ordemOrigem;
}
