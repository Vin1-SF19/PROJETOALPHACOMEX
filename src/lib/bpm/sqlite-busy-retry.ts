export function erroSqliteBusy(errorValue: unknown): boolean {
  const pendentes: unknown[] = [errorValue];
  const visitados = new Set<object>();
  while (pendentes.length > 0) {
    const valor = pendentes.pop();
    if (!valor || typeof valor !== "object" || visitados.has(valor)) continue;
    visitados.add(valor);
    const erro = valor as {
      message?: unknown; originalMessage?: unknown; code?: unknown; cause?: unknown;
      meta?: { driverAdapterError?: unknown };
    };
    if ([erro.message, erro.originalMessage, erro.code]
      .some((mensagem) => typeof mensagem === "string" && /\bSQLITE_BUSY(?:_[A-Z]+)*\b/.test(mensagem))) return true;
    // Prisma também encapsula o erro libSQL em meta.driverAdapterError.
    // P1008/SocketTimeout isolados não comprovam uma transação revertida.
    pendentes.push(erro.cause, erro.meta?.driverAdapterError);
  }
  return false;
}

/** Reinicia apenas transações revertidas integralmente por disputa de escrita. */
export async function repetirTransacaoOcupada<T>(executar: () => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      return await executar();
    } catch (error) {
      // O adapter libSQL usa transações deferred. Outra escrita entre a
      // leitura e o primeiro update pode invalidar o snapshot inteiro.
      if (!erroSqliteBusy(error) || tentativa >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** tentativa));
    }
  }
}
