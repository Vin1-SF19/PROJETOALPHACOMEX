import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

import { createBibbleAudioManager, type BibbleAudioState } from "@/components/BibbleChatHome/bibble-audio-manager";
import { refreshBibbleVoiceStatus, resetVoiceStatusCacheForTests } from "@/components/BibbleChatHome/useVoiceStatus";
import { cleanBibbleSpeechText, requestBibbleSpeech, resetBibbleSpeechRequestsForTests } from "@/lib/bibble/voice-client";
import { DEFAULT_BIBBLE_VOICE_PREFERENCES, readBibbleVoicePreferences, shouldAutoPlayBibbleVoice } from "@/lib/bibble/voice-preferences";

class FakeAudio {
  currentTime = 0;
  onended: ((event: Event) => void) | null = null;
  onerror: ((event: Event | string) => void) | null = null;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetBibbleSpeechRequestsForTests();
  resetVoiceStatusCacheForTests();
});

describe("Bibble browser voice", () => {
  it("removes markup and HTML before synthesis", () => {
    expect(cleanBibbleSpeechText("# Olá <b>mundo</b> [site](https://x.test) `código`"))
      .toBe("Olá mundo site código");
  });

  it("deduplicates generation by message and retries after a failure", async () => {
    const fetchMock = vi.fn(async () => new Response(new Blob(["wav"]), { headers: { "content-type": "audio/wav" } }));
    vi.stubGlobal("fetch", fetchMock);
    const first = requestBibbleSpeech("message-1", "Olá");
    const second = requestBibbleSpeech("message-1", "Olá");
    expect(first).toBe(second);
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent status checks across message bubbles", async () => {
    const fetchStatus = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      return Response.json(url.includes("onyx")
        ? { stt_enabled: true }
        : { success: true, data: { status: "ok", device: "cuda", cuda: true, modelLoaded: false, referenceConfigured: true } });
    });
    const first = refreshBibbleVoiceStatus(fetchStatus, 1_000);
    const second = refreshBibbleVoiceStatus(fetchStatus, 1_000);
    expect(first).toBe(second);
    const [status] = await Promise.all([first, second]);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(status.tts_enabled).toBe(true);
    expect(status.device).toBe("cuda");
    await refreshBibbleVoiceStatus(fetchStatus, 1_001);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
  });

  it("keeps TTS healthy on CPU even when CUDA is unavailable", async () => {
    const fetchStatus = vi.fn(async (input: RequestInfo | URL) => Response.json(
      String(input).includes("onyx")
        ? { stt_enabled: true }
        : { success: true, data: { status: "ok", device: "cpu", cuda: false, modelLoaded: false, referenceConfigured: true } },
    ));
    const status = await refreshBibbleVoiceStatus(fetchStatus, 1_000);
    expect(status.tts_enabled).toBe(true);
    expect(status.device).toBe("cpu");
  });

  it("uses a shorter controlled retry after status failure", async () => {
    const fetchStatus = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/bibble/voice")) throw new Error("offline");
      return Response.json({ stt_enabled: true });
    });
    expect((await refreshBibbleVoiceStatus(fetchStatus, 1_000)).tts_enabled).toBe(false);
    await refreshBibbleVoiceStatus(fetchStatus, 10_999);
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    await refreshBibbleVoiceStatus(fetchStatus, 11_001);
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("stops the previous owner, keeps one playback and revokes object URLs", async () => {
    const audios: FakeAudio[] = [];
    const revoked: string[] = [];
    const statesA: BibbleAudioState[] = [];
    const statesB: BibbleAudioState[] = [];
    const manager = createBibbleAudioManager(
      () => { const audio = new FakeAudio(); audios.push(audio); return audio; },
      { createObjectURL: value => `blob:${value instanceof Blob ? value.size : 0}:${audios.length}`, revokeObjectURL: url => revoked.push(url) },
    );
    await manager.play("a", new Blob(["a"]), state => statesA.push(state));
    await manager.play("b", new Blob(["b"]), state => statesB.push(state));
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(statesA).toContain("ready");
    expect(statesB).toContain("playing");
    expect(revoked).toHaveLength(1);
    expect(manager.pause("b")).toBe(true);
    expect(statesB).toContain("paused");
    manager.stop("b");
    expect(revoked).toHaveLength(2);
  });

  it("uses safe voice preferences when storage is empty or malformed", () => {
    expect(readBibbleVoicePreferences({ getItem: () => null }, 1)).toEqual(DEFAULT_BIBBLE_VOICE_PREFERENCES);
    expect(readBibbleVoicePreferences({ getItem: () => "{" }, 1)).toEqual(DEFAULT_BIBBLE_VOICE_PREFERENCES);
    expect(readBibbleVoicePreferences({ getItem: () => JSON.stringify({ showButton: false }) }, 1)).toEqual({ replyToAudio: true, showButton: false, autoPlayAll: false });
  });

  it("autoplays audio-origin replies by default but never text-origin replies", () => {
    expect(shouldAutoPlayBibbleVoice(true, DEFAULT_BIBBLE_VOICE_PREFERENCES)).toBe(true);
    expect(shouldAutoPlayBibbleVoice(false, DEFAULT_BIBBLE_VOICE_PREFERENCES)).toBe(false);
    expect(shouldAutoPlayBibbleVoice(true, { ...DEFAULT_BIBBLE_VOICE_PREFERENCES, replyToAudio: false })).toBe(false);
    expect(shouldAutoPlayBibbleVoice(false, { ...DEFAULT_BIBBLE_VOICE_PREFERENCES, autoPlayAll: true })).toBe(true);
  });

  it("uses immutable per-message provenance instead of the currently selected agent", async () => {
    const bubble = await readFile("src/components/BibbleChatHome/BibbleMessageBubble.tsx", "utf8");
    const layout = await readFile("src/components/BibbleChatHome/BibbleChatLayout.tsx", "utf8");
    expect(bubble).toContain("visible={showVoiceButton && message.voiceEligible === true}");
    expect(bubble).not.toContain("visible={showVoiceButton && !agentActive}");
    expect(layout).toContain("voiceEligible: isNativeBibbleTurn");
    expect(layout).toMatch(/content: content \+ imgMd, thinkContent, voiceEligible: false/);
    expect(layout).toMatch(/role: "assistant" as const,[\s\S]{0,180}voiceEligible: true/);
    expect(layout).toMatch(/content: "", streaming: true, voiceEligible: false/);
    expect(layout).toContain('content: message, voiceEligible: false');
    expect(layout).toContain('content: "Erro ao criar sessão.", streaming: false, voiceEligible: false');
  });

  it("clears ephemeral audio origin on every conversation or runtime reset", async () => {
    const layout = await readFile("src/components/BibbleChatHome/BibbleChatLayout.tsx", "utf8");
    for (const callback of [
      "loadSession",
      "conversarVazio",
      "quemEhVoceAgente",
      "adicionarAgenteNaConversa",
      "clearAgent",
      "handleNewSession",
    ]) {
      const start = layout.indexOf(`const ${callback} = useCallback`);
      expect(start, callback).toBeGreaterThan(-1);
      expect(layout.slice(start, start + 220), callback).toContain("vozUsadaRef.current = false");
    }
    const deleteReset = layout.indexOf("if (id === activeSessionId)");
    expect(layout.slice(deleteReset, deleteReset + 180)).toContain("vozUsadaRef.current = false");
  });

  it("marks voice only after final transcription and waits for explicit send", async () => {
    const [input, microphone, layout] = await Promise.all([
      readFile("src/components/BibbleChatHome/BibbleChatInput.tsx", "utf8"),
      readFile("src/components/BibbleChatHome/BotaoMicrofone.tsx", "utf8"),
      readFile("src/components/BibbleChatHome/BibbleChatLayout.tsx", "utf8"),
    ]);
    const transcriptCallback = input.split("\n").find(line => line.includes("onTranscrito={(texto)")) ?? "";
    expect(transcriptCallback.indexOf("onChange(")).toBeLessThan(transcriptCallback.indexOf("onVozUsada?.()"));
    expect(transcriptCallback).not.toContain("onSend");
    expect(microphone).toContain("if (text?.trim()) onTranscrito(text.trim())");
    expect(layout.indexOf("const inputWasAudio = vozUsadaRef.current")).toBeLessThan(layout.indexOf('fetch("/api/bibble/chat"'));
    expect(layout.indexOf('fetch("/api/bibble/chat"')).toBeLessThan(layout.indexOf("voiceAutoPlay: isNativeBibbleTurn"));
  });

  it("clears audio provenance when the user edits the transcription manually", async () => {
    const layout = await readFile("src/components/BibbleChatHome/BibbleChatLayout.tsx", "utf8");
    const inputChange = layout.indexOf("onInputChange={(value) => {");
    const microphoneMark = layout.indexOf("onVozUsada={() => { vozUsadaRef.current = true; }}");
    expect(inputChange).toBeGreaterThan(-1);
    expect(layout.slice(inputChange, inputChange + 400)).toMatch(
      /vozUsadaRef\.current = false;[\s\S]*setInputValue\(value\)/,
    );
    expect(microphoneMark).toBeGreaterThan(inputChange);
  });
});
