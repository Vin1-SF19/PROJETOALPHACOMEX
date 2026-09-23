// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import CardFullViewModal from "@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal";
import { CardSaveProvider } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";

const card = vi.hoisted(() => ({
  id: "card-1",
  pipeline: { id: "pipeline-1" },
  etapa: { id: "etapa-1", transicoesEtapaOrigem: [] },
  membros: [],
  formularioEtapa: { secoes: [] },
}));

vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn(async () => ({ success: true, data: card })) }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ObterPipelineBpm: vi.fn(async () => ({ success: true, data: { etapas: [] } })) }));
vi.mock("@/actions/bpm/Interacoes", () => ({ ListarInteracoesCardBpm: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer", () => ({
  DadosEmpresaDrawer: () => null,
  DadosEmpresaToggle: () => null,
  useDadosEmpresaDrawer: () => ({ aberto: false }),
}));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar", () => ({ default: () => null }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout", () => ({
  CardAbertoLayout: ({ card, onCardExcluido }: { card: { id: string }; onCardExcluido?: (id: string) => void }) =>
    h("button", { onClick: () => onCardExcluido?.(card.id) }, "Confirmar exclusão"),
}));

it("repasse da exclusão confirmada do modal ao board sem evento realtime", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onCardExcluido = vi.fn();

  try {
    await act(async () => root.render(h(CardSaveProvider, null, h(CardFullViewModal, {
      cardId: "card-1",
      accent: "1,2,3",
      currentUserId: 1,
      currentUserRole: "ADMIN",
      onClose: vi.fn(),
      onAtualizado: vi.fn(),
      onCardExcluido,
      onAbrirCard: vi.fn(),
    }))));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await act(async () => {
      const confirmar = [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Confirmar exclusão");
      expect(confirmar).toBeDefined();
      confirmar!.click();
    });
    expect(onCardExcluido).toHaveBeenCalledExactlyOnceWith("card-1");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
