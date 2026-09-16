"use client";

import { useEffect, useState } from "react";

export interface VoiceStatus {
  stt_enabled: boolean;
  tts_enabled: boolean;
  loaded: boolean;
  /** Refere-se somente ao STT: true usa SpeechRecognition no navegador. */
  nativeMode: boolean;
  modelLoaded: boolean;
  referenceConfigured: boolean;
  device: "cpu" | "cuda" | "unavailable";
}

type FetchVoiceStatus = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type VoiceStatusListener = (status: VoiceStatus) => void;

const STATUS_TTL_MS = 60_000;
const FAILURE_RETRY_MS = 10_000;
const EMPTY_STATUS: VoiceStatus = {
  stt_enabled: false,
  tts_enabled: false,
  loaded: false,
  nativeMode: false,
  modelLoaded: false,
  referenceConfigured: false,
  device: "unavailable",
};

let cache: VoiceStatus | null = null;
let cacheTs = 0;
let refreshAfterMs = STATUS_TTL_MS;
let inFlight: Promise<VoiceStatus> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<VoiceStatusListener>();

function nativeSttAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const browser = window as unknown as Record<string, unknown>;
  return !!(browser.SpeechRecognition || browser.webkitSpeechRecognition);
}

async function fetchJson(
  fetchStatus: FetchVoiceStatus,
  url: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const response = await fetchStatus(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<Record<string, unknown>>;
}

function notify(status: VoiceStatus): void {
  for (const listener of listeners) listener(status);
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (listeners.size === 0) return;
  const delay = Math.max(0, cacheTs + refreshAfterMs - Date.now());
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshBibbleVoiceStatus();
  }, delay);
}

/** Compartilhado por todas as bolhas: no máximo um par de health checks em voo. */
export function refreshBibbleVoiceStatus(
  fetchStatus: FetchVoiceStatus = fetch,
  now = Date.now(),
): Promise<VoiceStatus> {
  if (inFlight) return inFlight;
  if (cache && now - cacheTs < refreshAfterMs) return Promise.resolve(cache);

  const nativeStt = nativeSttAvailable();
  inFlight = Promise.allSettled([
    fetchJson(fetchStatus, "/api/onyx/voice/status", 5_000),
    fetchJson(fetchStatus, "/api/bibble/voice", 5_000),
  ]).then(([sttResult, ttsResult]) => {
    const onyxStt = sttResult.status === "fulfilled" && sttResult.value.stt_enabled === true;
    const voiceData = ttsResult.status === "fulfilled"
      ? ttsResult.value.data as { status?: unknown; cuda?: unknown; device?: unknown; modelLoaded?: unknown; referenceConfigured?: unknown } | undefined
      : undefined;
    const result: VoiceStatus = {
      stt_enabled: onyxStt || nativeStt,
      tts_enabled: voiceData?.status === "ok"
        && (voiceData.device === "cpu" || (voiceData.device === "cuda" && voiceData.cuda === true))
        && voiceData.referenceConfigured === true,
      loaded: true,
      nativeMode: !onyxStt,
      modelLoaded: voiceData?.modelLoaded === true,
      referenceConfigured: voiceData?.referenceConfigured === true,
      device: voiceData?.device === "cpu" || voiceData?.device === "cuda" ? voiceData.device : "unavailable",
    };
    cache = result;
    cacheTs = now;
    refreshAfterMs = sttResult.status === "rejected" || ttsResult.status === "rejected"
      ? FAILURE_RETRY_MS
      : STATUS_TTL_MS;
    notify(result);
    return result;
  }).finally(() => {
    inFlight = null;
    scheduleRefresh();
  });
  return inFlight;
}

/** Consulta apenas endpoints de status; nunca gera áudio para testar disponibilidade. */
export function useVoiceStatus(): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>(cache ?? EMPTY_STATUS);

  useEffect(() => {
    listeners.add(setStatus);
    void refreshBibbleVoiceStatus();
    scheduleRefresh();
    return () => {
      listeners.delete(setStatus);
      if (listeners.size === 0 && refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }
    };
  }, []);

  return status;
}

export function resetVoiceStatusCacheForTests(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  cache = null;
  cacheTs = 0;
  refreshAfterMs = STATUS_TTL_MS;
  inFlight = null;
  listeners.clear();
}
