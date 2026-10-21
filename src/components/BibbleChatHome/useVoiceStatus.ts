"use client";

import { useSyncExternalStore } from "react";

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
type VoiceStatusListener = () => void;

const STATUS_TTL_MS = 60_000;
const MAX_FAILURE_RETRY_MS = 300_000;
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
let consecutiveFailures = 0;
let inFlight: Promise<VoiceStatus> | null = null;
let inFlightController: AbortController | null = null;
let hasManualConsumer = false;
let requestGeneration = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<VoiceStatusListener>();

class VoiceStatusError extends Error {
  constructor(readonly retryAfterMs: number) {
    super("Voz temporariamente indisponível");
  }
}

function retryAfterMs(response: Response): number {
  const value = response.headers.get("Retry-After");
  if (!value) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(value) - Date.now();
  // setTimeout aceita no máximo um inteiro de 32 bits, mesmo para datas HTTP.
  return Number.isFinite(delay) ? Math.min(2_147_483_647, Math.max(0, delay)) : 0;
}

function canPoll(): boolean {
  return (typeof document === "undefined" || document.visibilityState !== "hidden")
    && (typeof navigator === "undefined" || navigator.onLine !== false);
}

function nativeSttAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const browser = window as unknown as Record<string, unknown>;
  return !!(browser.SpeechRecognition || browser.webkitSpeechRecognition);
}

async function fetchJson(
  fetchStatus: FetchVoiceStatus,
  url: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetchStatus(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) });
  if (!response.ok) throw new VoiceStatusError(retryAfterMs(response));
  return response.json() as Promise<Record<string, unknown>>;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (listeners.size === 0 || !canPoll() || inFlight) return;
  const delay = Math.max(0, cacheTs + refreshAfterMs - Date.now());
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshVoiceStatus(fetch, Date.now(), true);
  }, delay);
}

/** Compartilhado por todas as bolhas: no máximo um par de health checks em voo. */
export function refreshBibbleVoiceStatus(
  fetchStatus: FetchVoiceStatus = fetch,
  now = Date.now(),
): Promise<VoiceStatus> {
  return refreshVoiceStatus(fetchStatus, now, false);
}

function refreshVoiceStatus(fetchStatus: FetchVoiceStatus, now: number, background: boolean): Promise<VoiceStatus> {
  if (inFlight) {
    if (!background) hasManualConsumer = true;
    return inFlight;
  }
  if (cache && now - cacheTs < refreshAfterMs) return Promise.resolve(cache);
  if (!canPoll()) return Promise.resolve(cache ?? EMPTY_STATUS);

  const nativeStt = nativeSttAvailable();
  const startedAt = Date.now();
  const generation = ++requestGeneration;
  const controller = new AbortController();
  inFlightController = controller;
  hasManualConsumer = !background;
  inFlight = Promise.allSettled([
    fetchJson(fetchStatus, "/api/onyx/voice/status", 5_000, controller.signal),
    fetchJson(fetchStatus, "/api/bibble/voice", 5_000, controller.signal),
  ]).then(([sttResult, ttsResult]) => {
    if (controller.signal.aborted || generation !== requestGeneration) return cache ?? EMPTY_STATUS;
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
    cacheTs = now + Math.max(0, Date.now() - startedAt);
    const failed = sttResult.status === "rejected" || ttsResult.status === "rejected" || !result.tts_enabled;
    consecutiveFailures = failed ? Math.min(consecutiveFailures + 1, 4) : 0;
    const serverDelay = Math.max(...[sttResult, ttsResult].map(check =>
      check.status === "rejected" && check.reason instanceof VoiceStatusError ? check.reason.retryAfterMs : 0,
    ));
    refreshAfterMs = Math.max(serverDelay, failed
      ? Math.min(MAX_FAILURE_RETRY_MS, STATUS_TTL_MS * 2 ** (consecutiveFailures - 1))
      : STATUS_TTL_MS);
    notify();
    return result;
  }).finally(() => {
    if (generation !== requestGeneration) return;
    inFlight = null;
    inFlightController = null;
    scheduleRefresh();
  });
  return inFlight;
}

function onAvailabilityChange(): void {
  if (canPoll()) void refreshVoiceStatus(fetch, Date.now(), true);
  else cancelBackgroundRequest();
  scheduleRefresh();
}

function cancelBackgroundRequest(): void {
  if (!inFlightController || hasManualConsumer) return;
  requestGeneration++;
  inFlightController.abort();
  inFlightController = null;
  inFlight = null;
}

function subscribe(listener: VoiceStatusListener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onAvailabilityChange);
    window.addEventListener("online", onAvailabilityChange);
    window.addEventListener("offline", onAvailabilityChange);
  }
  void refreshVoiceStatus(fetch, Date.now(), true);
  scheduleRefresh();
  return () => {
    listeners.delete(listener);
    if (listeners.size !== 0) return;
    document.removeEventListener("visibilitychange", onAvailabilityChange);
    window.removeEventListener("online", onAvailabilityChange);
    window.removeEventListener("offline", onAvailabilityChange);
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    cancelBackgroundRequest();
  };
}

function getSnapshot(): VoiceStatus {
  return cache ?? EMPTY_STATUS;
}

/** Consulta apenas endpoints de status; nunca gera áudio para testar disponibilidade. */
export function useVoiceStatus(): VoiceStatus {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATUS);
}

export function resetVoiceStatusCacheForTests(): void {
  requestGeneration++;
  inFlightController?.abort();
  inFlightController = null;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  cache = null;
  cacheTs = 0;
  refreshAfterMs = STATUS_TTL_MS;
  consecutiveFailures = 0;
  inFlight = null;
  listeners.clear();
}
