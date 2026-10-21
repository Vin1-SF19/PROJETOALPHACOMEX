/** Browser timings contain only operation phases, never form values or identity. */
export async function medirFaseCrm<T>(fase: "salvamento" | "requisicao" | "atualizacao", executar: () => Promise<T>): Promise<T> {
  const inicio = performance.now();
  try { return await executar(); }
  finally {
    const nome = `crm:${fase}:duracao`;
    if (performance.getEntriesByName(nome).length >= 100) performance.clearMeasures(nome);
    performance.measure(nome, { start: inicio, end: performance.now() });
  }
}
