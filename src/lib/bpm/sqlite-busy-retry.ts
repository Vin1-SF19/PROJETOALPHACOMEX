export function erroSqliteBusy(errorValue: unknown): boolean {
  if (!errorValue || typeof errorValue !== "object") return false;
  const erro = errorValue as { message?: unknown; cause?: { message?: unknown; originalMessage?: unknown } };
  return [erro.message, erro.cause?.message, erro.cause?.originalMessage]
    .some((mensagem) => typeof mensagem === "string" && mensagem.includes("SQLITE_BUSY"));
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
