import "server-only";

/** Reconhece apenas o timeout de conexão observado nos alertas, inclusive encapsulado pelo Prisma. */
export function erroTimeoutConexaoAlertas(valor: unknown): boolean {
  const pendentes = [valor];
  const visitados = new Set<object>();
  while (pendentes.length) {
    const atual = pendentes.pop();
    if (!atual || typeof atual !== "object" || visitados.has(atual)) continue;
    visitados.add(atual);
    const erro = atual as { code?: unknown; cause?: unknown; meta?: { driverAdapterError?: unknown } };
    if (erro.code === "UND_ERR_CONNECT_TIMEOUT") return true;
    pendentes.push(erro.cause, erro.meta?.driverAdapterError);
  }
  return false;
}

/** Exclusivo da leitura de alertas: uma repetição, sem envolver escritas ou transações. */
export async function repetirLeituraAlertas<T>(ler: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let tentativa = 0; ; tentativa += 1) {
    signal.throwIfAborted();
    try {
      return await ler();
    } catch (error) {
      if (tentativa >= 1 || !erroTimeoutConexaoAlertas(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
