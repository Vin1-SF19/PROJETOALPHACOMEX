import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), config: vi.fn(), headers: vi.fn(), fetch: vi.fn() }));
vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/bibble/runtime-config", () => ({ getBibbleRuntimeConfig: mocks.config }));
vi.mock("@/lib/bibble/client", () => ({ getOllamaHeaders: mocks.headers }));

import { GET as models } from "@/app/api/bibble/models/route";
import { GET as voice } from "@/app/api/bibble/voice/route";
import { AcessoTemporariamenteIndisponivel } from "@/lib/auth/indisponibilidade";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "7" } });
  mocks.config.mockReturnValue({ endpoint: new URL("https://private-upstream.invalid"), contextWindow: 100, outputTokenLimit: 10 });
  mocks.headers.mockReturnValue({ Authorization: "Bearer private-test-token" });
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("BIBBLE_VOICE_URL", "https://voice-private.invalid");
  vi.stubEnv("BIBBLE_VOICE_TOKEN", "private-test-token");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("public IA availability codes do not conflate auth and upstream", () => {
  const request = () => new Request("https://panel.invalid/api/bibble/voice");
  it.each([models, voice])("reports AUTH_UNAVAILABLE before contacting upstream", async (handler) => {
    mocks.auth.mockRejectedValue(new AcessoTemporariamenteIndisponivel());
    const response = await handler(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "AUTH_UNAVAILABLE" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("models distinguishes configuration and transport failure, never returning200 for errors", async () => {
    mocks.config.mockImplementationOnce(() => { throw new Error("private-upstream.invalid/private-test-token"); });
    const config = await models(request());
    expect(config.status).toBe(503);
    expect(await config.json()).toMatchObject({ models: [], code: "AI_CONFIGURATION_UNAVAILABLE" });
    mocks.fetch.mockRejectedValue(new TypeError("fetch failed: private-upstream.invalid/private-test-token"));
    const upstream = await models(request());
    expect(upstream.status).toBe(502);
    expect(upstream.headers.get("Cache-Control")).toContain("no-store");
    const body = await upstream.text();
    expect(body).toContain("AI_UPSTREAM_UNAVAILABLE");
    expect(body).not.toMatch(/private-upstream|private-test-token/);
  });
  it.each([models, voice])("bounds a stalled JSON body even after successful headers", async (handler) => {
    vi.useFakeTimers();
    mocks.fetch.mockResolvedValue(new Response(new ReadableStream()));
    const pending = handler(request());
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: "AI_UPSTREAM_TIMEOUT" });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("does not silently try loopback when deployed voice configuration is missing", async () => {
    vi.stubEnv("BIBBLE_VOICE_URL", "");
    const response = await voice(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "VOICE_MISCONFIGURED" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([429, 503, 502])("preserves recoverable upstream status%s without returning its body", async (status) => {
    mocks.fetch.mockResolvedValue(new Response("private-token-leak", { status }));
    const response = await models(request());
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(await response.text()).not.toContain("private-token-leak");
  });
});
