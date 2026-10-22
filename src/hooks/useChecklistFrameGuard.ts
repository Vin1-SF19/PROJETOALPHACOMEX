"use client";
import { useEffect, useRef, type RefObject } from "react";
/** Scoped handshake only for an existing Checklist iframe; other modules keep their own behavior. */
export function useChecklistFrameGuard(frames: RefObject<Map<string, HTMLIFrameElement>>, actorId: number) {
  const blocked = useRef(new Set<string>()),
    pending = useRef(new Map<string, { requestId: string; action: () => void }>());
  useEffect(() => {
    const blockedFrames = blocked.current,
      pendingFrames = pending.current;
    blockedFrames.clear();
    pendingFrames.clear();
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
      const entry = [...frames.current].find(([, frame]) => frame.contentWindow === event.source);
      if (!entry) return;
      const [id, frame] = entry;
      let url: URL;
      try {
        url = new URL(frame.contentWindow?.location.href ?? frame.src);
      } catch {
        return;
      }
      if (!url.pathname.startsWith("/PainelAlpha/CheckList/")) return;
      if (event.data.type === "ALPHA_CHECKLIST_DRAFT_STATE") {
        if (event.data.blocked === true) blocked.current.add(id);
        else blocked.current.delete(id);
      }
      if (event.data.type === "ALPHA_CHECKLIST_LEAVE_CANCELLED" && pending.current.get(id)?.requestId === event.data.requestId) pending.current.delete(id);
      if (event.data.type === "ALPHA_CHECKLIST_LEAVE_ALLOWED") {
        const request = pending.current.get(id);
        if (request && request.requestId === event.data.requestId) {
          pending.current.delete(id);
          blocked.current.delete(id);
          request.action();
        }
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      blockedFrames.clear();
      pendingFrames.clear();
    };
  }, [frames, actorId]);
  return (id: string, action: () => void) => {
    const frame = frames.current.get(id);
    if (!frame || !blocked.current.has(id)) {
      action();
      return true;
    }
    if (pending.current.has(id)) return false;
    const requestId = crypto.randomUUID();
    pending.current.set(id, { requestId, action });
    frame.contentWindow?.postMessage({ type: "ALPHA_CHECKLIST_REQUEST_LEAVE", requestId }, window.location.origin);
    return false;
  };
}
