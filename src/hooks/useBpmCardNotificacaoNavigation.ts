"use client";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { PainelTab } from "@/lib/painel-tabs";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT, BPM_CARD_PRONTO_EVENT,
  intencaoCardBpmDaUrl, type IntencaoCardBpm } from "@/lib/bpm/notificacoes-tarefas";

/** A URL abre o primeiro acesso; a intenção reabre o card numa aba já existente. */
export function useBpmCardNotificacaoNavigation(tabs: PainelTab[],
  iframes: RefObject<Map<string, HTMLIFrameElement>>, openTab: (url: string, label: string) => void) {
  const pendente = useRef<(IntencaoCardBpm & { url: string }) | null>(null);
  const entregar = useCallback(() => {
    const intencao = pendente.current;
    const aba = intencao ? tabs.find((tab) => tab.url === intencao.url) : undefined;
    if (aba && intencao) iframes.current.get(aba.id)?.contentWindow?.postMessage({
      type: BPM_CARD_ABRIR_EVENT, cardId: intencao.cardId, pipelineId: intencao.pipelineId,
    }, window.location.origin);
  }, [tabs, iframes]);
  useEffect(() => {
    entregar();
    const handler = (event: MessageEvent) => {
      const intencao = pendente.current;
      if (!intencao || event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
      const aba = tabs.find((tab) => tab.url === intencao.url);
      if (!aba || event.source !== iframes.current.get(aba.id)?.contentWindow) return;
      if (event.data.type === BPM_CARD_PRONTO_EVENT) entregar();
      if (event.data.type === BPM_CARD_ABERTO_EVENT && event.data.cardId === intencao.cardId
        && event.data.pipelineId === intencao.pipelineId) pendente.current = null;
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [tabs, iframes, entregar]);
  return useCallback((url: string, label: string) => {
    const intencao = intencaoCardBpmDaUrl(url);
    if (intencao) pendente.current = { ...intencao, url };
    openTab(url, label);
    if (intencao) entregar();
  }, [openTab, entregar]);
}
