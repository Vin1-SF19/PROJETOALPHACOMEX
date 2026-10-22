// @vitest-environment happy-dom
import { act, createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), claim: vi.fn() }));
vi.mock("@/actions/bpm/NotificacoesLeads", () => ({ ObterLeadPendenteNotificacaoBpm: mocks.lookup }));
import { useBpmNotificacaoBoardNavigation } from "@/hooks/useBpmNotificacaoBoardNavigation";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT } from "@/lib/bpm/notificacoes-tarefas";
import type { IntencaoNotificacaoBpm } from "@/lib/bpm/notificacoes-navegacao";
import type { CardBpm } from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
const descriptor = Object.getOwnPropertyDescriptor(window, "parent");
const pai = { postMessage: vi.fn() } as unknown as Window;
const abrirCard = vi.fn(); const erro = vi.fn();
const virtual = { pipelineId: "p", origemLead: "instagram", leadId: "ig-fora-da-pagina" } satisfies IntencaoNotificacaoBpm;
const card: CardBpm = { id: "ig-fora-da-pagina", origem: "instagram", instagramLeadId: "ig-fora-da-pagina", etapaId: "novo", servico: null,
  status: "ATIVO", nolossLeadId: null, createdAt: "2026-10-22T12:00:00.000Z", empresa: { id: 0, razaoSocial: "Lead fictício", nomeFantasia: null, cnpj: null },
  responsavel: { id: 0, nome: "Sem responsável" }, membros: [], _count: { tarefas: 0, anexos: 0 }, tarefas: [], podeAgirEtapa: true };
function Harness({ inicial }: { inicial?: IntencaoNotificacaoBpm }) {
  const [aberto, setAberto] = useState<CardBpm | null>(null);
  useBpmNotificacaoBoardNavigation({ pipelineId: "p", usuarioId: 7, inicial, abrirCard, abrirLead: setAberto, onErro: erro });
  return aberto ? h("button", { "data-virtual": aberto.id, onClick: () => setAberto(null) }, "Fechar virtual") : null;
}
describe("abertura direcionada de lead virtual", () => {
  let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "parent", { configurable: true, value: pai });
    mocks.lookup.mockResolvedValue({ success: true, tipo: "LEAD_VIRTUAL" as const, data: card });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); if (descriptor) Object.defineProperty(window, "parent", descriptor); });
  const mensagem = (data: IntencaoNotificacaoBpm, source = pai, origin = window.location.origin) => window.dispatchEvent(new MessageEvent("message", { source, origin, data: { type: BPM_CARD_ABRIR_EVENT, ...data } }));
  it("lookup fora da página abre modal virtual e ACK somente depois da abertura sem claim", async () => {
    let resolver!: (value: { success: boolean; tipo: "LEAD_VIRTUAL"; data: CardBpm }) => void;
    mocks.lookup.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    await act(async () => root.render(h(Harness, { inicial: virtual })));
    expect(host.querySelector("[data-virtual]")).toBeNull();
    expect(vi.mocked(pai.postMessage).mock.calls.some(([data]) => data.type === BPM_CARD_ABERTO_EVENT)).toBe(false);
    await act(async () => resolver({ success: true, tipo: "LEAD_VIRTUAL" as const, data: card }));
    expect(host.querySelector("[data-virtual]")?.getAttribute("data-virtual")).toBe(card.id);
    expect(abrirCard).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled();
    expect(pai.postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABERTO_EVENT, ...virtual }, window.location.origin);
    await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
    await act(async () => mensagem(virtual)); expect(host.querySelector("[data-virtual]")).toBeTruthy();
  });
  it("rejeita frame/origem/funil inválidos e não recria lead já assumido", async () => {
    await act(async () => root.render(h(Harness)));
    await act(async () => { mensagem(virtual, {} as Window); mensagem(virtual, pai, "https://outro.test"); mensagem({ ...virtual, pipelineId: "outro" }); });
    expect(mocks.lookup).not.toHaveBeenCalled();
    mocks.lookup.mockResolvedValue({ success: false, codigo: "LEITURA_INDISPONIVEL", error: "Não disponível" });
    await act(async () => mensagem(virtual)); expect(erro).toHaveBeenCalled(); expect(host.querySelector("[data-virtual]")).toBeNull();
    expect(abrirCard).not.toHaveBeenCalled();
  });
  it("lead já assumido abre o card canônico e confirma a intenção virtual original", async () => {
    mocks.lookup.mockResolvedValue({ success: true, tipo: "CARD", destino: { pipelineId: "outro-funil", cardId: "cm12345678901234567890123" } });
    await act(async () => root.render(h(Harness)));
    await act(async () => mensagem(virtual));
    expect(abrirCard).toHaveBeenCalledExactlyOnceWith({ pipelineId: "outro-funil", cardId: "cm12345678901234567890123" });
    expect(host.querySelector("[data-virtual]")).toBeNull(); expect(mocks.claim).not.toHaveBeenCalled();
    expect(pai.postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABERTO_EVENT, ...virtual }, window.location.origin);
  });
  it.each(["NAO_AUTORIZADO", "DESTINO_INVALIDO", "LEITURA_INDISPONIVEL", "FALHA_CARREGAMENTO"])("falha %s não é apresentada como assunção", async (codigo) => {
    mocks.lookup.mockResolvedValue({ success: false, codigo, error: "Mensagem controlada do servidor" });
    await act(async () => root.render(h(Harness)));
    await act(async () => mensagem(virtual));
    expect(erro).toHaveBeenCalledOnce();
    expect(erro.mock.calls[0][0]).not.toMatch(/assumid/i);
    expect(abrirCard).not.toHaveBeenCalled(); expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("último clique vence quando lookup anterior responde depois de um card nativo", async () => {
    let resolver!: (value: { success: boolean; tipo: "LEAD_VIRTUAL"; data: CardBpm }) => void;
    mocks.lookup.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
    await act(async () => root.render(h(Harness)));
    await act(async () => mensagem(virtual));
    const nativo = { pipelineId: "p", cardId: "cm12345678901234567890123", recepcaoId: "r1" };
    await act(async () => mensagem(nativo)); expect(abrirCard).toHaveBeenCalledWith(nativo);
    await act(async () => resolver({ success: true, tipo: "LEAD_VIRTUAL" as const, data: card })); expect(host.querySelector("[data-virtual]")).toBeNull();
    expect(pai.postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABERTO_EVENT, ...nativo }, window.location.origin);
  });
});
