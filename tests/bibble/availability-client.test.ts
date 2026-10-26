import { afterEach, expect, it, vi } from "vitest";
import { consultarIntegracaoIA, mensagemIndisponibilidadeIA, esperaRecuperacaoIA } from "@/lib/ai-availability-client";
import { ConsultaPainelIndisponivel } from "@/lib/painel-polling";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it.each(["AUTH_UNAVAILABLE", "AI_METADATA_UNAVAILABLE", "AI_CONFIGURATION_UNAVAILABLE", "AI_UPSTREAM_UNAVAILABLE", "AI_UPSTREAM_TIMEOUT", "VOICE_MISCONFIGURED"])("consumes public %s without exposing raw response details", async (code) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code, error: "private upstream/token/detail" }, { status: 503, headers: { "Retry-After": "900" } })));
  try { await consultarIntegracaoIA("/fixture"); throw new Error("expected failure"); }
  catch (error) {
    expect(error).toBeInstanceOf(ConsultaPainelIndisponivel);
    expect((error as ConsultaPainelIndisponivel).code).toBe(code);
    expect(mensagemIndisponibilidadeIA(error)).not.toContain("private");
    expect(esperaRecuperacaoIA(error)).toBe(300_000);
  }
});
it("bounds a stalled body and performs no request replay", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) })); vi.stubGlobal("fetch", fetcher);
  const operation = consultarIntegracaoIA("/fixture");
  const rejected = expect(operation).rejects.toMatchObject({ name: "TimeoutError" });
  await vi.advanceTimersByTimeAsync(30_000); await rejected; expect(fetcher).toHaveBeenCalledTimes(1);
});
