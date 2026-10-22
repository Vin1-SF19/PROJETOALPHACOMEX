// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ custom: vi.fn(), dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks }));
import { criarNotificacoesLeadsClient } from "@/hooks/bpm-leads-notificacoes-client";
import { useBpmLeadsNotificacoes as store } from "@/store/useBpmLeadsNotificacoes";
import type { AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
const lead: AlertaLeadBpm = {
  id: "instagram:pipeline:lead-1", tipo: "LEAD_SEM_RESPONSAVEL", fonte: "INSTAGRAM", origem: "INSTAGRAM",
  pipelineId: "pipeline", pipelineNome: "Comercial", etapaId: "novo", etapaNome: "Novo lead", nome: "Cliente fictício",
  email: "teste@example.invalid", telefone: "11999990000", cnpj: null, resumo: "Deseja Radar", recebidoEm: "2026-10-22T12:00:00.000Z",
  destino: { tipo: "LEAD_VIRTUAL", pipelineId: "pipeline", origemLead: "instagram", leadId: "lead-1" }, responsaveisAnteriores: [],
};
const pagina = (alertas = [lead], proximoCursor: string | null = null, snapshotEm = "2026-10-22T12:10:00.000Z") => ({
  ok: true, status: 200, json: async () => ({ alertas, proximoCursor, snapshotEm }),
});
describe("recuperação e toast de leads compartilhados", () => {
  const fetchMock = vi.fn(); const abrir = vi.fn(); let controller: AbortController;
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); store.getState().iniciarUsuario(0);
    vi.stubGlobal("fetch", fetchMock); controller = new AbortController();
    fetchMock.mockResolvedValue(pagina()); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterEach(() => { controller.abort(); vi.unstubAllGlobals(); });
  it("mantém central ao fechar toast/clicar e recupera sem duplicar após remontagem", async () => {
    let client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    await client.atualizar();
    expect(mocks.custom).toHaveBeenCalledOnce();
    const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    try {
      await act(async () => root.render(mocks.custom.mock.calls[0][0]()));
      expect(host.textContent).toContain("Cliente fictício"); expect(host.textContent).toContain("Ninguém assumiu");
      await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Fechar aviso do lead"]')!.click());
      expect(store.getState().notificacoes).toEqual([lead]);
      await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
      expect(abrir).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/pipeline/pipeline?origemLead=instagram&leadId=lead-1", "CRM");
      expect(store.getState().notificacoes).toEqual([lead]);
      client.limpar(); client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
      await client.atualizar(); expect(mocks.custom).toHaveBeenCalledOnce();
      fetchMock.mockResolvedValue(pagina([])); await client.atualizar();
      expect(store.getState().notificacoes).toEqual([]);
    } finally { await act(async () => root.unmount()); host.remove(); client.limpar(); }
  });
  it("aplica somente conjunto completo e preserva pendências em falha de página", async () => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    fetchMock.mockResolvedValueOnce(pagina([], "pagina2")).mockResolvedValueOnce({ ok: false, status: 500 });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { await client.atualizar(); expect(store.getState().notificacoes).toEqual([lead]); }
    finally { log.mockRestore(); client.limpar(); }
  });
  it("rejeita snapshot divergente e cursor cíclico sem apagar a central", async () => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      fetchMock.mockResolvedValueOnce(pagina([], "pagina2")).mockResolvedValueOnce(pagina([], null, "2026-10-22T12:11:00.000Z"));
      await client.atualizar(); expect(store.getState().notificacoes).toEqual([lead]);
      fetchMock.mockResolvedValue(pagina([], "ciclo")); await client.atualizar();
      expect(store.getState().notificacoes).toEqual([lead]);
    } finally { log.mockRestore(); client.limpar(); }
  });
  it("invalidação durante leitura descarta resposta antiga que ressuscitaria lead assumido", async () => {
    let resolver!: (value: ReturnType<typeof pagina>) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; })).mockResolvedValue(pagina([]));
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    const primeira = client.atualizar(); await client.atualizar();
    resolver(pagina()); await primeira;
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(store.getState().notificacoes).toEqual([]);
    expect(mocks.custom).not.toHaveBeenCalled(); client.limpar();
  });
  it("limpa revogação e ignora snapshot/clique tardios após troca de conta", async () => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    const antigo = mocks.custom.mock.calls[0][0]().props.onAbrir;
    store.getState().iniciarUsuario(8); antigo(); expect(abrir).not.toHaveBeenCalled();
    client.limpar(); expect(store.getState().usuarioId).toBe(8);
    const novo = criarNotificacoesLeadsClient(8, controller.signal, abrir);
    await novo.atualizar(); fetchMock.mockResolvedValue({ ok: false, status: 403 }); await novo.atualizar();
    expect(store.getState().notificacoes).toEqual([]); novo.limpar();
  });
});
