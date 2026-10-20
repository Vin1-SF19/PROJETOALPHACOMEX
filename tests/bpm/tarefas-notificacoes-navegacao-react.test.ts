// @vitest-environment happy-dom
import { act, createElement as h, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBpmCardNotificacaoNavigation } from "@/hooks/useBpmCardNotificacaoNavigation";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT, BPM_CARD_PRONTO_EVENT } from "@/lib/bpm/notificacoes-tarefas";
const cardId = "cm12345678901234567890123";
const url = `/PainelAlpha/AlphaCRM/pipeline/pipeline-1?cardId=${cardId}`;
const tabs = [{ id: "tab-1", url, label: "CRM" }];
const postMessage = vi.fn(); const openTab = vi.fn();
const frameWindow = { postMessage } as unknown as Window;
const iframes = { current: new Map([["tab-1", { contentWindow: frameWindow } as HTMLIFrameElement]]) };
let abrir!: (url: string, label: string) => void;
function Harness() {
  const navegar = useBpmCardNotificacaoNavigation(tabs, iframes, openTab);
  useEffect(() => { abrir = navegar; }, [navegar]);
  return null;
}
describe("reabertura do card pela mesma notificação", () => {
  let root: Root; let host: HTMLDivElement;
  beforeEach(async () => {
    vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(h(Harness)));
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
  const mensagem = (type: string, source = frameWindow, origin = window.location.origin) => window.dispatchEvent(new MessageEvent("message", {
    source, origin, data: { type, cardId, pipelineId: "pipeline-1" },
  }));
  it("envia nova intenção mesmo quando a aba já existe e o modal foi fechado", () => {
    abrir(url, "CRM"); mensagem(BPM_CARD_ABERTO_EVENT);
    abrir(url, "CRM");
    expect(openTab).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABRIR_EVENT, cardId, pipelineId: "pipeline-1" }, window.location.origin);
  });
  it("reenvia quando o board fica pronto e rejeita mensagens de outra origem ou frame", () => {
    abrir(url, "CRM");
    mensagem(BPM_CARD_PRONTO_EVENT, frameWindow, "https://outro.test");
    mensagem(BPM_CARD_PRONTO_EVENT, {} as Window);
    expect(postMessage).toHaveBeenCalledOnce();
    mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).toHaveBeenCalledTimes(2);
    mensagem(BPM_CARD_ABERTO_EVENT);
    mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });
});
