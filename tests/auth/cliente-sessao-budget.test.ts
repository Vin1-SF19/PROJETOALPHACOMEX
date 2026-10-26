import { afterEach, expect, it, vi } from "vitest";
import { consultarSessao, PRAZO_SESSAO_MS } from "@/lib/auth/cliente-sessao";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("csrf and session share one 30 second deadline rather than restarting the budget", async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    signals.push(init.signal!);
    if (url.endsWith("csrf")) return new Promise<Response>((resolve) => setTimeout(() => resolve(Response.json({ csrfToken: "fixture" })), 20_000));
    return new Promise<Response>(() => {});
  }));
  const pending = consultarSessao(undefined, {});
  const rejected = expect(pending).rejects.toThrow("verificar a conexão");
  await vi.advanceTimersByTimeAsync(29_999); expect(signals).toHaveLength(2); expect(signals[1].aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1); await rejected; expect(signals[1].aborted).toBe(true); expect(PRAZO_SESSAO_MS).toBe(30_000);
});
