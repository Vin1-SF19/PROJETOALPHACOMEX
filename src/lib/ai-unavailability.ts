import { NextResponse } from "next/server";

export type CodigoIndisponibilidadeIA = "AI_CONFIGURATION_UNAVAILABLE" | "AI_METADATA_UNAVAILABLE" | "AI_UPSTREAM_UNAVAILABLE" | "AI_UPSTREAM_TIMEOUT" | "AI_RATE_LIMITED";

/** Response contains only allowlisted public metadata, never upstream details. */
export function respostaIndisponibilidadeIA(code: CodigoIndisponibilidadeIA, status: number, extra: { models?: never[]; stt_enabled?: false; tts_enabled?: false } = {}) {
  const messages: Record<CodigoIndisponibilidadeIA, string> = {
    AI_CONFIGURATION_UNAVAILABLE: "Integração de IA não configurada para este ambiente ou usuário",
    AI_METADATA_UNAVAILABLE: "Dados da integração de IA temporariamente indisponíveis",
    AI_UPSTREAM_UNAVAILABLE: "Serviço de IA temporariamente indisponível",
    AI_UPSTREAM_TIMEOUT: "Serviço de IA excedeu o tempo de resposta",
    AI_RATE_LIMITED: "Serviço de IA ocupado. Tente novamente em instantes",
  };
  return NextResponse.json({ success: false, error: messages[code], code, retryable: status >= 500 || status === 429, ...extra }, {
    status, headers: { "Cache-Control": "private, no-store", "Retry-After": "30" },
  });
}

export function codigoFalhaUpstream(error: unknown): "AI_UPSTREAM_TIMEOUT" | "AI_UPSTREAM_UNAVAILABLE" {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    ? "AI_UPSTREAM_TIMEOUT" : "AI_UPSTREAM_UNAVAILABLE";
}
