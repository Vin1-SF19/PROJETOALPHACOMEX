/** Server configuration only. Clients use independent bounded UI deadlines. */
type BudgetName = "DB_ROUNDTRIP_TIMEOUT_MS" | "AUTH_VALIDATION_BUDGET_MS" | "PAINEL_SSR_READ_BUDGET_MS";

export function resolverPrazosBanco(env: Partial<Record<string, string | undefined>> = process.env) {
  function read(name: BudgetName, fallback: number, min: number, max: number): number {
    const raw = env[name];
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!raw.trim() || !Number.isSafeInteger(value) || value < min || value > max) {
      // Name is a fixed allowlist. Never print the configured value.
      console.warn("[db-resilience-config] Invalid budget; using default", { budget: name });
      return fallback;
    }
    return value;
  }
  const transportMs = read("DB_ROUNDTRIP_TIMEOUT_MS", 10_000, 1_000, 12_000);
  const authMs = Math.max(read("AUTH_VALIDATION_BUDGET_MS", 12_000, 3_000, 15_000), transportMs + 1_000);
  const ssrMs = Math.max(read("PAINEL_SSR_READ_BUDGET_MS", 20_000, 5_000, 25_000), transportMs + 2_000);
  return { transportMs, authMs, ssrMs };
}

export const prazosBanco = resolverPrazosBanco();
