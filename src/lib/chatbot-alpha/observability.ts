import { z } from "zod";
import { randomUUID } from "node:crypto";

// ─── Error categories ──────────────────────────────────────────────────────────

export const chatbotAlphaErrorCategorySchema = z.enum([
  "VALIDATION",
  "AUTH",
  "PERMISSION",
  "CONFIG",
  "EXTERNAL_UNAVAILABLE",
  "TIMEOUT",
  "RATE_LIMIT",
  "STREAM_INTERRUPTED",
  "INTERNAL",
]);

export type ChatbotAlphaErrorCategory = z.infer<typeof chatbotAlphaErrorCategorySchema>;

// ─── Operation status ──────────────────────────────────────────────────────────

export const chatbotAlphaOperationStatusSchema = z.enum([
  "SUCCESS",
  "ERROR",
  "TIMEOUT",
  "DENIED",
  "UNAVAILABLE",
]);

export type ChatbotAlphaOperationStatus = z.infer<typeof chatbotAlphaOperationStatusSchema>;

// ─── Structured log entry ──────────────────────────────────────────────────────

export const chatbotAlphaLogEntrySchema = z.object({
  correlationId: z.string().uuid(),
  operation: z.string().min(1),
  status: chatbotAlphaOperationStatusSchema,
  durationMs: z.number().int().nonnegative(),
  errorCategory: chatbotAlphaErrorCategorySchema.optional(),
  errorCode: z.string().min(1).optional(),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  userId: z.string().min(1).optional(),
  system: z.enum(["adminer", "redis", "mailhog", "chat"]).optional(),
});

export type ChatbotAlphaLogEntry = z.infer<typeof chatbotAlphaLogEntrySchema>;

// ─── Metric signal ─────────────────────────────────────────────────────────────

export const chatbotAlphaMetricNameSchema = z.enum([
  "latency_ms",
  "timeout_count",
  "external_unavailable_count",
  "auth_failure_count",
  "rate_limit_count",
  "stream_interrupted_count",
]);

export type ChatbotAlphaMetricName = z.infer<typeof chatbotAlphaMetricNameSchema>;

export const chatbotAlphaMetricSchema = z.object({
  name: chatbotAlphaMetricNameSchema,
  value: z.number().nonnegative(),
  correlationId: z.string().uuid(),
  operation: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type ChatbotAlphaMetric = z.infer<typeof chatbotAlphaMetricSchema>;

// ─── Operational error response (safe for UI) ─────────────────────────────────

export const chatbotAlphaOperationalErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  supportId: z.string().min(1),
});

export type ChatbotAlphaOperationalError = z.infer<typeof chatbotAlphaOperationalErrorSchema>;

// ─── Sanitization ──────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS: RegExp[] = [
  /token[=:]\s*\S+/gi,
  /Bearer\s+\S+/gi,
  /api[_-]?key[=:]\s*\S+/gi,
  /secret[=:]\s*\S+/gi,
  /password[=:]\s*\S+/gi,
  /authorization[=:]\s*\S+/gi,
  /cookie[=:]\s*\S+/gi,
  /session[=:]\s*\S+/gi,
];

/**
 * Remove padrões sensíveis de uma string antes de logar.
 * Nunca retorna o valor original se contiver segredos.
 */
export function sanitizeLogValue(value: string): string {
  let sanitized = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  // Remove query strings com parâmetros sensíveis de URLs
  sanitized = sanitized.replace(
    /(https?:\/\/[^\s?]+)\?[^\s]*token[^\s]*/gi,
    "$1?[REDACTED]",
  );
  return sanitized;
}

/**
 * Sanitiza um objeto removendo chaves sensíveis e valores com padrões de segredo.
 */
export function sanitizeLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE_KEYS = new Set([
    "token",
    "api_key",
    "apikey",
    "secret",
    "password",
    "authorization",
    "cookie",
    "session",
    "prompt",
    "attachment",
    "payload",
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string") {
      result[key] = sanitizeLogValue(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeLogObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Correlation ID ────────────────────────────────────────────────────────────

export function generateCorrelationId(): string {
  return randomUUID();
}

// ─── Operation tracker ─────────────────────────────────────────────────────────

export interface OperationContext {
  correlationId: string;
  operation: string;
  system?: "adminer" | "redis" | "mailhog" | "chat";
  userId?: string;
  startTime: number;
}

export function startOperation(
  operation: string,
  options?: { system?: OperationContext["system"]; userId?: string },
): OperationContext {
  return {
    correlationId: generateCorrelationId(),
    operation,
    system: options?.system,
    userId: options?.userId,
    startTime: Date.now(),
  };
}

// ─── Log emission ──────────────────────────────────────────────────────────────

type LogSink = (entry: ChatbotAlphaLogEntry) => void;

let activeLogSink: LogSink = (entry) => {
  // Default: structured console output (server-side only)
  console.log(JSON.stringify(entry));
};

export function setLogSink(sink: LogSink): void {
  activeLogSink = sink;
}

export function getLogSink(): LogSink {
  return activeLogSink;
}

// ─── Metric registry (in-memory, for CLI/doctor) ──────────────────────────────

const metricRegistry: Map<string, number> = new Map();

export function recordMetric(name: ChatbotAlphaMetricName, value: number = 1): void {
  const current = metricRegistry.get(name) ?? 0;
  metricRegistry.set(name, current + value);
}

export function getMetrics(): Record<string, number> {
  return Object.fromEntries(metricRegistry.entries());
}

export function resetMetrics(): void {
  metricRegistry.clear();
}

// ─── Complete operation (success or error) ────────────────────────────────────

export function completeOperation(
  ctx: OperationContext,
  result: {
    status: ChatbotAlphaOperationStatus;
    message: string;
    errorCategory?: ChatbotAlphaErrorCategory;
    errorCode?: string;
  },
): ChatbotAlphaLogEntry {
  const durationMs = Date.now() - ctx.startTime;

  const entry: ChatbotAlphaLogEntry = {
    correlationId: ctx.correlationId,
    operation: ctx.operation,
    status: result.status,
    durationMs,
    errorCategory: result.errorCategory,
    errorCode: result.errorCode,
    message: sanitizeLogValue(result.message),
    timestamp: new Date().toISOString(),
    userId: ctx.userId,
    system: ctx.system,
  };

  activeLogSink(entry);

  // Record metrics based on status/category
  if (result.status === "TIMEOUT" || result.errorCategory === "TIMEOUT") {
    recordMetric("timeout_count");
  }
  if (result.status === "UNAVAILABLE" || result.errorCategory === "EXTERNAL_UNAVAILABLE") {
    recordMetric("external_unavailable_count");
  }
  if (result.errorCategory === "AUTH") {
    recordMetric("auth_failure_count");
  }
  if (result.errorCategory === "RATE_LIMIT") {
    recordMetric("rate_limit_count");
  }
  if (result.errorCategory === "STREAM_INTERRUPTED") {
    recordMetric("stream_interrupted_count");
  }

  return entry;
}

// ─── Operational error factory (safe for UI) ──────────────────────────────────

const OPERATIONAL_MESSAGES: Record<ChatbotAlphaErrorCategory, string> = {
  VALIDATION: "Dados inválidos. Verifique os parâmetros e tente novamente.",
  AUTH: "Sessão expirada. Faça login novamente.",
  PERMISSION: "Você não tem permissão para acessar este recurso.",
  CONFIG: "Sistema não configurado. Contate o administrador.",
  EXTERNAL_UNAVAILABLE: "Serviço externo temporariamente indisponível. Tente novamente em instantes.",
  TIMEOUT: "Tempo de resposta excedido. Tente novamente.",
  RATE_LIMIT: "Limite de requisições atingido. Aguarde e tente novamente.",
  STREAM_INTERRUPTED: "Conexão interrompida. Tente novamente.",
  INTERNAL: "Erro interno. Contate o suporte com o identificador abaixo.",
};

export function makeOperationalError(
  category: ChatbotAlphaErrorCategory,
  correlationId: string,
): ChatbotAlphaOperationalError {
  return {
    code: category,
    message: OPERATIONAL_MESSAGES[category],
    retryable: category === "EXTERNAL_UNAVAILABLE" || category === "TIMEOUT" || category === "RATE_LIMIT",
    supportId: correlationId,
  };
}
