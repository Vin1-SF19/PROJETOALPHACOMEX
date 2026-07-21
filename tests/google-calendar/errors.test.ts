import { describe, expect, it } from "vitest";

import { classificarErroGoogle, GoogleCalendarError } from "@/lib/google-calendar/errors";

function erroFalso(status: number, opcoes?: { reason?: string; retryAfter?: string }) {
  return {
    response: {
      status,
      headers: opcoes?.retryAfter ? { "retry-after": opcoes.retryAfter } : undefined,
      data: opcoes?.reason ? { error: { errors: [{ reason: opcoes.reason }] } } : undefined,
    },
  };
}

describe("classificação de erros da Google Calendar API", () => {
  it("401 vira auth_expired, não retryable", () => {
    const erro = classificarErroGoogle(erroFalso(401));
    expect(erro).toBeInstanceOf(GoogleCalendarError);
    expect(erro.kind).toBe("auth_expired");
    expect(erro.retryable).toBe(false);
  });

  it("403 genérico vira forbidden", () => {
    const erro = classificarErroGoogle(erroFalso(403));
    expect(erro.kind).toBe("forbidden");
    expect(erro.retryable).toBe(false);
  });

  it("403 com reason de quota vira rate_limited retryable", () => {
    const erro = classificarErroGoogle(erroFalso(403, { reason: "rateLimitExceeded" }));
    expect(erro.kind).toBe("rate_limited");
    expect(erro.retryable).toBe(true);
  });

  it("404 vira not_found", () => {
    expect(classificarErroGoogle(erroFalso(404)).kind).toBe("not_found");
  });

  it("410 vira gone, não retryable (full sync é decisão de quem chama)", () => {
    const erro = classificarErroGoogle(erroFalso(410));
    expect(erro.kind).toBe("gone");
    expect(erro.retryable).toBe(false);
  });

  it("429 vira rate_limited retryable e respeita Retry-After em segundos", () => {
    const erro = classificarErroGoogle(erroFalso(429, { retryAfter: "2" }));
    expect(erro.kind).toBe("rate_limited");
    expect(erro.retryable).toBe(true);
    expect(erro.retryAfterMs).toBe(2000);
  });

  it("5xx vira unavailable retryable", () => {
    const erro = classificarErroGoogle(erroFalso(503));
    expect(erro.kind).toBe("unavailable");
    expect(erro.retryable).toBe(true);
  });

  it("400 vira invalid_request, não retryable", () => {
    const erro = classificarErroGoogle(erroFalso(400));
    expect(erro.kind).toBe("invalid_request");
    expect(erro.retryable).toBe(false);
  });

  it("erro sem status reconhecido vira unknown", () => {
    expect(classificarErroGoogle(new Error("falha de rede genérica")).kind).toBe("unknown");
  });
});
