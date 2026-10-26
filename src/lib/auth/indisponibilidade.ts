import { NextResponse } from "next/server";
import { AUTH_RETRY_AFTER_SECONDS, AUTH_UNAVAILABLE, AUTH_UNAVAILABLE_MESSAGE } from "./estado-acesso";

/** Thrown only outside Auth.js JWT callbacks: core deletes cookies on callback errors. */
export class AcessoTemporariamenteIndisponivel extends Error {
  readonly code = AUTH_UNAVAILABLE;
  constructor() {
    super(AUTH_UNAVAILABLE_MESSAGE);
    this.name = "AcessoTemporariamenteIndisponivel";
  }
}

export function acessoEstaIndisponivel(error: unknown): error is AcessoTemporariamenteIndisponivel {
  return error instanceof AcessoTemporariamenteIndisponivel;
}

export function respostaAcessoIndisponivel(): NextResponse {
  return NextResponse.json(
    { success: false, error: AUTH_UNAVAILABLE_MESSAGE, code: AUTH_UNAVAILABLE, retryable: true },
    { status: 503, headers: { "Retry-After": String(AUTH_RETRY_AFTER_SECONDS), "Cache-Control": "no-store, max-age=0" } },
  );
}

/** Use before a route's generic error translation, including indirect auth callers. */
export function mapearIndisponibilidadeAuth(error: unknown): NextResponse | null {
  return acessoEstaIndisponivel(error) ? respostaAcessoIndisponivel() : null;
}
