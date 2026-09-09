import { createHash, randomUUID } from "node:crypto";

export type ResultadoWebhookAgendaAlpha =
  | "accepted"
  | "rejected"
  | "duplicate"
  | "coalesced";

export type MotivoWebhookAgendaAlpha =
  | "FEATURE_DISABLED"
  | "INVALID_REQUEST"
  | "AUTH_FAILED"
  | "CHANNEL_CHANGED"
  | "PERSISTENCE_FAILED";

export interface EventoWebhookAgendaAlpha {
  correlationId: string;
  outcome: ResultadoWebhookAgendaAlpha;
  reason?: MotivoWebhookAgendaAlpha;
  googleChannelId?: string;
  resourceState?: "sync" | "exists" | "not_exists";
  latencyMs: number;
}

export function criarCorrelationIdAgendaAlpha(): string {
  return randomUUID();
}

export function referenciaCanalAgendaAlpha(googleChannelId: string): string {
  return createHash("sha256")
    .update(googleChannelId, "utf8")
    .digest("hex")
    .slice(0, 12);
}

/**
 * Serialização por allowlist. Mesmo que o chamador acrescente propriedades em
 * runtime, apenas os campos técnicos abaixo entram no log.
 */
export function serializarEventoAgendaAlpha(
  evento: EventoWebhookAgendaAlpha,
): string {
  const correlationId = /^[a-f0-9-]{16,64}$/i.test(evento.correlationId)
    ? evento.correlationId
    : referenciaCanalAgendaAlpha(evento.correlationId);
  const latencyMs = Math.max(
    0,
    Math.min(Math.trunc(evento.latencyMs), 10 * 60 * 1000),
  );

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    scope: "agenda-alpha",
    event: "webhook",
    metric: "agenda_alpha_webhook_total",
    value: 1,
    correlationId,
    outcome: evento.outcome,
    ...(evento.reason ? { reason: evento.reason } : {}),
    ...(evento.googleChannelId
      ? { channelRef: referenciaCanalAgendaAlpha(evento.googleChannelId) }
      : {}),
    ...(evento.resourceState
      ? { resourceState: evento.resourceState }
      : {}),
    latencyMs,
  });
}

export function registrarEventoAgendaAlpha(
  evento: EventoWebhookAgendaAlpha,
  escrever: (linha: string) => void = console.info,
): void {
  escrever(serializarEventoAgendaAlpha(evento));
}

export type OperacaoPerformanceAgendaAlpha =
  | "snapshot_intervalo"
  | "criar_evento"
  | "criar_tarefa";

export interface MetricaPerformanceAgendaAlpha {
  correlationId: string;
  operation: OperacaoPerformanceAgendaAlpha;
  outcome: "success" | "error";
  latencyMs: number;
  itemCount?: number;
}

/** Métrica técnica sem títulos, e-mails, IDs de usuário ou conteúdo da agenda. */
export function serializarMetricaPerformanceAgendaAlpha(
  metrica: MetricaPerformanceAgendaAlpha,
): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    scope: "agenda-alpha",
    event: "performance",
    metric: "agenda_alpha_operation_duration_ms",
    correlationId: /^[a-f0-9-]{16,64}$/i.test(metrica.correlationId)
      ? metrica.correlationId
      : referenciaCanalAgendaAlpha(metrica.correlationId),
    operation: metrica.operation,
    outcome: metrica.outcome,
    latencyMs: Math.max(0, Math.min(Math.trunc(metrica.latencyMs), 10 * 60 * 1000)),
    ...(metrica.itemCount === undefined
      ? {}
      : { itemCount: Math.max(0, Math.min(Math.trunc(metrica.itemCount), 100_000)) }),
  });
}

export function registrarMetricaPerformanceAgendaAlpha(
  metrica: MetricaPerformanceAgendaAlpha,
  escrever: (linha: string) => void = console.info,
): void {
  escrever(serializarMetricaPerformanceAgendaAlpha(metrica));
}
