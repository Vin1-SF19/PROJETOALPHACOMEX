// @vitest-environment happy-dom
import React, { act, createElement as h, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => { const router = { refresh: vi.fn() }; return { useRouter: () => router }; });
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({ ListarCardsPipelineBpm: vi.fn(), MoverCardBpm: vi.fn(), CriarCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/NolossLeads", () => ({ PromoverNolossLead: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({
  default: ({ cardId, onClose, realtimeRevision }: { cardId: string; onClose: () => void; realtimeRevision: number }) => h("button", { "data-card": cardId, "data-revisao-acl": realtimeRevision, onClick: onClose }, "Fechar card"),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
import { BPM_CARD_ABRIR_EVENT } from "@/lib/bpm/notificacoes-tarefas";
const cardId = "cm12345678901234567890123";
const parentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");
const parentWindow = { postMessage: vi.fn() } as unknown as Window;
beforeEach(() => {
  vi.useFakeTimers(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, "parent", { configurable: true, value: parentWindow });
});
afterEach(() => {
  vi.useRealTimers(); vi.clearAllMocks();
  if (parentDescriptor) Object.defineProperty(window, "parent", parentDescriptor);
});
it("mantém card do alerta fora do filtro Meus e reabre pela intenção autorizada do shell", async () => {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  const manifesto = { configVersion: 1, entradas: [], acesso: { userId: 7, admin: true, setores: [] } };
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [], ids: [] } as never);
  const props: ComponentProps<typeof PipelineBoardClient> = {
    pipeline: { id: "pipeline-1", nome: "Comercial", etapas: [] }, cardsIniciais: [], cardInicialId: cardId,
    manifestoInicial: manifesto, visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"],
    currentUserId: 7, currentUserRole: "ADMIN",
  };
  const mensagem = (source: Window, origin = window.location.origin) => window.dispatchEvent(new MessageEvent("message", {
    source, origin, data: { type: BPM_CARD_ABRIR_EVENT, cardId, pipelineId: "pipeline-1" },
  }));
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    expect(host.querySelector("[data-card]")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(31000); });
    expect(vi.mocked(SincronizarQuadroBpm)).toHaveBeenCalled();
    expect(Number(host.querySelector("[data-card]")?.getAttribute("data-revisao-acl"))).toBeGreaterThan(0);
    expect(host.querySelector("[data-card]")).toBeTruthy();
    await act(async () => host.querySelector<HTMLButtonElement>("[data-card]")!.click());
    expect(host.querySelector("[data-card]")).toBeNull();
    await act(async () => { mensagem({} as Window); mensagem(parentWindow, "https://outro.test"); });
    expect(host.querySelector("[data-card]")).toBeNull();
    await act(async () => mensagem(parentWindow));
    expect(host.querySelector("[data-card]")).toBeTruthy();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
