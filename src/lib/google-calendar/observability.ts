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
