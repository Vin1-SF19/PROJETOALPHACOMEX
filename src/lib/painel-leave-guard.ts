import { getFrameIdFromPainelFrameName, isValidPainelFrameId, PAINEL_FRAME_ID_PARAM } from "@/lib/painel-embedded";

export const ALPHA_GUARD_STATE = "ALPHA_GUARD_STATE";
export const ALPHA_LEAVE_REQUEST = "ALPHA_LEAVE_REQUEST";
export const ALPHA_LEAVE_RESULT = "ALPHA_LEAVE_RESULT";
export type PainelLeaveMessage =
  | { type: typeof ALPHA_GUARD_STATE; version: 1; frameId: string; pending: boolean }
  | { type: typeof ALPHA_LEAVE_REQUEST; version: 1; frameId: string; requestId: string }
  | { type: typeof ALPHA_LEAVE_RESULT; version: 1; frameId: string; requestId: string; allowed: boolean };

export function isPainelLeaveMessage(input: unknown): input is PainelLeaveMessage {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const m = input as Record<string, unknown>;
  if (m.version !== 1 || !isValidPainelFrameId(typeof m.frameId === "string" ? m.frameId : null)) return false;
  if (m.type === ALPHA_GUARD_STATE) return typeof m.pending === "boolean";
  const requestIdOk = typeof m.requestId === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(m.requestId);
  return requestIdOk && (m.type === ALPHA_LEAVE_REQUEST || m.type === ALPHA_LEAVE_RESULT && typeof m.allowed === "boolean");
}

export function frameIdDoDocumento(): string | null {
  const query = new URL(window.location.href).searchParams.get(PAINEL_FRAME_ID_PARAM);
  return isValidPainelFrameId(query) ? query : getFrameIdFromPainelFrameName(window.name);
}

export interface NavigationGuardEvent extends Event {
  destination: { url: string; key: string; sameDocument: boolean };
  navigationType: "push" | "replace" | "reload" | "traverse";
}
export interface BrowserNavigationGuard {
  addEventListener(type: "navigate", handler: (event: NavigationGuardEvent) => void): void;
  removeEventListener(type: "navigate", handler: (event: NavigationGuardEvent) => void): void;
  traverseTo(key: string): unknown;
}
