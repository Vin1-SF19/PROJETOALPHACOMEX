// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import PipelineBoardClient from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient";
import { ListarCardsPipelineBpm } from "@/actions/bpm/Cards";

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

    await act(async () => responder({ success: true, data: [card] }));
    expect(container.textContent).toContain("Nenhum card neste pipeline");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
