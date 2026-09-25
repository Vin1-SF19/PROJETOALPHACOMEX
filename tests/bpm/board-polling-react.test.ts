// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { MoverCardBpm, ListarCardsPipelineBpm } from "@/actions/bpm/Cards";

const drag = vi.hoisted(() => ({ current: null as null | import("react").ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@dnd-kit/core", async (original) => {
  const actual = await original<typeof import("@dnd-kit/core")>();
  return { ...actual, DndContext: (props: import("react").ComponentProps<typeof actual.DndContext>) => {
    drag.current = props;
    return h(actual.DndContext, props);
  } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/pusher", () => ({ pusherClient: null }));
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
    pipeline: { id: "pipeline-1", nome: "Pipeline", etapas: [] },
    cardsIniciais: [card],
    visual: { accent: "1,2,3" } as ComponentProps<typeof PipelineBoardClient>["visual"],
    currentUserId: 1,
    currentUserRole: "ADMIN",
  };
  return { container, root, props };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("remove card arquivado em outra sessão após 30 segundos sem Pusher", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.mocked(ListarCardsPipelineBpm).mockResolvedValue({ success: true, data: [] });
  const { container, root, props } = montarBoard();

  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    expect(container.textContent).not.toContain("Nenhum card neste pipeline");
    expect(ListarCardsPipelineBpm).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(ListarCardsPipelineBpm).toHaveBeenCalledExactlyOnceWith("pipeline-1");
    expect(container.textContent).toContain("Nenhum card neste pipeline");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("para o polling ao desmontar o board", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.mocked(ListarCardsPipelineBpm).mockResolvedValue({ success: true, data: [] });
  const { container, root, props } = montarBoard();

  await act(async () => root.render(h(PipelineBoardClient, props)));
  await act(async () => root.unmount());
  container.remove();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(ListarCardsPipelineBpm).not.toHaveBeenCalled();
});

it("mantém a origem concluída visível com localização atual e aparência atenuada", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  props.pipeline.etapas = [{ id: "etapa-1", nome: "Concluídos", ordem: 0 }];
  props.cardsIniciais = [{ ...card, status: "CONCLUIDO", podeAgirEtapa: false,
    encaminhamentos: [{ pipeline: "Operacional", etapa: "Boas-vindas" }] }];
  vi.mocked(ListarCardsPipelineBpm).mockResolvedValue({ success: true, data: [{ ...props.cardsIniciais[0],
    encaminhamentos: [{ pipeline: "Operacional", etapa: "Execução" }] }] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const origem = container.querySelector<HTMLElement>('[aria-label*="Card encaminhado, somente leitura"]');
    expect(origem).not.toBeNull();
    expect(origem?.style.opacity).toBe("0.58");
    expect(origem?.textContent).toContain("Encaminhado para Operacional · Boas-vindas");
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(origem?.textContent).toContain("Encaminhado para Operacional · Execução");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("não recoloca o card após exclusão local quando uma consulta antiga termina", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  let responder!: (value: Awaited<ReturnType<typeof ListarCardsPipelineBpm>>) => void;
  vi.mocked(ListarCardsPipelineBpm).mockImplementation(() => new Promise((resolve) => { responder = resolve; }));
  const { container, root, props } = montarBoard();
  props.pipeline.etapas = [{ id: "etapa-1", nome: "Etapa", ordem: 0 }];

  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(ListarCardsPipelineBpm).toHaveBeenCalledOnce();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Abrir card de Empresa"]')?.click();
    });
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Confirmar exclusão")?.click();
    });
    expect(container.textContent).toContain("Nenhum card neste pipeline");

    await act(async () => responder({ success: true, data: [card] } as unknown as Awaited<ReturnType<typeof ListarCardsPipelineBpm>>));
    expect(container.textContent).toContain("Nenhum card neste pipeline");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});


it.each(["success", "failure", "sync-failure"])("mostra pending após drop até resolver: %s", async (outcome) => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  let resolveMove!: (value: Awaited<ReturnType<typeof MoverCardBpm>>) => void;
  vi.mocked(MoverCardBpm).mockImplementation(() => new Promise((resolve) => { resolveMove = resolve; }));
  vi.mocked(ListarCardsPipelineBpm).mockResolvedValue(outcome === "sync-failure"
    ? { success: false, error: "offline", data: [] }
    : { success: true, data: [{ ...card, etapaId: outcome === "failure" ? "etapa-1" : "etapa-2" }] } as unknown as Awaited<ReturnType<typeof ListarCardsPipelineBpm>>);
  const { container, root, props } = montarBoard();
  props.pipeline.etapas = [{ id: "etapa-1", nome: "Origem", ordem: 0 }, { id: "etapa-2", nome: "Destino", ordem: 1 }];
  const active = { id: card.id };
  const over = { id: "etapa-2" };
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => { drag.current!.onDragStart!({ active } as import("@dnd-kit/core").DragStartEvent); });
    await act(async () => { drag.current!.onDragOver!({ active, over } as import("@dnd-kit/core").DragOverEvent); });
    let finished: unknown;
    await act(async () => { finished = drag.current!.onDragEnd!({ active, over } as import("@dnd-kit/core").DragEndEvent); });
    expect(container.textContent).toContain("Movendo card…");
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(MoverCardBpm).toHaveBeenCalledOnce();
    await act(async () => {
      resolveMove({ success: outcome !== "failure" } as Awaited<ReturnType<typeof MoverCardBpm>>);
      await finished;
    });
    expect(container.textContent).not.toContain("Movendo card…");
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    if (outcome === "sync-failure") expect(container.textContent).toContain("Movimento salvo");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
