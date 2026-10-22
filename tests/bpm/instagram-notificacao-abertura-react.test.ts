// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ lookup: vi.fn(), assumirInstagram: vi.fn(), promoverNoloss: vi.fn(), usuarios: vi.fn(), criarCard: vi.fn(), moverCard: vi.fn(), sincronizar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/actions/bpm/NotificacoesLeads", () => ({ ObterLeadPendenteNotificacaoBpm: api.lookup }));
vi.mock("@/actions/bpm/InstagramLeads", () => ({ AssumirLeadInstagram: api.assumirInstagram }));
vi.mock("@/actions/bpm/NolossLeads", () => ({ PromoverNolossLead: api.promoverNoloss }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: api.sincronizar }));
vi.mock("@/actions/bpm/Cards", () => ({ ListarUsuariosResponsavelBpm: api.usuarios, CriarCardBpm: api.criarCard, MoverCardBpm: api.moverCard, ListarCardsPipelineBpm: vi.fn(), ObterRequisitosTransicaoBpm: vi.fn() }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => h("div", { "data-sheet": true }, children),
  SheetContent: ({ children }: { children: React.ReactNode }) => h("div", null, children),
  SheetTitle: ({ children }: { children: React.ReactNode }) => h("h2", null, children),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({ default: ({ cardId }: { cardId: string }) => h("div", { "data-card-nativo": cardId }, "Detalhe do card autorizado") }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
import PipelineBoardClient, { type CardBpm } from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { INSTAGRAM_COLUNAS as C, prepararLeadInstagram } from "@/lib/bpm/instagram-leads";
import { BPM_CARD_ABERTO_EVENT, BPM_CARD_ABRIR_EVENT } from "@/lib/bpm/notificacoes-tarefas";
const parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");
const parentWindow = { postMessage: vi.fn() } as unknown as Window;
const dados = prepararLeadInstagram({ id: "l:teste-abertura", full_name: "Contato fictício IG", created_time: "2026-10-22T12:00:00Z",
  email: "contato@example.invalid", [C.radar]: "ilimitado", [C.volume]: "até_150_mil_dólares", [C.prazo]: "em_até_6_meses" });
const lead: CardBpm = { id: "entrada-ig-ficticia", etapaId: "novo", servico: null, status: "ATIVO", origem: "instagram", instagramLeadId: "entrada-ig-ficticia", instagramDados: dados,
  nolossLeadId: null, createdAt: "2026-10-22T12:00:00Z", empresa: { id: 0, razaoSocial: "Contato fictício IG", nomeFantasia: null, cnpj: null },
  responsavel: { id: 0, nome: "Sem responsável" }, membros: [], _count: { tarefas: 0, anexos: 0 }, tarefas: [], podeAgirEtapa: true };
const intencao = { pipelineId: "pipeline-comercial", origemLead: "instagram", leadId: lead.id } as const;
describe("notificação Instagram → board → modal real → assunção explícita", () => {
  let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "parent", { configurable: true, value: parentWindow });
    api.lookup.mockResolvedValue({ success: true, tipo: "LEAD_VIRTUAL", data: lead });
    api.usuarios.mockResolvedValue({ success: true, data: [{ id: 7, nome: "Closer fictício" }] });
    api.assumirInstagram.mockResolvedValue({ success: false, error: "Escrita de teste não executada" });
    api.sincronizar.mockResolvedValue({ success: true, manifesto: { configVersion: 1, entradas: [] }, cards: [], ids: [] });
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); if (parentDescriptor) Object.defineProperty(window, "parent", parentDescriptor); });
  async function montar(role = "COMERCIAL") {
    const props: ComponentProps<typeof PipelineBoardClient> = {
      pipeline: { id: "pipeline-comercial", nome: "Revisão de Radar", etapas: [{ id: "novo", nome: "Novo lead", ordem: 0 }],
        campos: [{ nome: "Radar pretendido", tipo: "SELECT", ativo: true, opcoesJson: null, opcoes: [{ rotulo: "Revisão de Radar Ilimitado", ativo: true }] }] },
      cardsIniciais: [], manifestoInicial: { configVersion: 1, entradas: [] }, visual: { accent: "37,99,235" } as ComponentProps<typeof PipelineBoardClient>["visual"], currentUserId: 7, currentUserRole: role,
    };
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: parentWindow, data: { type: BPM_CARD_ABRIR_EVENT, ...intencao } })));
  }
  const clicar = async (texto: string) => { await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === texto)!.click()); };
  it.each(["COMERCIAL", "T.I"])("clique da notificação e montagem para %s mostram detalhes sem assumir, promover ou criar", async (role) => {
    await montar(role);
    expect(host.textContent).toContain("Contato fictício IG"); expect(host.textContent).toContain("Respostas do Instagram");
    expect(host.textContent).toContain("Assumir lead"); expect(host.querySelector("[data-card-nativo]")).toBeNull();
    expect(api.assumirInstagram).not.toHaveBeenCalled(); expect(api.promoverNoloss).not.toHaveBeenCalled();
    expect(api.criarCard).not.toHaveBeenCalled(); expect(api.moverCard).not.toHaveBeenCalled();
    expect(api.usuarios).not.toHaveBeenCalled();
    expect(parentWindow.postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABERTO_EVENT, ...intencao }, window.location.origin);
    await clicar("Fechar");
    expect(api.assumirInstagram).not.toHaveBeenCalled();
  });
  it("só confirma AssumirLeadInstagram após ações explícitas de assumir e confirmar responsável", async () => {
    await montar(); expect(api.assumirInstagram).not.toHaveBeenCalled();
    await clicar("Assumir lead");
    expect(api.usuarios).toHaveBeenCalledWith("pipeline-comercial"); expect(api.assumirInstagram).not.toHaveBeenCalled();
    await clicar("Assumir e mover");
    expect(api.assumirInstagram).toHaveBeenCalledExactlyOnceWith({ leadId: lead.id, etapaDestinoId: "novo", responsavelId: 7, cnpj: "", radarPretendido: "Revisão de Radar Ilimitado", qualificacao: undefined });
    expect(api.promoverNoloss).not.toHaveBeenCalled(); expect(api.criarCard).not.toHaveBeenCalled();
  });
  it("notificação antiga de lead promovido abre seu card autorizado sem criar ou assumir outro", async () => {
    const cardId = "cm12345678901234567890123";
    api.lookup.mockResolvedValue({ success: true, tipo: "CARD", destino: { pipelineId: "pipeline-comercial", cardId } });
    await montar("T.I");
    expect(host.querySelector("[data-card-nativo]")?.getAttribute("data-card-nativo")).toBe(cardId);
    expect(host.textContent).not.toContain("Respostas do Instagram");
    expect(api.assumirInstagram).not.toHaveBeenCalled(); expect(api.promoverNoloss).not.toHaveBeenCalled(); expect(api.criarCard).not.toHaveBeenCalled();
    expect(parentWindow.postMessage).toHaveBeenLastCalledWith({ type: BPM_CARD_ABERTO_EVENT, ...intencao }, window.location.origin);
  });
});
