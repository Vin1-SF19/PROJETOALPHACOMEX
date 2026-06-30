"use client";

import { useState, useEffect } from "react";

interface VoiceStatus {
  stt_enabled: boolean;
  tts_enabled: boolean;
  loaded: boolean;
  /** true = usa Web Speech API nativa (sem Onyx) */
  nativeMode: boolean;
}

let cache: VoiceStatus | null = null;
let cacheTs = 0;
const TTL = 60_000;

/**
 * Detecta suporte à Web Speech API no browser.
 * Retorna quais recursos estão disponíveis nativamente.
 */
function detectNativeSupport(): { stt: boolean; tts: boolean } {
  if (typeof window === "undefined") return { stt: false, tts: false };
  const w = window as unknown as Record<string, unknown>;
  const stt = !!(w["SpeechRecognition"] || w["webkitSpeechRecognition"]);
  const tts = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  return { stt, tts };
}

/**
 * Status do serviço de voz.
 * Tenta o Onyx primeiro; se falhar ou timeout (5s), usa Web Speech API nativa.
 * Cache em módulo com TTL de 1 min.
 */
export function useVoiceStatus(): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>(
    cache ?? { stt_enabled: false, tts_enabled: false, loaded: false, nativeMode: false },
  );

  useEffect(() => {
    const cacheValido =
      cache &&
      Date.now() - cacheTs < TTL &&
      (cache.stt_enabled || cache.tts_enabled);

    if (cacheValido) return;

    let ativo = true;

    const nativo = detectNativeSupport();

    // Tenta o Onyx com timeout curto (5s). Se falhar, usa modo nativo.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);

    fetch("/api/onyx/voice/status", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { stt_enabled?: boolean; tts_enabled?: boolean }) => {
        clearTimeout(timer);
        // Onyx respondeu: usa as flags dele, mas complementa com nativo se necessário
        const stt = !!d.stt_enabled || nativo.stt;
        const tts = !!d.tts_enabled || nativo.tts;
        // Testa se o Onyx TTS realmente funciona com um ping rápido
        testOnyxTts().then((onyxTtsOk) => {
          const result: VoiceStatus = {
            stt_enabled: stt,
            tts_enabled: tts,
            loaded: true,
            // nativeMode = verdadeiro se Onyx TTS não funciona (usa fallback nativo)
            nativeMode: !onyxTtsOk,
          };
          cache = result;
          cacheTs = Date.now();
          if (ativo) setStatus(result);
        });
      })
      .catch(() => {
        clearTimeout(timer);
        // Onyx inacessível → usa modo nativo puro
        const result: VoiceStatus = {
          stt_enabled: nativo.stt,
          tts_enabled: nativo.tts,
          loaded: true,
          nativeMode: true,
        };
        cache = result;
        cacheTs = Date.now();
        if (ativo) setStatus(result);
      });

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, []);

  return status;
}

/** Verifica se o Onyx TTS está respondendo (ping rápido com timeout curto). */
async function testOnyxTts(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6_000);
    const res = await fetch("/api/onyx/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "ok" }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
