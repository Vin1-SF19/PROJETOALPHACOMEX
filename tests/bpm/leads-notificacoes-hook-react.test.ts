// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ info: vi.fn(), custom: vi.fn(), dismiss: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), bind: vi.fn(), unbind: vi.fn(), connected: vi.fn(), disconnected: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@/lib/pusher", () => ({ pusherClient: { subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe, connection: { bind: mocks.connected, unbind: mocks.disconnected } } }));
import { useBpmTarefasNotifications } from "@/hooks/useBpmTarefasNotifications";
import { useBpmLeadsNotificacoes as leads } from "@/store/useBpmLeadsNotificacoes";
import { useBpmTarefasNotificacoes as tarefas } from "@/store/useBpmTarefasNotificacoes";
import { BPM_LEAD_ALERTA_EVENT, type AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
import { BPM_LEADS_RECONCILIAR_EVENT } from "@/lib/bpm/notificacoes-navegacao";
const lead: AlertaLeadBpm = {
  id: "lead:p:instagram:1", tipo: "LEAD_SEM_RESPONSAVEL", fonte: "INSTAGRAM", origem: "INSTAGRAM", pipelineId: "p", pipelineNome: "Comercial",
  etapaId: "novo", etapaNome: "Novo lead", nome: "Cliente fictício", email: null, telefone: null, cnpj: null, resumo: null, recebidoEm: "2026-10-22T12:00:00.000Z",
  destino: { tipo: "LEAD_VIRTUAL", pipelineId: "p", origemLead: "instagram", leadId: "1" }, responsaveisAnteriores: [],
};
function Harness({ usuarioId }: { usuarioId: number }) { useBpmTarefasNotifications(usuarioId, vi.fn()); return null; }
describe("único transporte BPM para tarefas e leads", () => {
  let host: HTMLDivElement; let root: ReturnType<typeof createRoot>; const fetchMock = vi.fn(); let pendentes: AlertaLeadBpm[];
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); localStorage.clear(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    leads.getState().iniciarUsuario(0); tarefas.getState().iniciarUsuario(0); pendentes = [lead];
    mocks.subscribe.mockReturnValue({ bind: mocks.bind, unbind: mocks.unbind });
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url.includes("/leads/")
      ? { alertas: pendentes, proximoCursor: null, snapshotEm: "2026-10-22T12:10:00.000Z" } : { alertas: [], nextCursor: null } }));
    vi.stubGlobal("fetch", fetchMock); host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("uma assinatura/relógio recupera ambas fontes, realtime só invalida e encerra no logout", async () => {
    await act(async () => root.render(h(Harness, { usuarioId: 7 })));
    expect(mocks.subscribe).toHaveBeenCalledExactlyOnceWith("private-bpm-tarefas-usuario-7");
    expect(leads.getState().notificacoes).toHaveLength(1); expect(mocks.custom).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const invalidar = mocks.bind.mock.calls.find(([evento]) => evento === BPM_LEAD_ALERTA_EVENT)![1];
    pendentes = []; await act(async () => invalidar({ pipelineId: "p", timestamp: "agora" }));
    expect(leads.getState().notificacoes).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(fetchMock).toHaveBeenCalledTimes(5); expect(mocks.custom).toHaveBeenCalledOnce();
    await act(async () => root.render(h(Harness, { usuarioId: 0 })));
    expect(leads.getState().notificacoes).toEqual([]); expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    const quantidade = fetchMock.mock.calls.length; await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(fetchMock).toHaveBeenCalledTimes(quantidade);
  });
  it("reconciliação do iframe só aceita origem e janela conhecidas sem confiar no conteúdo", async () => {
    await act(async () => root.render(h(Harness, { usuarioId: 7 })));
    const frame = document.createElement("iframe"); document.body.append(frame);
    const n = fetchMock.mock.calls.length;
    try {
      await act(async () => {
        window.dispatchEvent(new MessageEvent("message", { origin: "https://outro.test", source: frame.contentWindow, data: { type: BPM_LEADS_RECONCILIAR_EVENT } }));
        window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: {} as Window, data: { type: BPM_LEADS_RECONCILIAR_EVENT } }));
      });
      expect(fetchMock).toHaveBeenCalledTimes(n);
      pendentes = []; await act(async () => window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: frame.contentWindow, data: { type: BPM_LEADS_RECONCILIAR_EVENT } })));
      expect(leads.getState().notificacoes).toEqual([]); expect(fetchMock).toHaveBeenCalledTimes(n + 1);
    } finally { frame.remove(); }
  });
});
