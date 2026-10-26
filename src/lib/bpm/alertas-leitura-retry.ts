import "server-only";
import { erroTransporteBanco } from "@/lib/db-transport-error";

/** Reconhece apenas o timeout de conexão observado nos alertas, inclusive encapsulado pelo Prisma. */
export function erroTimeoutConexaoAlertas(valor: unknown): boolean {
  return erroTransporteBanco(valor, true);
}

/** Exclusivo da leitura de alertas: uma repetição, sem envolver escritas ou transações. */
export async function repetirLeituraAlertas<T>(ler: () => Promise<T>, signal: AbortSignal): Promise<T> {
  const expiresAt = Date.now() + 25_000;
  for (let tentativa = 0; ; tentativa += 1) {
    signal.throwIfAborted();
    try {
      return await ler();
    } catch (error) {
      if (tentativa >= 1 || !erroTimeoutConexaoAlertas(error) || expiresAt - Date.now() <= 250) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
