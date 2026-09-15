export const PAINEL_EMBED_PARAM = "__alphaEmbedded";
export const PAINEL_FRAME_ID_PARAM = "__alphaFrameId";
export const PAINEL_EMBED_HEADER = "x-alpha-embedded";
export const PAINEL_FRAME_ID_HEADER = "x-alpha-frame-id";

export const ALPHA_EMBED_READY = "ALPHA_EMBED_READY";
export const ALPHA_EMBED_LOADING = "ALPHA_EMBED_LOADING";
export const ALPHA_EMBED_PROTOCOL_VERSION = 1;
export const PAINEL_EMBED_READY_TIMEOUT_MS = 15_000;

const PAINEL_BASE_URL = "https://painel-alpha.internal";
const FRAME_ID_PATTERN = /^[a-zA-Z0-9:_-]{1,160}$/;
const TAB_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;

export type PainelFrameStatus = "loading" | "ready" | "error";

export interface PainelFrameRuntimeState {
  attempt: number;
  status: PainelFrameStatus;
}

export type PainelFrameRuntimeByTab = Record<string, PainelFrameRuntimeState>;

export interface AlphaEmbedMessage {
  type: typeof ALPHA_EMBED_READY | typeof ALPHA_EMBED_LOADING;
  version: typeof ALPHA_EMBED_PROTOCOL_VERSION;
  frameId: string;
}

export function isValidPainelFrameId(value: string | null | undefined): value is string {
  return typeof value === "string" && FRAME_ID_PATTERN.test(value);
}

export function createPainelFrameId(tabId: string, attempt: number): string {
  if (typeof tabId !== "string" || tabId.length === 0 || !Number.isSafeInteger(attempt) || attempt < 0) {
    throw new Error("Identificador de iframe do Painel Alpha inválido");
  }

  const normalizedTabId = TAB_ID_PATTERN.test(tabId)
    ? tabId
    : `tab-${hashPainelTabId(tabId)}`;
  return `${normalizedTabId}:${attempt}`;
}

function hashPainelTabId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createPainelFrameName(frameId: string): string {
  if (!isValidPainelFrameId(frameId)) {
    throw new Error("Identificador de iframe do Painel Alpha inválido");
  }

  return `alpha-panel-frame:${frameId}`;
}

export function getFrameIdFromPainelFrameName(frameName: string): string | null {
  const prefix = "alpha-panel-frame:";
  if (!frameName.startsWith(prefix)) return null;

  const frameId = frameName.slice(prefix.length);
  return isValidPainelFrameId(frameId) ? frameId : null;
}

export function derivePainelEmbeddedUrl(canonicalUrl: string, frameId: string): string {
  if (!isValidPainelFrameId(frameId)) {
    throw new Error("Identificador de iframe do Painel Alpha inválido");
  }

  const url = new URL(canonicalUrl, PAINEL_BASE_URL);
  if (!isPainelCanonicalUrl(canonicalUrl)) {
    throw new Error("Apenas rotas internas do Painel Alpha podem ser embutidas");
  }

  url.searchParams.set(PAINEL_EMBED_PARAM, "1");
  url.searchParams.set(PAINEL_FRAME_ID_PARAM, frameId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function isPainelCanonicalUrl(value: string): boolean {
  try {
    const url = new URL(value, PAINEL_BASE_URL);
    return (
      url.origin === PAINEL_BASE_URL &&
      (url.pathname === "/PainelAlpha" || url.pathname.startsWith("/PainelAlpha/"))
    );
  } catch {
    return false;
  }
}

export function isPainelEmbeddedMarker(value: string | null): boolean {
  return value === "1";
}

export function isPainelIframeDestination(value: string | null): boolean {
  return value?.trim().toLowerCase() === "iframe";
}

export function isAlphaEmbedMessage(value: unknown): value is AlphaEmbedMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  const validType = candidate.type === ALPHA_EMBED_READY || candidate.type === ALPHA_EMBED_LOADING;

  return (
    validType &&
    candidate.version === ALPHA_EMBED_PROTOCOL_VERSION &&
    typeof candidate.frameId === "string" &&
    isValidPainelFrameId(candidate.frameId)
  );
}

export function getPainelFrameRuntimeState(
  states: PainelFrameRuntimeByTab,
  tabId: string,
): PainelFrameRuntimeState {
  return states[tabId] ?? { attempt: 0, status: "loading" };
}

export function setPainelFrameStatus(
  states: PainelFrameRuntimeByTab,
  tabId: string,
  attempt: number,
  status: PainelFrameStatus,
): PainelFrameRuntimeByTab {
  const current = getPainelFrameRuntimeState(states, tabId);
  if (current.attempt !== attempt) return states;

  return { ...states, [tabId]: { attempt, status } };
}

export function retryPainelFrame(
  states: PainelFrameRuntimeByTab,
  tabId: string,
): PainelFrameRuntimeByTab {
  const current = getPainelFrameRuntimeState(states, tabId);
  return {
    ...states,
    [tabId]: { attempt: current.attempt + 1, status: "loading" },
  };
}

export function removePainelFrameState(
  states: PainelFrameRuntimeByTab,
  tabId: string,
): PainelFrameRuntimeByTab {
  if (!(tabId in states)) return states;

  const next = { ...states };
  delete next[tabId];
  return next;
}
