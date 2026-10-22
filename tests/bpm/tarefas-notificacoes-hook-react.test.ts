// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), info: vi.fn(), dismiss: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), bind: vi.fn(), unbind: vi.fn(), connected: vi.fn(), disconnected: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: mocks.info, dismiss: mocks.dismiss } }));
vi.mock("@/lib/pusher", () => ({ pusherClient: {
  subscribe: mocks.subscribe, unsubscribe: mocks.unsubscribe,
  connection: { bind: mocks.connected, unbind: mocks.disconnected },
} }));
vi.mock("@/hooks/bpm-leads-notificacoes-client", () => ({ criarNotificacoesLeadsClient: () => ({ atualizar: vi.fn(), limpar: vi.fn() }) }));
import { useBpmTarefasNotifications } from "@/hooks/useBpmTarefasNotifications";
import { useBpmTarefasNotificacoes as store } from "@/store/useBpmTarefasNotificacoes";
const alerta = {
  id: "task:2026-10-20T14:00:00.000Z", tarefaId: "task", cardId: "card", pipelineId: "pipeline",
  titulo: "Retornar Green Coast", descricao: "Conferir documentos", tipo: "LIGACAO", prioridade: "ALTA",
  alertaEm: "2026-10-20T14:00:00.000Z", prazo: "2026-10-20T15:00:00.000Z",
  empresaNome: "Green Coast", pipelineNome: "Comercial", etapaNome: "Em tratativa", responsavelNome: "Maria",
};
const resposta = (alertas = [alerta], nextCursor: string | null = null) => ({ ok: true, status: 200, json: async () => ({ alertas, nextCursor }) });
const abrir = vi.fn();
function Hook({ usuarioId }: { usuarioId: number }) { useBpmTarefasNotifications(usuarioId, abrir); return null; }
describe("recuperação dos alertas CRM no shell", () => {
  let root: Root; let host: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.stubGlobal("fetch", mocks.fetch);
    localStorage.clear();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    store.getState().iniciarUsuario(0);
    mocks.subscribe.mockReturnValue({ bind: mocks.bind, unbind: mocks.unbind });
    mocks.fetch.mockResolvedValue(resposta());
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  async function render(usuarioId = 7) { await act(async () => root.render(h(Hook, { usuarioId }))); }
  it("recupera ao abrir, deduplica no polling e remove o alerta quando a tarefa deixa de estar pendente", async () => {
    await render();
    expect(mocks.subscribe).toHaveBeenCalledWith("private-bpm-tarefas-usuario-7");
    expect(store.getState().notificacoes).toHaveLength(1);
    expect(mocks.info).toHaveBeenCalledOnce();
    const options = mocks.info.mock.calls[0][1];
    expect(options.description).toContain("11:00"); expect(options.description).toContain("Green Coast");
    options.action.onClick(); expect(abrir).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/pipeline/pipeline?cardId=card&tarefaId=task", "CRM");
    expect(store.getState().notificacoes[0].lida).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2); expect(mocks.info).toHaveBeenCalledOnce();
    mocks.fetch.mockResolvedValue(resposta([]));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(store.getState().notificacoes).toHaveLength(0); expect(mocks.dismiss).toHaveBeenCalled();
  });
  it("não repete o toast após remontar e mantém a leitura do clique", async () => {
    await render();
    mocks.info.mock.calls[0][1].action.onClick();
    await act(async () => root.render(null));
    await render();
    expect(mocks.info).toHaveBeenCalledOnce();
    expect(store.getState().notificacoes[0].lida).toBe(true);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(mocks.info).toHaveBeenCalledOnce();
    mocks.fetch.mockResolvedValue(resposta([{ ...alerta, id: "nova-tarefa", tarefaId: "nova" }]));
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(mocks.info).toHaveBeenCalledTimes(2);
  });
  it("ignora clique tardio de toast de outra conta", async () => {
    await render(); const antigo = mocks.info.mock.calls[0][1].action.onClick;
    await render(8);
    antigo();
    expect(abrir).not.toHaveBeenCalled();
    expect(store.getState().notificacoes[0].lida).toBe(false);
  });
  it("aguarda todas as páginas e ignora respostas de outra sessão após troca de usuário", async () => {
    let resolver!: (value: ReturnType<typeof resposta>) => void;
    mocks.fetch.mockResolvedValueOnce(resposta([alerta], "cursor"))
      .mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    await render();
    expect(store.getState().notificacoes).toHaveLength(0); expect(mocks.info).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValue(resposta([]));
    await render(8);
    await act(async () => resolver(resposta([alerta])));
    expect(store.getState().usuarioId).toBe(8); expect(store.getState().notificacoes).toHaveLength(0);
    expect(mocks.info).not.toHaveBeenCalled();
  });
  it("limpa acesso revogado e não consulta quando o usuário não tem o módulo", async () => {
    await render();
    mocks.fetch.mockResolvedValue({ ok: false, status: 403 });
    await act(async () => window.dispatchEvent(new Event("online")));
    expect(store.getState().notificacoes).toHaveLength(0);
    await render(0); const chamadas = mocks.fetch.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(chamadas);
    expect(mocks.unsubscribe).toHaveBeenCalledWith("private-bpm-tarefas-usuario-7");
  });
});
