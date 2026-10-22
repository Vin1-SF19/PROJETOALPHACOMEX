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
class AudioFalso extends EventTarget {
  volume = 1; currentTime = 0;
  play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  pause = vi.fn(); load = vi.fn();
  removeAttribute = vi.fn((nome: string) => { if (nome === "src") this.src = ""; });
  constructor(public src: string) { super(); }
}
const chegada = (id: string, origem: AlertaLeadBpm["origem"]): AlertaLeadBpm => ({ ...lead, id, origem });
describe("recuperação e toast de leads compartilhados", () => {
  const fetchMock = vi.fn(); const abrir = vi.fn(); let controller: AbortController;
  let audios: AudioFalso[];
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); store.getState().iniciarUsuario(0);
    vi.stubGlobal("fetch", fetchMock); controller = new AbortController();
    audios = [];
    vi.stubGlobal("Audio", vi.fn(function (src: string) {
      const audio = new AudioFalso(src); audios.push(audio); return audio;
    }));
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
  it("primeiro snapshot paginado mantém os toasts silenciosos e novas origens usam seus sons", async () => {
    const site = chegada("site-inicial", "SITE");
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    fetchMock.mockResolvedValueOnce(pagina([lead], "pagina2")).mockResolvedValueOnce(pagina([site]));
    await client.atualizar();
    expect(mocks.custom).toHaveBeenCalledTimes(2);
    expect(audios).toHaveLength(0);
    const novoInsta = { ...chegada("insta-novo", "INSTAGRAM"), fonte: "ENCAMINHAMENTO" as const };
    fetchMock.mockResolvedValue(pagina([lead, site, novoInsta])); await client.atualizar();
    expect(audios).toHaveLength(1);
    expect(audios[0].src).toBe("/sounds/notificacao-lead-insta.mp3");
    const novoSite = { ...chegada("site-novo", "SITE"), fonte: "NOLOSS" as const };
    fetchMock.mockResolvedValue(pagina([lead, site, novoInsta, novoSite])); await client.atualizar();
    expect(audios).toHaveLength(2);
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[1].src).toBe("/sounds/notificacao-lead-site.mp3");
    expect(audios[1].play).toHaveBeenCalledOnce();
    fetchMock.mockResolvedValue(pagina([lead, site, novoInsta, novoSite, chegada("outra", "OUTRA")]));
    await client.atualizar();
    expect(audios).toHaveLength(2);
    expect(mocks.custom).toHaveBeenCalledTimes(5);
    client.limpar();
  });
  it("replay, remoção/reaparição, clique e remontagem não repetem sons de IDs vistos", async () => {
    let client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    const novo = chegada("insta-posterior", "INSTAGRAM");
    fetchMock.mockResolvedValue(pagina([lead, novo])); await client.atualizar(); await client.atualizar();
    expect(audios).toHaveLength(1);
    mocks.custom.mock.calls.at(-1)![0]().props.onAbrir();
    expect(abrir).toHaveBeenCalledOnce(); expect(audios).toHaveLength(1);
    fetchMock.mockResolvedValue(pagina([])); await client.atualizar();
    fetchMock.mockResolvedValue(pagina([lead, novo])); await client.atualizar();
    client.limpar(); client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    await client.atualizar();
    expect(audios).toHaveLength(1); expect(mocks.custom).toHaveBeenCalledTimes(2);
    client.limpar();
  });
  it.each(["http", "divergente", "cursor"])("falha inicial %s não estabelece a base sonora", async (falha) => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      if (falha === "http") fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      else if (falha === "divergente") fetchMock.mockResolvedValueOnce(pagina([lead], "p2"))
        .mockResolvedValueOnce(pagina([], null, "2026-10-22T12:11:00.000Z"));
      else fetchMock.mockResolvedValueOnce(pagina([lead], "p2")).mockResolvedValueOnce(pagina([], "p2"));
      await client.atualizar();
      expect(audios).toHaveLength(0); expect(mocks.custom).not.toHaveBeenCalled();
      await client.atualizar();
      expect(mocks.custom).toHaveBeenCalledOnce(); expect(audios).toHaveLength(0);
      fetchMock.mockResolvedValue(pagina([lead, chegada("posterior", "SITE")])); await client.atualizar();
      expect(audios).toHaveLength(1);
    } finally { log.mockRestore(); client.limpar(); }
  });
  it("snapshot ultrapassado inicial não dispara som nem arma a base", async () => {
    let resolver!: (value: ReturnType<typeof pagina>) => void;
    const valido = chegada("valido", "SITE");
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; })).mockResolvedValue(pagina([valido]));
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    const primeira = client.atualizar(); await client.atualizar(); resolver(pagina()); await primeira;
    expect(store.getState().notificacoes).toEqual([valido]);
    expect(mocks.custom).toHaveBeenCalledOnce(); expect(audios).toHaveLength(0);
    fetchMock.mockResolvedValue(pagina([valido, lead])); await client.atualizar();
    expect(audios).toHaveLength(1); client.limpar();
  });
  it.each([401, 403])("revogação %s interrompe o som sem alterar o tratamento da central", async (status) => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    fetchMock.mockResolvedValue(pagina([lead, chegada("posterior", "SITE")])); await client.atualizar();
    fetchMock.mockResolvedValue({ ok: false, status }); await client.atualizar();
    expect(audios[0].pause).toHaveBeenCalledOnce(); expect(audios[0].src).toBe("");
    expect(store.getState().notificacoes).toEqual([]); client.limpar();
  });
  it("abort interrompe áudio imediatamente e respostas antigas não tocam em outra conta", async () => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    fetchMock.mockResolvedValue(pagina([lead, chegada("posterior", "SITE")])); await client.atualizar();
    let resolver!: (value: ReturnType<typeof pagina>) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    const emCurso = client.atualizar(); controller.abort(); store.getState().iniciarUsuario(8);
    expect(audios[0].pause).toHaveBeenCalledOnce();
    resolver(pagina([chegada("tardio", "INSTAGRAM")])); await emCurso;
    expect(audios).toHaveLength(1); expect(store.getState().usuarioId).toBe(8);
    expect(store.getState().notificacoes).toEqual([]); client.limpar();
  });
  it("autoplay rejeitado preserva toast, central e abertura sem repetir o som", async () => {
    vi.stubGlobal("Audio", vi.fn(function (src: string) {
      const audio = new AudioFalso(src); audio.play.mockRejectedValue(new Error("NotAllowedError"));
      audios.push(audio); return audio;
    }));
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    const novo = chegada("novo-bloqueado", "SITE");
    fetchMock.mockResolvedValue(pagina([lead, novo])); await client.atualizar(); await Promise.resolve();
    expect(store.getState().notificacoes).toEqual([lead, novo]);
    expect(mocks.custom).toHaveBeenCalledTimes(2); expect(audios[0].pause).toHaveBeenCalledOnce();
    mocks.custom.mock.calls.at(-1)![0]().props.onAbrir(); expect(abrir).toHaveBeenCalledOnce();
    await client.atualizar(); expect(audios).toHaveLength(1); client.limpar();
  });
  it("abort inicial descarta o snapshot e a nova sessão começa com base silenciosa", async () => {
    let resolver!: (value: ReturnType<typeof pagina>) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    const primeira = client.atualizar(); controller.abort(); resolver(pagina()); await primeira;
    expect(mocks.custom).not.toHaveBeenCalled(); expect(audios).toHaveLength(0); client.limpar();
    controller = new AbortController();
    const novaSessao = criarNotificacoesLeadsClient(7, controller.signal, abrir);
    await novaSessao.atualizar();
    expect(mocks.custom).toHaveBeenCalledOnce(); expect(audios).toHaveLength(0);
    novaSessao.limpar();
  });
  it("troca de usuário interrompe o lifecycle antigo e cada conta tem sua base silenciosa", async () => {
    const client = criarNotificacoesLeadsClient(7, controller.signal, abrir); await client.atualizar();
    fetchMock.mockResolvedValue(pagina([lead, chegada("posterior", "SITE")])); await client.atualizar();
    client.limpar(); expect(audios[0].pause).toHaveBeenCalledOnce();
    const outraConta = criarNotificacoesLeadsClient(8, controller.signal, abrir);
    await outraConta.atualizar();
    expect(audios).toHaveLength(1); expect(store.getState().usuarioId).toBe(8);
    fetchMock.mockResolvedValue(pagina([lead, chegada("posterior", "SITE"), chegada("novo-8", "INSTAGRAM")]));
    await outraConta.atualizar();
    expect(audios).toHaveLength(2); expect(audios[1].src).toBe("/sounds/notificacao-lead-insta.mp3");
    outraConta.limpar();
  });
});
