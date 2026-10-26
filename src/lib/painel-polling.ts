import { comPrazoHttp } from "@/lib/http-deadline";

export function janelaPrincipal(): boolean {
  try { return typeof window !== "undefined" && window === window.top; } catch { return false; }
}

/** A server delay is a floor, including focus/reconnect. Never unbounded. */
export function esperaRetryAfter(value: string | null, now = Date.now()): number {
  if (!value?.trim()) return 0;
  const delay = /^\d+$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.min(300_000, Math.max(1000, delay)) : 0;
}

export class ConsultaPainelIndisponivel extends Error {
  constructor(readonly retryAfterMs = 0, readonly code = "UNAVAILABLE") {
    super("Serviço temporariamente indisponível");
  }
}

export async function consultarJsonPainel(url: string, signal?: AbortSignal): Promise<unknown> {
  return comPrazoHttp(30_000, signal, async (bounded) => {
    const response = await fetch(url, { signal: bounded, cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new ConsultaPainelIndisponivel(esperaRetryAfter(response.headers.get("Retry-After")));
    return response.json() as Promise<unknown>;
  });
}
