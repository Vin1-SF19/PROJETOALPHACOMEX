// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CardFullViewModal from "@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal";
import { useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { toast } from "sonner";
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/actions/bpm/Cards", () => ({ ObterCardBpm: vi.fn(async () => ({ success: true, data: { id: "card", pipeline: { id: "pipeline" }, etapa: { id: "etapa", transicoesEtapaOrigem: [] }, membros: [], formularioEtapa: { secoes: [] } } })) }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ObterPipelineBpm: vi.fn(async () => ({ success: true, data: { etapas: [] } })) }));
vi.mock("@/actions/bpm/Interacoes", () => ({ ListarInteracoesCardBpm: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer", () => ({ DadosEmpresaDrawer: () => null, DadosEmpresaToggle: () => null, useDadosEmpresaDrawer: () => ({}) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout", () => ({ CardAbertoLayout: ({ children }: { children: React.ReactNode }) => h("div", null, children) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar", () => ({ default: function Formulario() {
  const { setPendingFields } = useCardSave();
  return h("input", { "aria-label": "CPF", onInput: () => setPendingFields("card-form", ["CPF"]) });
} }));
let root: Root;
let container: HTMLDivElement;
const onClose = vi.fn();
const button = (label: string) => [...document.querySelectorAll("button")].find((node) => node.textContent === label)!;
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(h(CardFullViewModal, { cardId: "card", accent: "1,2,3", currentUserId: 1, currentUserRole: "ADMIN", onClose, onAtualizado: vi.fn(), onAbrirCard: vi.fn() })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  await act(async () => { const input = document.querySelector("input")!; input.value = "123"; input.dispatchEvent(new Event("input", { bubbles: true })); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it.each(["X", "Escape", "externo"])("%s solicita confirmação; cancelar preserva e sair informa descarte", async (trigger) => {
  const close = async () => { await act(async () => {
    if (trigger === "X") button("Fechar").click();
    else if (trigger === "Escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    else document.querySelector('[data-slot="sheet-overlay"]')!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0 }));
  }); };
  await close();
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("CPF");
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => button("Cancelar").click());
  expect(document.querySelector("input")!.value).toBe("123");
  expect(onClose).not.toHaveBeenCalled();
  await close();
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  await act(async () => button("Sair mesmo assim").click());
  expect(onClose).toHaveBeenCalledOnce();
  expect(toast.warning).toHaveBeenCalledWith("As alterações pendentes não foram salvas.");
});
