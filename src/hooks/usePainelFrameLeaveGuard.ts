"use client";
import { useCallback, useEffect, useRef } from "react";
import { getFrameIdFromPainelFrameName } from "@/lib/painel-embedded";
import { ALPHA_GUARD_STATE, ALPHA_LEAVE_REQUEST, ALPHA_LEAVE_RESULT, isPainelLeaveMessage } from "@/lib/painel-leave-guard";
import { toast } from "sonner";

/** Só protege operações que realmente desmontam/reutilizam um iframe; ativar abas continua livre. */
export function usePainelFrameLeaveGuard(iframes: React.RefObject<Map<string, HTMLIFrameElement>>, ativar: (id: string) => void) {
  const suportados = useRef(new Map<string, { iframe: HTMLIFrameElement; pending: boolean }>());
  const pedidos = useRef(new Map<string, { frameId: string; iframe: HTMLIFrameElement; resolver: (allowed: boolean) => void }>());
  useEffect(() => {
    function receber(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isPainelLeaveMessage(event.data)) return;
      const m = event.data;
      const iframe = [...iframes.current.values()].find((frame) => frame.contentWindow === event.source && getFrameIdFromPainelFrameName(frame.name) === m.frameId);
      if (!iframe) return;
      if (m.type === ALPHA_GUARD_STATE) suportados.current.set(m.frameId, { iframe, pending: m.pending });
      if (m.type === ALPHA_LEAVE_RESULT) {
        const pedido = pedidos.current.get(m.requestId);
        if (pedido?.frameId === m.frameId && pedido.iframe === iframe) pedido.resolver(m.allowed);
      }
    }
    function protegerJanela(event: BeforeUnloadEvent) {
      if (![...suportados.current].some(([id, frame]) => frame.pending && [...iframes.current.values()].some((el) => el === frame.iframe && getFrameIdFromPainelFrameName(el.name) === id))) return;
      event.preventDefault(); event.returnValue = "";
    }
    window.addEventListener("message", receber); window.addEventListener("beforeunload", protegerJanela);
    const requests = pedidos.current;
    return () => { window.removeEventListener("message", receber); window.removeEventListener("beforeunload", protegerJanela); for (const p of requests.values()) p.resolver(false); };
  }, [iframes]);
  return useCallback(async (tabId: string, executar: () => void) => {
    const iframe = iframes.current.get(tabId); const frameId = iframe && getFrameIdFromPainelFrameName(iframe.name);
    const suporte = frameId ? suportados.current.get(frameId) : null;
    if (!iframe || !frameId || suporte?.iframe !== iframe) { executar(); return; }
    if ([...pedidos.current.values()].some((p) => p.frameId === frameId)) return;
    ativar(tabId);
    const requestId = crypto.randomUUID();
    const allowed = await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        toast.error("A aba não confirmou a saída. Confira as alterações pendentes antes de tentar novamente."); resolver(false);
      }, 120_000);
      function resolver(value: boolean) { window.clearTimeout(timer); pedidos.current.delete(requestId); resolve(value); }
      pedidos.current.set(requestId, { frameId, iframe, resolver });
      iframe.contentWindow?.postMessage({ type: ALPHA_LEAVE_REQUEST, version: 1, frameId, requestId }, window.location.origin);
    });
    if (allowed && iframes.current.get(tabId) === iframe && getFrameIdFromPainelFrameName(iframe.name) === frameId) {
      suportados.current.delete(frameId); executar();
    }
  }, [iframes, ativar]);
}
