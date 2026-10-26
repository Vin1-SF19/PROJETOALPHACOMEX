type Resultado = "ok" | "denied" | "deadline" | "caller_abort" | "network_error" | "http_error" | "unavailable" | "saturated";
type MetricaBanco = {
  component: "transport" | "auth" | "ssr" | "heartbeat";
  phase: "headers" | "body" | "complete" | "abort" | "admission" | "observer" | "sdk";
  outcome: Resultado;
  totalMs?: number;
  headersMs?: number;
  bodyMs?: number;
  pending?: number;
  limit?: number;
  status?: number;
  observerExpired?: boolean;
};

// Per-instance counters are not global request counts. Repeated events are
// aggregated for 30s; the next emitted event includes all suppressed occurrences.
const buckets = new Map<string, { emittedAt: number; count: number }>();
export function registrarMetricaBanco(metric: MetricaBanco): void {
  const now = Date.now();
  const key = `${metric.component}:${metric.phase}:${metric.outcome}`;
  const previous = buckets.get(key);
  const count = (previous?.count ?? 0) + 1;
  const normal = metric.outcome === "ok" && (metric.totalMs ?? 0) < 1_000;
  if (previous && now - previous.emittedAt < 30_000 || normal && count < 100) {
    buckets.set(key, { emittedAt: previous?.emittedAt ?? now, count });
    return;
  }
  buckets.set(key, { emittedAt: now, count: 0 });
  console.warn("[db-resilience]", { ...metric, occurrences: count, scope: "instance" });
}
