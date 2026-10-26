// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BotaoFalarMensagem } from "@/components/BibbleChatHome/BotaoFalarMensagem";
import { BotaoMicrofone } from "@/components/BibbleChatHome/BotaoMicrofone";
import { refreshBibbleVoiceStatus, resetVoiceStatusCacheForTests, useVoiceStatus } from "@/components/BibbleChatHome/useVoiceStatus";
import { requestBibbleSpeech } from "@/lib/bibble/voice-client";

const sessionState = vi.hoisted(() => ({ id: "7" }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { estadoAcesso: "PERMITIDO", user: { id: sessionState.id } } }) }));
vi.mock("@/lib/bibble/voice-client", () => ({
  cleanBibbleSpeechText: (text: string) => text,
  requestBibbleSpeech: vi.fn(async () => new Blob(["audio"])),
  releaseBibbleSpeech: vi.fn(),
}));
vi.mock("@/components/BibbleChatHome/bibble-audio-manager", () => ({
  bibbleAudioManager: { pause: vi.fn(), resume: vi.fn(), play: vi.fn(async () => true), stop: vi.fn() },
}));

let root: Root;
let container: HTMLDivElement;
let healthy: boolean;
let retryAfter: string | null;
let transportFailure: boolean;
let online: boolean;
let visible: boolean;

const fetchStatus = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input) => {
  if (String(input).includes("onyx")) return Response.json({ stt_enabled: false });
  return Response.json({ success: healthy, data: {
    status: healthy ? "ok" : "degraded", device: "cpu", referenceConfigured: healthy,
  } }, {
    status: !healthy && transportFailure ? 503 : 200,
    headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
  });
});

function holdNextChecks() {
  const checks: { signal: AbortSignal | null | undefined; resolve: (response: Response) => void }[] = [];
  for (let i = 0; i < 2; i++) fetchStatus.mockImplementationOnce((_input, init) => new Promise<Response>((resolve) => {
    checks.push({ signal: init?.signal, resolve });
  }));
  return checks;
}

function completeChecks(checks: ReturnType<typeof holdNextChecks>) {
  checks[0].resolve(Response.json({ stt_enabled: true }));
  checks[1].resolve(Response.json({ success: true, data: { status: "ok", device: "cpu", referenceConfigured: true } }));
}

function Probe() {
  const status = useVoiceStatus();
  return h("output", null, !status.loaded ? "loading" : status.tts_enabled ? "available" : "unavailable");
}

async function tick(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T14:00:00Z"));
  resetVoiceStatusCacheForTests();
  sessionState.id = "7";
  healthy = false;
  retryAfter = null;
  transportFailure = true;
  online = true;
  visible = true;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible ? "visible" : "hidden");
  fetchStatus.mockClear();
  vi.mocked(requestBibbleSpeech).mockClear();
  vi.stubGlobal("fetch", fetchStatus);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  resetVoiceStatusCacheForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("shared voice availability", () => {
  it("backs off 503s up to five minutes, deduplicates bubbles and resets after recovery", async () => {
    await act(async () => root.render(h("div", null, h(Probe), h(Probe))));
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(container.textContent).toBe("unavailableunavailable");
    for (const [delay, checks] of [[60_000, 4], [120_000, 6], [240_000, 8], [300_000, 10], [300_000, 12]]) {
      await tick(delay - 1);
      expect(fetchStatus).toHaveBeenCalledTimes(checks - 2);
      await tick(1);
      expect(fetchStatus).toHaveBeenCalledTimes(checks);
    }
    healthy = true;
    await tick(300_000);
    expect(container.textContent).toBe("availableavailable");
    await tick(60_000);
    expect(fetchStatus).toHaveBeenCalledTimes(16);
    expect(fetchStatus.mock.calls.every(([url]) => !String(url).includes("speech"))).toBe(true);
  });

  it("also backs off successful HTTP responses reporting disabled voice", async () => {
    transportFailure = false;
    await act(async () => root.render(h(Probe)));
    await tick(60_000);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
    await tick(60_000);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
    await tick(60_000);
    expect(fetchStatus).toHaveBeenCalledTimes(6);
  });

  it.each(["900", "Wed, 21 Oct 2026 14:15:00 GMT"])("bounds Retry-After %s to five minutes", async (header) => {
    retryAfter = header;
    await act(async () => root.render(h(Probe)));
    await tick(299_999);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("pauses while hidden/offline, resumes once when due and removes subscriptions on unmount", async () => {
    await act(async () => root.render(h("div", null, h(Probe), h(Probe))));
    visible = false;
    document.dispatchEvent(new Event("visibilitychange"));
    await tick(300_000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    online = false;
    visible = true;
    document.dispatchEvent(new Event("visibilitychange"));
    await tick(300_000);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    online = true;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("online"));
    });
    expect(fetchStatus).toHaveBeenCalledTimes(4);
    await act(async () => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
    await tick(900_000);
    window.dispatchEvent(new Event("online"));
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("does not poll on initial offline mount or bypass backoff on repeated visibility changes", async () => {
    online = false;
    await act(async () => root.render(h(Probe)));
    expect(fetchStatus).not.toHaveBeenCalled();
    online = true;
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 5; i++) document.dispatchEvent(new Event("visibilitychange"));
    await tick(59_999);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it.each(["hidden", "offline"])("aborts background checks when %s and ignores late responses after resuming", async (reason) => {
    const checks = holdNextChecks();
    await act(async () => root.render(h(Probe)));
    visible = reason !== "hidden";
    online = reason !== "offline";
    if (reason === "hidden") document.dispatchEvent(new Event("visibilitychange"));
    else window.dispatchEvent(new Event("offline"));
    expect(checks.every(check => check.signal?.aborted)).toBe(true);
    visible = true;
    online = true;
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(container.textContent).toBe("unavailable");
    await act(async () => completeChecks(checks));
    expect(container.textContent).toBe("unavailable");
    expect(fetchStatus).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("aborts background checks on the last unsubscribe without allowing stale cache writes", async () => {
    const checks = holdNextChecks();
    await act(async () => root.render(h("div", null, h(Probe), h(Probe))));
    await act(async () => root.render(null));
    expect(checks.every(check => check.signal?.aborted)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => completeChecks(checks));
    await act(async () => root.render(h(Probe)));
    expect(container.textContent).toBe("unavailable");
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("keeps an explicit standalone consumer alive when the last bubble unsubscribes", async () => {
    const checks = holdNextChecks();
    await act(async () => root.render(h(Probe)));
    const explicit = refreshBibbleVoiceStatus(fetchStatus);
    await act(async () => root.render(null));
    expect(checks.every(check => check.signal?.aborted === false)).toBe(true);
    completeChecks(checks);
    expect((await explicit).tts_enabled).toBe(true);
    await act(async () => root.render(h(Probe)));
    expect(container.textContent).toBe("available");
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it("does not let a request from before reset overwrite a newer cache", async () => {
    const checks = holdNextChecks();
    const oldRequest = refreshBibbleVoiceStatus(fetchStatus);
    resetVoiceStatusCacheForTests();
    expect(checks.every(check => check.signal?.aborted)).toBe(true);
    expect((await refreshBibbleVoiceStatus(fetchStatus)).tts_enabled).toBe(false);
    completeChecks(checks);
    await oldRequest;
    expect((await refreshBibbleVoiceStatus(fetchStatus)).tts_enabled).toBe(false);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("shows an accessible explicit retry without autoplay and keeps native microphone available", async () => {
    const start = vi.fn();
    class NativeRecognition { start = start; }
    vi.stubGlobal("SpeechRecognition", NativeRecognition);
    await act(async () => root.render(h("div", null,
      h(BotaoFalarMensagem, { messageId: "voice-retry", texto: "Olá", autoPlay: true }),
      h(BotaoMicrofone, { onTranscrito: vi.fn() }),
    )));
    const retry = container.querySelector<HTMLButtonElement>('button[aria-label="Voz do Bibble indisponível. Tentar novamente"]');
    expect(retry?.textContent).toContain("VOZ INDISPONÍVEL");
    expect(retry?.disabled).toBe(false);
    expect(requestBibbleSpeech).not.toHaveBeenCalled();
    await act(async () => retry?.click());
    expect(requestBibbleSpeech).toHaveBeenCalledExactlyOnceWith("voice-retry", "Olá");
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Gravar voz"]')?.click());
    expect(start).toHaveBeenCalledOnce();
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });
});

it("switching users aborts old health checks and does not restore the old capabilities", async () => {
  const old = holdNextChecks();
  await act(async () => root.render(h(Probe)));
  expect(fetchStatus).toHaveBeenCalledTimes(2);
  sessionState.id = "8";
  await act(async () => root.render(h(Probe)));
  expect(old.every((check) => check.signal?.aborted)).toBe(true);
  expect(fetchStatus).toHaveBeenCalledTimes(4);
  await act(async () => completeChecks(old));
  expect(container.textContent).toBe("unavailable");
});
