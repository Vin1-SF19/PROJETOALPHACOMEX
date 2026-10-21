// @vitest-environment happy-dom
import { act, createElement as h, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBpmCardNotificacaoNavigation } from "@/hooks/useBpmCardNotificacaoNavigation";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT, BPM_CARD_PRONTO_EVENT } from "@/lib/bpm/notificacoes-tarefas";
import type { PainelTab } from "@/lib/painel-tabs";
const cardId = "cm12345678901234567890123";
const url = `/PainelAlpha/AlphaCRM/pipeline/pipeline-1?cardId=${cardId}`;
let tabs: PainelTab[];
let usuarioId = 7;
const postMessage = vi.fn(); const openTab = vi.fn();
const frameLocation = { href: `${window.location.origin}${url}` };
const frameWindow = { postMessage, location: frameLocation } as unknown as Window;
const iframes = { current: new Map([["tab-1", { contentWindow: frameWindow } as HTMLIFrameElement]]) };
let abrir!: (url: string, label: string) => void;
function Harness() {
  const navegar = useBpmCardNotificacaoNavigation(tabs, iframes, openTab, usuarioId);
  useEffect(() => { abrir = navegar; }, [navegar]);
  return null;
}
describe("reabertura do card pela mesma notificação", () => {
  let root: Root; let host: HTMLDivElement;
  beforeEach(async () => {
    vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    tabs = [{ id: "tab-1", url, label: "CRM" }]; usuarioId = 7;
    frameLocation.href = `${window.location.origin}${url}`;
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
  it("reutiliza CRM aberto no hub e entrega após navegar ao funil", async () => {
    tabs = [{ id: "tab-1", url: "/PainelAlpha/AlphaCRM", label: "Alpha CRM" }];
    frameLocation.href = `${window.location.origin}/PainelAlpha/AlphaCRM`;
    await act(async () => root.render(h(Harness)));
    abrir(url, "CRM · Tarefa");
    const destino = openTab.mock.lastCall![0];
    expect(destino).toContain(url);
    expect(openTab).toHaveBeenLastCalledWith(destino, "CRM", "tab-1");
    expect(postMessage).not.toHaveBeenCalled();
    tabs = [{ ...tabs[0], url: destino }];
    frameLocation.href = `${window.location.origin}${destino}`;
    await act(async () => root.render(h(Harness)));
    mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABRIR_EVENT, cardId, pipelineId: "pipeline-1" }, window.location.origin);
  });
  it("substitui card/tarefa no mesmo funil e preserva a URL do iframe já montado", () => {
    const outroCard = "cm22345678901234567890123";
    const outro = `/PainelAlpha/AlphaCRM/pipeline/pipeline-1?cardId=${outroCard}&tarefaId=task-2`;
    abrir(outro, "CRM · Tarefa");
    expect(openTab).toHaveBeenLastCalledWith(url, "CRM", "tab-1");
    expect(postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABRIR_EVENT, cardId: outroCard, pipelineId: "pipeline-1", tarefaId: "task-2" }, window.location.origin);
  });
  it("troca de funil na mesma aba e ignora confirmação antiga após o último clique", async () => {
    abrir(url, "CRM");
    const outroCard = "cm22345678901234567890123";
    const outro = `/PainelAlpha/AlphaCRM/pipeline/pipeline-2?cardId=${outroCard}&tarefaId=task-2`;
    abrir(outro, "CRM");
    const destino = openTab.mock.lastCall![0];
    expect(destino).toContain(outro);
    expect(openTab).toHaveBeenLastCalledWith(destino, "CRM", "tab-1");
    tabs = [{ ...tabs[0], url: destino }];
    frameLocation.href = `${window.location.origin}${destino}`;
    await act(async () => root.render(h(Harness)));
    mensagem(BPM_CARD_ABERTO_EVENT);
    postMessage.mockClear(); mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABRIR_EVENT, cardId: outroCard, pipelineId: "pipeline-2", tarefaId: "task-2" }, window.location.origin);
  });
  it("força navegação se a URL registrada já é a do alerta mas o iframe está em outro funil", () => {
    frameLocation.href = `${window.location.origin}/PainelAlpha/AlphaCRM/pipeline/pipeline-2`;
    abrir(url, "CRM");
    const destino = openTab.mock.lastCall![0];
    expect(destino).toContain(url); expect(destino).not.toBe(url);
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("último clique vence quando retorna ao funil antigo antes de a navegação intermediária terminar", async () => {
    const outro = `/PainelAlpha/AlphaCRM/pipeline/pipeline-2?cardId=${cardId}&tarefaId=task-2`;
    abrir(outro, "CRM");
    tabs = [{ ...tabs[0], url: openTab.mock.lastCall![0] }];
    await act(async () => root.render(h(Harness)));
    abrir(`${url}&tarefaId=task-final`, "CRM");
    const final = openTab.mock.lastCall![0];
    expect(final).toContain(`${url}&tarefaId=task-final`);
    expect(final).not.toBe(tabs[0].url);
    tabs = [{ ...tabs[0], url: final }];
    await act(async () => root.render(h(Harness)));
    mensagem(BPM_CARD_ABERTO_EVENT); mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).not.toHaveBeenCalled();
    frameLocation.href = `${window.location.origin}${final}`;
    mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABRIR_EVENT, cardId, pipelineId: "pipeline-1", tarefaId: "task-final" }, window.location.origin);
  });
  it("não deixa ACK de outra tarefa do mesmo card apagar a última intenção", () => {
    abrir(`${url}&tarefaId=task-2`, "CRM");
    mensagem(BPM_CARD_ABERTO_EVENT);
    postMessage.mockClear(); mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).toHaveBeenCalledOnce();
  });
  it("limpa intenção ao trocar a conta e preserva abertura dos demais módulos", async () => {
    abrir(url, "CRM"); usuarioId = 8;
    await act(async () => root.render(h(Harness)));
    postMessage.mockClear(); mensagem(BPM_CARD_PRONTO_EVENT);
    expect(postMessage).not.toHaveBeenCalled();
    abrir("/PainelAlpha/Chamados", "Chamados");
    expect(openTab).toHaveBeenLastCalledWith("/PainelAlpha/Chamados", "Chamados");
  });
  it("abre CRM quando ainda não existe e reconhece pipeline navegado dentro do iframe", async () => {
    tabs = [];
    await act(async () => root.render(h(Harness)));
    abrir(url, "CRM");
    expect(openTab).toHaveBeenLastCalledWith(url, "CRM", undefined);
    tabs = [{ id: "tab-1", url: "/PainelAlpha/AlphaCRM", label: "CRM" }];
    const frame = iframes.current.get("tab-1")!;
    const atual = { postMessage, location: { href: `${window.location.origin}/PainelAlpha/AlphaCRM/pipeline/pipeline-1` } } as unknown as Window;
    iframes.current.set("tab-1", { contentWindow: atual } as HTMLIFrameElement);
    try {
      await act(async () => root.render(h(Harness)));
      abrir(url, "CRM");
      expect(openTab).toHaveBeenLastCalledWith("/PainelAlpha/AlphaCRM", "CRM", "tab-1");
    } finally { iframes.current.set("tab-1", frame); }
  });
});
