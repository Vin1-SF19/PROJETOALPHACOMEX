// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { SincronizarQuadroBpm } from "@/actions/bpm/Quadro";
import { MoverCardBpm, ListarCardsPipelineBpm } from "@/actions/bpm/Cards";

const drag = vi.hoisted(() => ({ current: null as null | import("react").ComponentProps<typeof import("@dnd-kit/core").DndContext> }));
vi.mock("@/actions/bpm/NotificacoesLeads", () => ({ ObterLeadPendenteNotificacaoBpm: vi.fn() }));
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
vi.mock("@/actions/bpm/InstagramLeads", () => ({ AssumirLeadInstagram: vi.fn() }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal", () => ({
  default: ({ cardId, onCardExcluido, realtimeRevision }: { cardId: string; onCardExcluido: (id: string) => void; realtimeRevision?: number }) =>
    h("button", { "data-modal-revision": realtimeRevision, onClick: () => onCardExcluido(cardId) }, "Confirmar exclusão"),
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

it("destaca CNPJ pendente em card real promovido do NoLoss na coluna Novos Leads", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const { container, root, props } = montarBoard();
  props.pipeline.etapas = [{ id: "etapa-1", nome: "Novos leads", ordem: 0 }];
  props.cardsIniciais = [
    { ...card, veioNoloss: true, primeiraVisualizacaoEm: new Date("2026-09-28T12:00:00Z") },
    { ...card, id: "outro-card", empresa: { ...card.empresa, razaoSocial: "Outro lead" },
      primeiraVisualizacaoEm: new Date("2026-09-28T12:00:00Z") },
  ];
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const leadNoloss = container.querySelector<HTMLElement>('[aria-label="Empresa"]');
    const outroLead = container.querySelector<HTMLElement>('[aria-label="Outro lead"]');
    expect(leadNoloss?.className).toContain("animate-pulse");
    expect(leadNoloss?.className).toContain("motion-reduce:animate-none");
    expect(leadNoloss?.textContent).toContain("CNPJ pendente · abra para preencher");
    expect(outroLead?.textContent).not.toContain("CNPJ pendente");
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

it("exibe um lead recente no topo após o polling do manifesto sem duplicar o card anterior", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  const novo: ComponentProps<typeof PipelineBoardClient>["cardsIniciais"][number] = {
    ...card, id: "noloss-novo", origem: "noloss", nolossLeadId: "noloss-novo", createdAt: new Date("2026-10-21T12:00:00Z"),
    empresa: { ...card.empresa, razaoSocial: "Lead recebido agora" },
  };
  const entrada = (item: typeof card | typeof novo) => ({
    id: item.id, etapaId: item.etapaId, revision: "v1", nome: item.empresa.razaoSocial,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt, cnpj: null, servico: null, responsaveis: [],
  });
  props.manifestoInicial = { configVersion: 1, entradas: [entrada(card)] };
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto: { configVersion: 1, entradas: [entrada(novo), entrada(card)] }, cards: [novo], ids: [novo.id, card.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const nomes = [...container.querySelectorAll<HTMLElement>('[aria-roledescription="sortable"]')].map((elemento) => elemento.getAttribute("aria-label"));
    expect(nomes).toEqual(["Lead recebido agora. Lead do site, ainda sem card", "Empresa"]);
  } finally { await act(async () => root.unmount()); container.remove(); }
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
  props.pipeline.etapas = [{ id: "etapa-1", nome: "Origem", ordem: 0, transicoesEtapaOrigem: [{ etapaDestinoId: "etapa-2" }] }, { id: "etapa-2", nome: "Destino", ordem: 1 }];
  const active = { id: card.id };
  const over = { id: "etapa-2" };
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => { drag.current!.onDragStart!({ active } as import("@dnd-kit/core").DragStartEvent); });
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
    if (outcome === "sync-failure") expect(container.textContent).not.toContain("Movimento salvo");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("ignora o drop sem transição configurada sem chamar o servidor nem mostrar erro", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const { container, root, props } = montarBoard();
  props.pipeline.etapas = [{ id: "etapa-1", nome: "Anterior", ordem: 0 }, { id: "etapa-2", nome: "Atual", ordem: 1 }];
  props.cardsIniciais = [{ ...card, etapaId: "etapa-2" }];
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const active = { id: card.id };
    await act(async () => { drag.current!.onDragStart!({ active } as import("@dnd-kit/core").DragStartEvent); });
    await act(async () => { await drag.current!.onDragEnd!({ active, over: { id: "etapa-1" } } as import("@dnd-kit/core").DragEndEvent); });
    expect(MoverCardBpm).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Não foi possível mover");
    expect(container.textContent).not.toContain("Movendo card");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("permite o drop em etapa anterior quando a transição manual foi configurada", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(MoverCardBpm).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof MoverCardBpm>>);
  vi.mocked(ListarCardsPipelineBpm).mockResolvedValue({ success: true, data: [{ ...card, etapaId: "etapa-1" }] } as unknown as Awaited<ReturnType<typeof ListarCardsPipelineBpm>>);
  const { container, root, props } = montarBoard();
  props.pipeline.etapas = [
    { id: "etapa-1", nome: "Anterior", ordem: 0 },
    { id: "etapa-2", nome: "Atual", ordem: 1, transicoesEtapaOrigem: [{ etapaDestinoId: "etapa-1" }] },
  ];
  props.cardsIniciais = [{ ...card, etapaId: "etapa-2" }];
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const active = { id: card.id };
    await act(async () => { drag.current!.onDragStart!({ active } as import("@dnd-kit/core").DragStartEvent); });
    await act(async () => { await drag.current!.onDragEnd!({ active, over: { id: "etapa-1" } } as import("@dnd-kit/core").DragEndEvent); });
    expect(MoverCardBpm).toHaveBeenCalledWith({ cardId: card.id, etapaDestinoId: "etapa-1" });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("pagina 381 cards com DOM limitado, preserva total e busca detalhes apenas quando necessário", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const { SincronizarQuadroBpm } = await import("@/actions/bpm/Quadro");
  const { container, root, props } = montarBoard();
  const todos = Array.from({ length: 381 }, (_, i) => ({ ...card, id: `lead-${i}`, empresa: { ...card.empresa, razaoSocial: `Empresa ${i}` } }));
  props.cardsIniciais = todos.slice(0, 30);
  props.manifestoInicial = { configVersion: 1, entradas: todos.map((c) => ({ id: c.id, etapaId: c.etapaId, revision: "v1", nome: c.empresa.razaoSocial, cnpj: null, servico: null, responsaveis: [c.responsavel] })) };
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto: props.manifestoInicial, cards: [], ids: todos.slice(0, 30).map((c) => c.id) });
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    expect(container.textContent).toContain("30 de 381");
    const montados = container.querySelectorAll('[aria-label^="Abrir card de Empresa"]');
    expect(montados.length).toBeGreaterThan(0);
    expect(montados.length).toBeLessThan(20);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(ListarCardsPipelineBpm).not.toHaveBeenCalled();
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ forcar: false, conhecidos: expect.any(Array) }));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ forcar: true }));
    vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto: props.manifestoInicial, cards: todos.slice(30, 60), ids: todos.slice(0, 60).map((c) => c.id) } as never);
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Carregar mais"))?.click(); });
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ limites: { "etapa-1": 60 } }));
    expect(container.textContent).toContain("60 de 381");
    expect(container.querySelectorAll('[aria-label^="Abrir card de Empresa"]').length).toBeLessThan(20);
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("fecha o card aberto e limpa o quadro quando perde acesso ao pipeline", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const { SincronizarQuadroBpm } = await import("@/actions/bpm/Quadro");
  const { container, root, props } = montarBoard();
  props.manifestoInicial = { configVersion: 1, entradas: [{ id: card.id, etapaId: card.etapaId, revision: "v1", nome: "Empresa", cnpj: null, servico: null, responsaveis: [card.responsavel] }] };
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: false, acessoNegado: true, error: "Você não tem mais acesso a este pipeline." });
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Abrir card de Empresa"]')?.click());
    expect(container.textContent).toContain("Confirmar exclusão");
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(container.textContent).not.toContain("Confirmar exclusão");
    expect(container.textContent).toContain("Você não tem mais acesso");
    expect(container.querySelector('[aria-label="Abrir card de Empresa"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});

it("busca fora do lote inicial e descarta resposta antiga após mudar o filtro", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const { SincronizarQuadroBpm } = await import("@/actions/bpm/Quadro");
  const { container, root, props } = montarBoard();
  const remoto = { ...card, id: "fora-do-lote", empresa: { ...card.empresa, razaoSocial: "Empréstimo" } };
  const entradas = [card, remoto].map((c) => ({ id: c.id, etapaId: c.etapaId, revision: "v1", nome: c.empresa.razaoSocial, cnpj: null, servico: null, responsaveis: [c.responsavel] }));
  const manifesto = { configVersion: 1, entradas };
  props.manifestoInicial = manifesto;
  let antiga!: (r: Awaited<ReturnType<typeof SincronizarQuadroBpm>>) => void;
  vi.mocked(SincronizarQuadroBpm).mockImplementationOnce(() => new Promise((resolve) => { antiga = resolve; }));
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto, cards: [remoto], ids: [remoto.id] } as never);
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "emprestimo");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(SincronizarQuadroBpm).toHaveBeenLastCalledWith("pipeline-1", expect.objectContaining({ busca: "emprestimo" }));
    expect(container.querySelector('[aria-label="Abrir card de Empréstimo"]')).not.toBeNull();
    await act(async () => antiga({ success: true, manifesto, cards: [card], ids: [card.id] } as never));
    expect(container.querySelector('[aria-label="Abrir card de Empréstimo"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Abrir card de Empresa"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});


it("polling atualiza o detalhe aberto uma vez por mudança real de revisão sem remontá-lo", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers();
  const { container, root, props } = montarBoard();
  const entrada = { id: card.id, etapaId: card.etapaId, revision: "rev-1", nome: "Empresa", cnpj: null, servico: null, responsaveis: [] };
  props.manifestoInicial = { configVersion: 1, entradas: [entrada] };
  props.cardInicialId = card.id;
  vi.mocked(SincronizarQuadroBpm).mockResolvedValue({ success: true, manifesto: { configVersion: 1, entradas: [{ ...entrada, revision: "rev-2" }] }, ids: [card.id], cards: [] });
  try {
    await act(async () => root.render(h(PipelineBoardClient, props)));
    const modal = container.querySelector<HTMLElement>("[data-modal-revision]")!;
    expect(modal.getAttribute("data-modal-revision")).toBe("0");
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(container.querySelector("[data-modal-revision]")).toBe(modal);
    expect(modal.getAttribute("data-modal-revision")).toBe("1");
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(modal.getAttribute("data-modal-revision")).toBe("1");
    expect(SincronizarQuadroBpm).toHaveBeenCalledTimes(2);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
