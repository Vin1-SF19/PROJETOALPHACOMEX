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
const indisponivel = (status = 503, retryAfter?: string) => new Response(null, {
  status, headers: retryAfter ? { "Retry-After": retryAfter } : {},
});
const abrir = vi.fn();
function Hook({ usuarioId }: { usuarioId: number }) { useBpmTarefasNotifications(usuarioId, abrir); return null; }
describe("recuperação dos alertas CRM no shell", () => {
  let root: Root; let host: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks(); vi.useFakeTimers(); vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    localStorage.clear();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    store.getState().iniciarUsuario(0);
    mocks.subscribe.mockReturnValue({ bind: mocks.bind, unbind: mocks.unbind });
    mocks.fetch.mockResolvedValue(resposta());
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
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
  it("aumenta a espera até cinco minutos sem antecipar por foco, online ou Pusher", async () => {
    mocks.fetch.mockResolvedValue(indisponivel());
    await render();
    const reconciliar = mocks.bind.mock.calls.find(([evento]) => evento === "tarefa-alerta")![1];
    const conectado = mocks.connected.mock.calls[0][1];
    let chamadas = 1;
    for (const espera of [30000, 60000, 120000, 240000, 300000, 300000]) {
      await act(async () => {
        window.dispatchEvent(new Event("focus"));
        window.dispatchEvent(new Event("online"));
        reconciliar(); conectado();
        await vi.advanceTimersByTimeAsync(espera - 1);
      });
      expect(mocks.fetch).toHaveBeenCalledTimes(chamadas);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(mocks.fetch).toHaveBeenCalledTimes(++chamadas);
    }
    expect(console.warn).toHaveBeenCalledOnce();
  });
  it.each(["120", "data HTTP"])("respeita Retry-After em %s", async (valor) => {
    const header = valor === "data HTTP" ? new Date(Date.now() + 120000).toUTCString() : valor;
    mocks.fetch.mockResolvedValue(indisponivel(503, header));
    await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(90000); window.dispatchEvent(new Event("focus")); });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["inválido", "", "-10"])("usa espera padrão quando Retry-After não é utilizável: %s", async (valor) => {
    mocks.fetch.mockResolvedValue(indisponivel(503, valor));
    await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(29999); });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("limita Retry-After excessivo a cinco minutos", async () => {
    mocks.fetch.mockResolvedValue(indisponivel(503, "3600"));
    await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(299999); });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("mantém diagnóstico de erro permanente e payload inválido sem classificá-los como indisponibilidade", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.fetch.mockResolvedValueOnce(indisponivel(400))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ invalido: true }) });
    await render();
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
    expect(console.warn).not.toHaveBeenCalled();
    expect(store.getState().notificacoes).toHaveLength(0);
  });
  it.each([408, 429, 500, 502, 504])("aplica espera à resposta transitória HTTP %s", async (status) => {
    mocks.fetch.mockResolvedValue(indisponivel(status));
    await render();
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(mocks.fetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("mantém alertas e leitura se uma página falha; recupera sem repetir toasts e restaura cadência", async () => {
    await render();
    mocks.info.mock.calls[0][1].action.onClick();
    const novo = { ...alerta, id: "novo", tarefaId: "novo" };
    mocks.fetch.mockResolvedValueOnce(resposta([novo], "cursor"))
      .mockResolvedValueOnce(indisponivel()).mockResolvedValue(resposta([alerta, novo]));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(store.getState().notificacoes).toHaveLength(1);
    expect(store.getState().notificacoes[0]).toMatchObject({ id: alerta.id, lida: true });
    expect(mocks.info).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(store.getState().notificacoes).toHaveLength(2);
    expect(mocks.info).toHaveBeenCalledTimes(2);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(mocks.fetch).toHaveBeenCalledTimes(5);
    expect(mocks.info).toHaveBeenCalledTimes(2);
  });
  it("não executa atualização pendente imediatamente após falha de rede", async () => {
    let rejeitar!: (erro: Error) => void;
    mocks.fetch.mockReturnValueOnce(new Promise((_resolve, reject) => { rejeitar = reject; }));
    await render();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      rejeitar(new TypeError("Failed to fetch"));
    });
    expect(mocks.fetch).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(store.getState().notificacoes).toHaveLength(1);
  });
  it("cancela trabalho e espera da sessão anterior sem atrasar a nova conta", async () => {
    mocks.fetch.mockResolvedValueOnce(indisponivel());
    await render();
    const signal = mocks.fetch.mock.calls[0][1].signal as AbortSignal;
    await render(8);
    expect(signal.aborted).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(store.getState().usuarioId).toBe(8);
    expect(store.getState().notificacoes).toHaveLength(1);
    await render(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(600000); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(store.getState().notificacoes).toHaveLength(0);
  });
  it("continua limpando os alertas quando a recuperação informa acesso revogado", async () => {
    await render();
    mocks.fetch.mockResolvedValueOnce(indisponivel()).mockResolvedValue(indisponivel(403));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(store.getState().notificacoes).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(store.getState().notificacoes).toHaveLength(0);
  });
});
