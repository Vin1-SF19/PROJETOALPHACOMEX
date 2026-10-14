// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";

const drag = vi.hoisted(() => ({ current: null as null | import("react").ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@dnd-kit/core", async (original) => {
  const actual = await original<typeof import("@dnd-kit/core")>();
  return { ...actual, DndContext: (props: import("react").ComponentProps<typeof actual.DndContext>) => {
    drag.current = props;
    return h(actual.DndContext, props);
  } };
});
vi.mock("next/navigation", () => { const router = { refresh: vi.fn() }; return { useRouter: () => router }; });
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
vi.mock("@/actions/bpm/Quadro", () => ({ SincronizarQuadroBpm: vi.fn() }));
vi.mock("@/actions/bpm/Cards", () => ({
  ListarCardsPipelineBpm: vi.fn(),
  MoverCardBpm: vi.fn(),
  CriarCardBpm: vi.fn(),
}));
vi.mock("@/actions/bpm/NolossLeads", () => ({ PromoverNolossLead: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({
  default: ({ cardId, onCardExcluido }: { cardId: string; onCardExcluido: (id: string) => void }) =>
    h("button", { onClick: () => onCardExcluido(cardId) }, "Confirmar exclusão"),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/SeletorMembrosCard", () => ({ GrupoAvataresMembrosCard: () => null }));
vi.mock("@/hooks/useLazyColumn", () => ({ useLazyColumn: () => [React.createRef(), true] }));

const card = {
  id: "card-excluido-em-outra-sessao",
  etapaId: "etapa-1",
  servico: null,
  status: "ATIVO",
  origem: "real",
  nolossLeadId: null,
  createdAt: new Date("2026-09-23T12:00:00Z"),
  empresa: { id: 1, razaoSocial: "Empresa", nomeFantasia: null, cnpj: null },
  responsavel: { id: 1, nome: "Responsável" },
  membros: [],
  _count: { tarefas: 0, anexos: 0 },
  tarefas: [],
  podeAgirEtapa: true,
} satisfies ComponentProps<typeof PipelineBoardClient>["cardsIniciais"][number];

function montarBoard() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const props: ComponentProps<typeof PipelineBoardClient> = {
    pipeline: { id: "pipeline-1", nome: "Pipeline", etapas: [{ id: "etapa-1", nome: "Em andamento", ordem: 0 }] },
    cardsIniciais: [card],
    visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"],
    currentUserId: 1,
    currentUserRole: "ADMIN",
  };
  return { container, root, props };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("alpha-pipeline-column") ? 800 : 240; });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(260);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.clearAllMocks();
});


vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode }) => h("select", { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange(e.target.value) }, children),
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => h(React.Fragment, {}, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => h("option", { value }, children),
}));

it("abre em meus leads e permite alternar equipe/setor sem mostrar responsáveis fora da visão", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  const equipe = { ...card, id: "equipe", empresa: { ...card.empresa, razaoSocial: "Empresa da equipe" }, responsavel: { id: 9, nome: "Pessoa Comercial" }, podeAgirEtapa: false };
  const manifesto = { configVersion: 1, acesso: { userId: 1, admin: false, setores: [{ id: 3, nome: "Comercial", usuarioIds: [9] }] }, entradas: [card, equipe].map((c) => ({ id: c.id, etapaId: c.etapaId, revision: "1", nome: c.empresa.razaoSocial, cnpj: null, servico: null, responsaveis: [c.responsavel] })) };
  props.manifestoInicial = manifesto;
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [equipe], ids: [equipe.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const select = container.querySelector("select")!;
    expect(select.value).toBe("MEUS");
    expect([...select.options].map((o) => o.value)).toEqual(["MEUS", "EQUIPE", "SETOR:3"]);
    expect(container.querySelector('[aria-label="Abrir card de Empresa da equipe"]')).toBeNull();
    expect(container.querySelectorAll("select")[1].textContent).not.toContain("Pessoa Comercial");
    await act(async () => { select.value = "EQUIPE"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ visao: "EQUIPE", setorId: null }));
    expect(container.querySelector('[aria-label="Abrir card de Empresa da equipe"]')).not.toBeNull();
    expect(container.querySelectorAll("select")[1].textContent).toContain("Pessoa Comercial");
    vi.mocked(SincronizarQuadroBpm).mockResolvedValueOnce({ success: false, acessoNegado: false, visaoRevogada: true, error: "Revogado" });
    vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto: { ...manifesto, acesso: { ...manifesto.acesso, setores: [] }, entradas: manifesto.entradas.slice(0, 1) }, cards: [card], ids: [card.id] } as never);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(container.querySelector("select")?.value).toBe("MEUS");
    expect(container.querySelector('[aria-label="Abrir card de Empresa da equipe"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
