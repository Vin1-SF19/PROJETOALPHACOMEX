"use client";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { encontrarAbaCrm, type PainelTab } from "@/lib/painel-tabs";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT, BPM_CARD_PRONTO_EVENT,
} from "@/lib/bpm/notificacoes-tarefas";

import { intencaoNotificacaoBpmDaUrl, intencaoNotificacaoBpmSchema, mesmaIntencaoNotificacaoBpm, type IntencaoNotificacaoBpm } from "@/lib/bpm/notificacoes-navegacao";

type IntencaoPendente = IntencaoNotificacaoBpm & { url: string; navegacao?: string };
function urlDoFrame(frame?: HTMLIFrameElement): URL | null {
  try { return frame?.contentWindow ? new URL(frame.contentWindow.location.href) : null; } catch { return null; }
}
function documentoCorresponde(atual: URL | null, intencao: IntencaoPendente): boolean {
  return Boolean(atual && atual.origin === window.location.origin
    && atual.pathname === `/PainelAlpha/AlphaCRM/pipeline/${encodeURIComponent(intencao.pipelineId)}`
    && (!intencao.navegacao || atual.searchParams.get("__crmAlerta") === intencao.navegacao));
}

/** Reutiliza o CRM; a URL navega entre funis e a intenção substitui o card no mesmo funil. */
export function useBpmCardNotificacaoNavigation(tabs: PainelTab[],
  iframes: RefObject<Map<string, HTMLIFrameElement>>, openTab: (url: string, label: string, reutilizarTabId?: string) => void, usuarioId?: number) {
  const pendente = useRef<IntencaoPendente | null>(null);
  const sequencia = useRef(0);
  useEffect(() => { pendente.current = null; }, [usuarioId]);
  const entregar = useCallback(() => {
    const intencao = pendente.current;
    const aba = intencao ? tabs.find((tab) => tab.url === intencao.url) : undefined;
    const frame = aba ? iframes.current.get(aba.id) : undefined;
    if (intencao && documentoCorresponde(urlDoFrame(frame), intencao)) frame?.contentWindow?.postMessage({
      type: BPM_CARD_ABRIR_EVENT, ...(intencao.cardId ? { cardId: intencao.cardId } : {}), pipelineId: intencao.pipelineId,
      ...(intencao.tarefaId ? { tarefaId: intencao.tarefaId } : {}),
      ...(intencao.abaInicial ? { abaInicial: intencao.abaInicial } : {}),
      ...(intencao.recepcaoId ? { recepcaoId: intencao.recepcaoId } : {}),
      ...(intencao.leadId ? { leadId: intencao.leadId, origemLead: intencao.origemLead } : {}),
    }, window.location.origin);
  }, [tabs, iframes]);
  useEffect(() => {
    entregar();
    const handler = (event: MessageEvent) => {
      const intencao = pendente.current;
      if (!intencao || event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
      const aba = tabs.find((tab) => tab.url === intencao.url);
      if (!aba || event.source !== iframes.current.get(aba.id)?.contentWindow) return;
      if (!documentoCorresponde(urlDoFrame(iframes.current.get(aba.id)), intencao)) return;
      if (event.data.type === BPM_CARD_PRONTO_EVENT) entregar();
      const confirmacao = intencaoNotificacaoBpmSchema.safeParse(event.data);
      if (event.data.type === BPM_CARD_ABERTO_EVENT && confirmacao.success
        && mesmaIntencaoNotificacaoBpm(confirmacao.data, intencao)) pendente.current = null;
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [tabs, iframes, entregar]);
  return useCallback((url: string, label: string) => {
    const intencao = intencaoNotificacaoBpmDaUrl(url);
    if (!intencao) {
      pendente.current = null;
      const checklist = url === "/PainelAlpha/CheckList" || url.startsWith("/PainelAlpha/CheckList/");
      const existing = checklist ? tabs.find(tab => tab.url === "/PainelAlpha/CheckList" || tab.url.startsWith("/PainelAlpha/CheckList/")) : undefined;
      openTab(url, label, existing?.id); return;
    }
    const aba = encontrarAbaCrm(tabs);
    let destino = url;
    let navegacao: string | undefined;
    if (aba) {
      const atual = urlDoFrame(iframes.current.get(aba.id));
      const navegando = pendente.current && !documentoCorresponde(atual, pendente.current);
      if (!navegando && documentoCorresponde(atual, { ...intencao, url })) destino = aba.url;
      else {
        // Força uma nova navegação mesmo se a aba ainda guarda a URL de um documento antigo.
        navegacao = `${Date.now()}-${++sequencia.current}`;
        const nova = new URL(url, window.location.origin);
        nova.searchParams.set("__crmAlerta", navegacao);
        destino = `${nova.pathname}${nova.search}`;
      }
    }
    pendente.current = { ...intencao, url: destino, navegacao };
    openTab(destino, "CRM", aba?.id);
    entregar();
  }, [openTab, entregar, tabs, iframes]);
}
