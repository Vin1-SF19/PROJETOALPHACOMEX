"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { sessaoPermiteOperacao } from "@/lib/auth/estado-acesso";
import { comPrazoHttp } from "@/lib/http-deadline";
import { codigoPublicoIA } from "@/lib/ai-availability-client";
import { esperaRetryAfter } from "@/lib/painel-polling";

export interface VoiceStatus {
  unavailableCode?: string;
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
let knownIdentity: string | null | undefined;
let identityAllowed = true;
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
  constructor(readonly retryAfterMs: number, readonly code: string) {
    super("Voz temporariamente indisponível");
  }
}

function canPoll(): boolean {
  return identityAllowed && (typeof document === "undefined" || document.visibilityState !== "hidden")
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
  return comPrazoHttp(timeoutMs, signal, async (bounded) => {
    const response = await fetchStatus(url, { signal: bounded });
    const body: unknown = await response.json();
    if (!response.ok) throw new VoiceStatusError(esperaRetryAfter(response.headers.get("Retry-After")), codigoPublicoIA(body));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new VoiceStatusError(0, "AI_UPSTREAM_UNAVAILABLE");
    return body as Record<string, unknown>;
  });
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
    fetchJson(fetchStatus, "/api/onyx/voice/status", 30_000, controller.signal),
    fetchJson(fetchStatus, "/api/bibble/voice", 30_000, controller.signal),
  ]).then(([sttResult, ttsResult]) => {
    if (controller.signal.aborted || generation !== requestGeneration) return cache ?? EMPTY_STATUS;
    const onyxStt = sttResult.status === "fulfilled" && sttResult.value.stt_enabled === true;
    const voiceData = ttsResult.status === "fulfilled"
      ? ttsResult.value.data as { status?: unknown; cuda?: unknown; device?: unknown; modelLoaded?: unknown; referenceConfigured?: unknown } | undefined
      : undefined;
    const failedCheck = [sttResult, ttsResult].find((check) => check.status === "rejected");
    const unavailableCode = failedCheck?.status === "rejected"
      ? failedCheck.reason instanceof VoiceStatusError ? failedCheck.reason.code : "AI_UPSTREAM_UNAVAILABLE"
      : undefined;
    const result: VoiceStatus = {
      unavailableCode,
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
  const { data: session } = useSession();
  const identity = sessaoPermiteOperacao(session) ? session?.user?.id ?? null : null;
  const subscribeForUser = useCallback((listener: VoiceStatusListener) => {
    if (knownIdentity !== identity) {
      requestGeneration++;
      inFlightController?.abort();
      inFlight = null; inFlightController = null;
      cache = null; cacheTs = 0; consecutiveFailures = 0; refreshAfterMs = STATUS_TTL_MS;
      knownIdentity = identity; identityAllowed = !!identity;
      notify();
    }
    return subscribe(listener);
  }, [identity]);
  const status = useSyncExternalStore(subscribeForUser, getSnapshot, () => EMPTY_STATUS);
  return identity && knownIdentity === identity ? status : EMPTY_STATUS;
}

export function resetVoiceStatusCacheForTests(): void {
  knownIdentity = undefined; identityAllowed = true;
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
