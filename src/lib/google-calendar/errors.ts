export type GoogleCalendarErrorKind =
  | "auth_expired"
  | "forbidden"
  | "not_found"
  | "gone"
  | "rate_limited"
  | "invalid_request"
  | "unavailable"
  | "unknown";

interface OpcoesGoogleCalendarError {
  kind: GoogleCalendarErrorKind;
  retryable?: boolean;
  retryAfterMs?: number;
  status?: number;
  cause?: unknown;
}

/** Erro normalizado de qualquer chamada à Google Calendar API — nunca propagar o erro bruto do `googleapis` para logs/UI. */
export class GoogleCalendarError extends Error {
  readonly kind: GoogleCalendarErrorKind;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly status?: number;

  constructor(message: string, opcoes: OpcoesGoogleCalendarError) {
    super(message);
    this.name = "GoogleCalendarError";
    this.kind = opcoes.kind;
    this.retryable = opcoes.retryable ?? false;
    this.retryAfterMs = opcoes.retryAfterMs;
    this.status = opcoes.status;
    if (opcoes.cause !== undefined) {
      (this as { cause?: unknown }).cause = opcoes.cause;
    }
  }
}

interface FormaErroGoogleApi {
  code?: number;
  response?: {
    status?: number;
    headers?: Record<string, string> | undefined;
    data?: { error?: { errors?: { reason?: string }[]; status?: string } };
  };
}

function extrairRetryAfterMs(headers: Record<string, string> | undefined): number | undefined {
  const valor = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!valor) return undefined;
  const segundos = Number(valor);
  if (Number.isFinite(segundos)) return segundos * 1000;
  const dataAlvo = Date.parse(valor);
  if (!Number.isNaN(dataAlvo)) return Math.max(0, dataAlvo - Date.now());
  return undefined;
}

function extrairMotivo(erro: FormaErroGoogleApi): string | undefined {
  return erro.response?.data?.error?.errors?.[0]?.reason;
}

/**
 * Classifica qualquer erro vindo do `googleapis` (ou de rede) num `GoogleCalendarError`
 * previsível. Nunca faz retry cego de 400/401/403 — só 429 e 5xx são retryable.
 */
export function classificarErroGoogle(erroOriginal: unknown): GoogleCalendarError {
  const erro = (erroOriginal ?? {}) as FormaErroGoogleApi;
  const status = erro.response?.status ?? erro.code;
  const motivo = extrairMotivo(erro);
  const retryAfterMs = extrairRetryAfterMs(erro.response?.headers);

  if (status === 401) {
    return new GoogleCalendarError(
      "Não foi possível autenticar como este usuário (verifique o Domain-Wide Delegation da Service Account no Admin Console do Workspace).",
      { kind: "auth_expired", retryable: false, status, cause: erroOriginal },
    );
  }

  if (status === 403) {
    if (motivo === "rateLimitExceeded" || motivo === "userRateLimitExceeded" || motivo === "quotaExceeded") {
      return new GoogleCalendarError("Quota da Google Calendar API excedida.", {
        kind: "rate_limited",
        retryable: true,
        retryAfterMs: retryAfterMs ?? 1000,
        status,
        cause: erroOriginal,
      });
    }
    return new GoogleCalendarError("Acesso negado pela Google Calendar API.", {
      kind: "forbidden",
      retryable: false,
      status,
      cause: erroOriginal,
    });
  }

  if (status === 404) {
    return new GoogleCalendarError("Recurso não encontrado na Google Calendar API.", {
      kind: "not_found",
      retryable: false,
      status,
      cause: erroOriginal,
    });
  }

  if (status === 410) {
    return new GoogleCalendarError("Sync token expirado — full sync necessário.", {
      kind: "gone",
      retryable: false,
      status,
      cause: erroOriginal,
    });
  }

  if (status === 429) {
    return new GoogleCalendarError("Muitas requisições à Google Calendar API.", {
      kind: "rate_limited",
      retryable: true,
      retryAfterMs: retryAfterMs ?? 1000,
      status,
      cause: erroOriginal,
    });
  }

  if (typeof status === "number" && status >= 500) {
    return new GoogleCalendarError("Google Calendar API indisponível no momento.", {
      kind: "unavailable",
      retryable: true,
      retryAfterMs: retryAfterMs ?? 500,
      status,
      cause: erroOriginal,
    });
  }

  if (status === 400) {
    return new GoogleCalendarError("Requisição inválida para a Google Calendar API.", {
      kind: "invalid_request",
      retryable: false,
      status,
      cause: erroOriginal,
    });
  }

  return new GoogleCalendarError("Erro desconhecido ao chamar a Google Calendar API.", {
    kind: "unknown",
    retryable: false,
    status: typeof status === "number" ? status : undefined,
    cause: erroOriginal,
  });
}
