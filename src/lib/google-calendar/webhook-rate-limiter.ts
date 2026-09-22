const JANELA_RATE_LIMIT_MS = 60_000;
const MAX_CHAVES_RATE_LIMIT = 5_000;

interface EntradaRateLimit {
  inicioJanela: number;
  total: number;
}

export const rateLimitPreDb = new Map<string, EntradaRateLimit>();
export const rateLimitPosAuth = new Map<string, EntradaRateLimit>();

export function consumirRateLimit(
  store: Map<string, EntradaRateLimit>,
  chave: string,
  limite: number,
  agora = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const existente = store.get(chave);
  if (!existente || agora - existente.inicioJanela >= JANELA_RATE_LIMIT_MS) {
    if (store.size >= MAX_CHAVES_RATE_LIMIT) {
      for (const [chaveExistente, entrada] of store) {
        if (agora - entrada.inicioJanela >= JANELA_RATE_LIMIT_MS) {
          store.delete(chaveExistente);
        }
      }
      if (store.size >= MAX_CHAVES_RATE_LIMIT) {
        const primeiraChave = store.keys().next().value;
        if (primeiraChave) store.delete(primeiraChave);
      }
    }
    store.set(chave, { inicioJanela: agora, total: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existente.total += 1;
  if (existente.total <= limite) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(
        (JANELA_RATE_LIMIT_MS - (agora - existente.inicioJanela)) / 1_000,
      ),
    ),
  };
}

/**
 * Limiter local, limitado em memória, para absorver abuso por instância. Em
 * produção multi-instância, WAF/rate limit distribuído continua obrigatório.
 */
export function resetAgendaAlphaWebhookRateLimiterForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  rateLimitPreDb.clear();
  rateLimitPosAuth.clear();
}
