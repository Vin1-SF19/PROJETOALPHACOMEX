// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AtribuirLeadAgendarModal } from "@/app/PainelAlpha/AlphaCRM/CardModal/AtribuirLeadAgendarModal";

vi.mock("@/actions/bpm/Cards", () => ({
  ListarUsuariosResponsavelBpm: vi.fn().mockResolvedValue({ success: true, data: [{ id: 7, nome: "Usuário atual" }, { id: 8, nome: "Outro usuário" }] }),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => h("div", null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) => h("div", null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => h("div", null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => h("h2", null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => h("p", null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => h("div", null, children),
}));

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];
afterEach(async () => {
  for (const { root, container } of mounted.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
});

it("pede atribuição ao mover e envia o usuário escolhido", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  const confirmar = vi.fn().mockResolvedValue({ success: true });
  await act(async () => root.render(h(AtribuirLeadAgendarModal, {
    pipelineId: "pipeline-1", currentUserId: 7, open: true, onClose: vi.fn(), onConfirmar: confirmar,
  })));
  expect(container.textContent).toContain("A mim");
  expect(container.textContent).toContain("A outro usuário");
  await act(async () => container.querySelector<HTMLButtonElement>("button:last-child")?.click());
  expect(confirmar).toHaveBeenCalledWith(7);
  await act(async () => container.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click());
  const select = container.querySelector<HTMLSelectElement>("select")!;
  await act(async () => {
    select.value = "8";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => container.querySelector<HTMLButtonElement>("button:last-child")?.click());
  expect(confirmar).toHaveBeenLastCalledWith(8);
});
