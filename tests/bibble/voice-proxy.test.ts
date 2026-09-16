import { readFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  BIBBLE_VOICE_MAX_GLOBAL_CONCURRENCY,
  BIBBLE_VOICE_RATE_LIMIT,
  acquireBibbleVoiceLease,
  resetBibbleVoiceAdmissionForTests,
} from "@/lib/bibble/voice-admission";

import {
  BibbleVoiceProxyError,
  BIBBLE_VOICE_AUDIO_MAX_BYTES,
  BIBBLE_VOICE_TIMEOUT_MS,
  assertBibbleVoiceSameOrigin,
  bibbleVoiceSpeechSchema,
  isWav,
  readBibbleVoiceAudio,
  resolveBibbleVoiceConfig,
  resolveBibbleVoiceEndpoint,
} from "@/lib/bibble/voice-service";

afterEach(() => resetBibbleVoiceAdmissionForTests());

function wavBytes(): Uint8Array {
  return Uint8Array.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 65, 86, 69]);
}

describe("Bibble voice proxy boundaries", () => {
  it("accepts only the registered voice/language and bounded text", () => {
    expect(bibbleVoiceSpeechSchema.parse({ text: " Olá " })).toEqual({ text: "Olá", voice: "bibble", language: "pt" });
    expect(() => bibbleVoiceSpeechSchema.parse({ text: "oi", voice: "../../etc/passwd", language: "pt" })).toThrow();
    expect(() => bibbleVoiceSpeechSchema.parse({ text: "x".repeat(2_501) })).toThrow();
    expect(() => bibbleVoiceSpeechSchema.parse({ text: "oi", path: "/tmp/a.wav" })).toThrow();
  });

  it("accepts the public Host and Origin when the request URL is internal", () => {
    const headers = {
      host: "stagealpha-sistema.alpak.ai",
      origin: "https://stagealpha-sistema.alpak.ai",
      "sec-fetch-site": "same-origin",
    };

    expect(() => assertBibbleVoiceSameOrigin(
      new Request("http://127.0.0.1:3000/api/bibble/voice", { headers }),
    )).not.toThrow();
  });

  it("rejects a public Host and Origin mismatch", () => {
    expect(() => assertBibbleVoiceSameOrigin(new Request("http://127.0.0.1:3000/api/bibble/voice", {
      headers: {
        host: "stagealpha-sistema.alpak.ai",
        origin: "https://evil.test",
        "sec-fetch-site": "same-origin",
      },
    }))).toThrow(/Origem não permitida/);
  });

  it("rejects a missing Origin", () => {
    expect(() => assertBibbleVoiceSameOrigin(new Request("http://127.0.0.1:3000/api/bibble/voice", {
      headers: { host: "stagealpha-sistema.alpak.ai", "sec-fetch-site": "same-origin" },
    }))).toThrow(BibbleVoiceProxyError);
  });

  it("rejects a missing or invalid public Host", () => {
    const headers = { origin: "https://stagealpha-sistema.alpak.ai", "sec-fetch-site": "same-origin" };
    expect(() => assertBibbleVoiceSameOrigin(
      new Request("http://127.0.0.1:3000/api/bibble/voice", { headers }),
    )).toThrow(BibbleVoiceProxyError);
    expect(() => assertBibbleVoiceSameOrigin(new Request("http://127.0.0.1:3000/api/bibble/voice", {
      headers: { ...headers, host: "stagealpha-sistema.alpak.ai/forged" },
    }))).toThrow(/Origem inválida/);
  });

  it("rejects a cross-site Sec-Fetch-Site", () => {
    expect(() => assertBibbleVoiceSameOrigin(new Request("http://127.0.0.1:3000/api/bibble/voice", {
      headers: {
        host: "stagealpha-sistema.alpak.ai",
        origin: "https://stagealpha-sistema.alpak.ai",
        "sec-fetch-site": "cross-site",
      },
    }))).toThrow(/cross-site/);
  });

  it("allows loopback locally and requires HTTPS plus token remotely", () => {
    expect(resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "http://127.0.0.1:8787" }).baseUrl.origin).toBe("http://127.0.0.1:8787");
    expect(() => resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "http://voice.example.test" })).toThrow(/Conexão privada/);
    expect(() => resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "https://voice.example.test" })).toThrow(/Conexão privada/);
    expect(resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "https://voice.example.test", BIBBLE_VOICE_TOKEN: "secret" }).token).toBe("secret");
    expect(() => resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "file:///etc/passwd" })).toThrow();
  });

  it("resolves exact upstream URLs from a root base without changing the host", () => {
    const { baseUrl } = resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "http://127.0.0.1:8787" });

    expect(resolveBibbleVoiceEndpoint(baseUrl, "/health").href).toBe("http://127.0.0.1:8787/health");
    expect(resolveBibbleVoiceEndpoint(baseUrl, "/v1/model/status").href).toBe("http://127.0.0.1:8787/v1/model/status");
    expect(resolveBibbleVoiceEndpoint(baseUrl, "/v1/speech").href).toBe("http://127.0.0.1:8787/v1/speech");
  });

  it("preserves a configured subpath and rejects endpoint authority changes", () => {
    const { baseUrl } = resolveBibbleVoiceConfig({ BIBBLE_VOICE_URL: "http://127.0.0.1:8787/internal/voice/" });

    expect(resolveBibbleVoiceEndpoint(baseUrl, "/health").href).toBe("http://127.0.0.1:8787/internal/voice/health");
    expect(resolveBibbleVoiceEndpoint(baseUrl, "/v1/model/status").href).toBe("http://127.0.0.1:8787/internal/voice/v1/model/status");
    expect(resolveBibbleVoiceEndpoint(baseUrl, "/v1/speech").href).toBe("http://127.0.0.1:8787/internal/voice/v1/speech");
    expect(() => resolveBibbleVoiceEndpoint(baseUrl, "//evil.example.test/v1/speech")).toThrow(/Endpoint de voz inválido/);
  });

  it("accepts only bounded WAV responses", async () => {
    const bytes = wavBytes();
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    expect(isWav(bytes)).toBe(true);
    await expect(readBibbleVoiceAudio(new Response(body, { headers: { "content-type": "audio/wav", "content-length": String(bytes.length) } }))).resolves.toEqual(bytes);
    await expect(readBibbleVoiceAudio(new Response("{}", { headers: { "content-type": "application/json" } }))).rejects.toThrow(/inválida/);
  });

  it("bounds a streamed response without Content-Length and cancels above 25 MiB", async () => {
    let pullCount = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pullCount += 1;
        if (pullCount === 1) controller.enqueue(wavBytes());
        else controller.enqueue(new Uint8Array(BIBBLE_VOICE_AUDIO_MAX_BYTES));
      },
      cancel() { cancelled = true; },
    });
    await expect(readBibbleVoiceAudio(new Response(stream, { headers: { "content-type": "audio/wav" } })))
      .rejects.toThrow(/inválida/);
    expect(cancelled).toBe(true);
  });

  it("uses an independent per-user concurrency and six-per-minute budget", () => {
    const first = acquireBibbleVoiceLease("user-1", 1_000);
    expect(first).not.toBeNull();
    expect(acquireBibbleVoiceLease("user-1", 1_001)).toBeNull();
    first?.release();
    for (let index = 1; index < BIBBLE_VOICE_RATE_LIMIT; index += 1) {
      const lease = acquireBibbleVoiceLease("user-1", 1_001 + index);
      expect(lease).not.toBeNull();
      lease?.release();
    }
    expect(acquireBibbleVoiceLease("user-1", 2_000)).toBeNull();
    expect(acquireBibbleVoiceLease("user-1", 62_000)).not.toBeNull();
  });

  it("limits global voice work to four leases and releases idempotently", () => {
    const leases = Array.from({ length: BIBBLE_VOICE_MAX_GLOBAL_CONCURRENCY }, (_, index) =>
      acquireBibbleVoiceLease(`user-${index}`, 1_000),
    );
    expect(leases.every(Boolean)).toBe(true);
    expect(acquireBibbleVoiceLease("overflow", 1_000)).toBeNull();
    leases[0]?.release();
    leases[0]?.release();
    expect(acquireBibbleVoiceLease("overflow", 1_001)).not.toBeNull();
  });

  it("keeps the proxy deadline below the route maximum", () => {
    expect(BIBBLE_VOICE_TIMEOUT_MS).toBe(570_000);
    expect(BIBBLE_VOICE_TIMEOUT_MS).toBeLessThan(600_000);
  });

  it("keeps secrets server-side and never calls the old TTS or Web Speech", async () => {
    const [route, button, layout, status, env] = await Promise.all([
      readFile("src/app/api/bibble/voice/route.ts", "utf8"),
      readFile("src/components/BibbleChatHome/BotaoFalarMensagem.tsx", "utf8"),
      readFile("src/components/BibbleChatHome/BibbleChatLayout.tsx", "utf8"),
      readFile("src/components/BibbleChatHome/useVoiceStatus.ts", "utf8"),
      readFile(".env.example", "utf8"),
    ]);
    expect(route).toContain("await auth()");
    expect(route).toContain("readRequestTextWithLimit");
    expect(route).toContain("AbortSignal.timeout");
    expect(route).toContain("export const maxDuration = 600");
    expect(route).toContain("acquireBibbleVoiceLease(identity.userId)");
    expect(route).toContain("lease.release()");
    expect(button).toContain('requestBibbleSpeech');
    expect(button).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance|onyx\/voice\/synthesize/);
    expect(layout).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance|onyx\/voice\/synthesize/);
    expect(status).not.toContain("/synthesize");
    expect(status).toContain("voiceData.referenceConfigured === true");
    expect(route).toContain("referenceConfigured: status.referenceConfigured === true");
    expect(route).toContain('status.device === "cuda" || status.device === "cpu"');
    expect(layout).toContain("const isNativeBibbleTurn = selectedAgentRef.current === null");
    expect(layout).toMatch(/voiceAutoPlay:\s*isNativeBibbleTurn/);
    expect(env).toContain("BIBBLE_VOICE_URL=");
    expect(env).not.toContain("NEXT_PUBLIC_BIBBLE_VOICE");
  });

  it("keeps manual voice retry available when health is unavailable", async () => {
    const button = await readFile("src/components/BibbleChatHome/BotaoFalarMensagem.tsx", "utf8");

    expect(button).toContain('disabled={state === "loading"}');
    expect(button).not.toContain('disabled={unavailable || state === "loading"}');
    expect(button).toContain('? "Tentar voz do Bibble"');
    expect(button).toMatch(/if \(!autoPlay \|\| !loaded \|\| !tts_enabled \|\| autoPlayAttemptedRef\.current\) return;/);
    expect(button).toContain('onClick={() => void play(false)}');
  });
});
