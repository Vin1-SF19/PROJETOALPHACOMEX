import type { Session } from "next-auth";
import { sessaoEstaIndisponivel, sessaoPermiteOperacao } from "./estado-acesso";

export const PRAZO_SESSAO_MS = 30_000;

export class ConsultaSessaoIndisponivel extends Error {
  constructor() { super("Não foi possível verificar a conexão. Tente novamente."); }
}

/** A deadline covers headers AND body; abort also reaches the native transport. */
export async function consultarJsonSessao(
  url: string,
  init: RequestInit = {},
  prazo = PRAZO_SESSAO_MS,
): Promise<{ status: number; body: unknown; retryAfter: string | null }> {
  const controller = new AbortController();
  const abort = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new ConsultaSessaoIndisponivel());
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    timer = setTimeout(() => controller.abort(), prazo);
    if (controller.signal.aborted) rejectAbort();
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body: unknown = await response.json();
        if (controller.signal.aborted) throw new ConsultaSessaoIndisponivel();
        return { status: response.status, body, retryAfter: response.headers.get("Retry-After") };
      })(),
      stopped,
    ]);
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
    if (rejectAbort) controller.signal.removeEventListener("abort", rejectAbort);
  }
}

function sessaoPublica(body: unknown): Session | null {
  if (body === null) return null;
  if (!body || typeof body !== "object" || !("expires" in body) || typeof body.expires !== "string") throw new ConsultaSessaoIndisponivel();
  if (sessaoPermiteOperacao(body) || sessaoEstaIndisponivel(body) ||
    ("estadoAcesso" in body && body.estadoAcesso === "NEGADO" && "acessoBloqueado" in body && body.acessoBloqueado === true)) {
    // Validated public protocol; optional identity in TEMP is never restored locally.
    return body as Session;
  }
  throw new ConsultaSessaoIndisponivel();
}

export async function consultarSessao(signal?: AbortSignal, data?: unknown): Promise<Session | null> {
  const started = Date.now();
  let init: RequestInit = { signal };
  if (data !== undefined) {
    const csrf = await consultarJsonSessao("/api/auth/csrf", { signal });
    if (csrf.status !== 200 || !csrf.body || typeof csrf.body !== "object" || !("csrfToken" in csrf.body) || typeof csrf.body.csrfToken !== "string") throw new ConsultaSessaoIndisponivel();
    init = { signal, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csrfToken: csrf.body.csrfToken, data }) };
  }
  const remaining = PRAZO_SESSAO_MS - (Date.now() - started);
  if (remaining <= 0) throw new ConsultaSessaoIndisponivel();
  const response = await consultarJsonSessao("/api/auth/session", init, remaining);
  if (response.status !== 200) throw new ConsultaSessaoIndisponivel();
  return sessaoPublica(response.body);
}
