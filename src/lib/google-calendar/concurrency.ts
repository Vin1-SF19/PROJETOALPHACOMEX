/** Executa itens com concorrência limitada, preservando a ordem dos resultados. */
export async function mapearComConcorrencia<T, R>(
  itens: readonly T[],
  limite: number,
  executar: (item: T) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limite) || limite < 1) {
    throw new Error("Limite de concorrência inválido.");
  }

  const resultados = new Array<R>(itens.length);
  let proximoIndice = 0;

  async function consumir() {
    for (;;) {
      const indice = proximoIndice;
      proximoIndice += 1;
      if (indice >= itens.length) return;
      resultados[indice] = await executar(itens[indice]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, () => consumir()),
  );
  return resultados;
}
