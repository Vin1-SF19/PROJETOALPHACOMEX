// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CardFullViewModal from "@/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal";
import { CardSaveProvider } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { toast } from "sonner";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
const fixture = vi.hoisted(() => ({ id: "card", updatedAt: "2026-09-22T10:00:00Z", pipeline: { id: "pipeline", nome: "Comercial" }, etapa: { id: "etapa", nome: "Revisão", chave: "RADAR", transicoesEtapaOrigem: [] }, membros: [], formularioEtapa: { secoes: [] }, camposEtapa: [{ id: "nome", nome: "Nome", tipo: "texto", valor: "", obrigatorio: false, ordem: 0, pipelineId: "pipeline", etapaId: "etapa", opcoesJson: null, editavel: true }] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn(async () => ({ success: true, data: fixture })) }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Pipelines", () => ({ ObterPipelineBpm: vi.fn(async () => ({ success: true, data: { etapas: [] } })) }));
vi.mock("@/actions/bpm/Interacoes", () => ({ ListarInteracoesCardBpm: vi.fn(async () => ({ data: [] })) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaDrawer", () => ({ DadosEmpresaDrawer: () => null, DadosEmpresaToggle: () => null, useDadosEmpresaDrawer: () => ({}) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout", () => ({ CardAbertoLayout: ({ children }: { children: React.ReactNode }) => h("div", null, children) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar", async () => {
  const { PainelCamposEtapaAtual } = await import("@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual");
  return { default: () => h(PainelCamposEtapaAtual, {
    card: fixture as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"],
    campoIds: ["nome"], instanceKey: "close", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }) };
});
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
const onClose = vi.fn();
const button = (label: string) => [...document.querySelectorAll("button")].find((node) => node.textContent === label)!;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(AtualizarCardBpm).mockImplementation(() => new Promise(() => {}));
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(h(CardSaveProvider, null, h(CardFullViewModal, { cardId: "card", accent: "1,2,3", currentUserId: 1, currentUserRole: "ADMIN", onClose, onAtualizado: vi.fn(), onAbrirCard: vi.fn() }))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  vi.useFakeTimers();
  await act(async () => { const input = document.querySelector("input")!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Texto final"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
it.each(["X", "Escape", "externo"])("%s aguarda confirmação do salvamento antes de fechar", async (trigger) => {
  let concluirSave!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm).mockImplementation(() => new Promise((resolve) => { concluirSave = resolve; }));
  vi.mocked(ObterCardBpm).mockResolvedValue({
    success: true,
    data: { ...fixture, updatedAt: "2026-09-22T10:01:00Z", camposEtapa: [{ ...fixture.camposEtapa[0], valor: "Texto final" }] },
  } as unknown as Awaited<ReturnType<typeof ObterCardBpm>>);
  await act(async () => {
    if (trigger === "X") button("Fechar").click();
    else if (trigger === "Escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    else {
      const overlay = document.querySelector<HTMLElement>('[data-slot="sheet-overlay"]')!;
      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0 }));
      overlay.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", button: 0 }));
      overlay.click();
    }
  });
  expect(onClose).not.toHaveBeenCalled();
  expect(document.querySelector('[aria-label="Fechar"]')?.getAttribute("aria-busy")).toBe("true");
  expect(document.body.textContent).toContain("Salvando alterações…");
  await act(async () => { button("Fechar").click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ camposValores: { nome: "Texto final" } }));
  await act(async () => { concluirSave({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>); });
  expect(onClose).toHaveBeenCalledOnce();
  expect(document.querySelector('[aria-label="Fechar"]')?.getAttribute("aria-busy")).toBe("false");
  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(toast.warning).not.toHaveBeenCalled();
});

it("mostra as pendências quando o salvamento falha", async () => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: false } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  await act(async () => { button("Fechar").click(); });
  expect(onClose).not.toHaveBeenCalled();
  expect(document.querySelector('[aria-label="Fechar"]')?.getAttribute("aria-busy")).toBe("false");
  expect(document.body.textContent).toContain("Campos não salvos");
  expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
});
