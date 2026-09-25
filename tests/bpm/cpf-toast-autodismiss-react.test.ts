// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { Toaster, toast } from "sonner";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));

it("Sonner dispensa erros em 5s ou manualmente sem apagar CPF pendente nem um erro novo", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let saves!: ReturnType<typeof useCardSave>;
  function Probe() { saves = useCardSave(); return null; }
  const card = { id: "toast-card", updatedAt: "2026-09-23T10:00:00Z", etapa: { chave: "RADAR" }, camposEtapa: [{
    id: "cpf", nome: "CPF", tipo: "cpf", valor: "", obrigatorio: false, opcoesJson: null, editavel: true,
  }] } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
  const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  const errors = () => container.querySelectorAll('[data-sonner-toast][data-type="error"]');
  try {
    await act(async () => root.render(h(CardSaveProvider, null, [h(Probe, { key: "probe" }), h(Toaster, { key: "toast" }), h(PainelCamposEtapaAtual, {
      key: "panel", card, campoIds: ["cpf"], instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
    })])));
    await tick(1);
    await act(async () => {
      const input = container.querySelector("input")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "11111111111");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { container.querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
    await tick(10);
    expect(errors().length).toBeGreaterThan(0);
    const close = container.querySelector<HTMLButtonElement>('[data-close-button="true"]')!;
    expect(close).not.toBeNull();
    await act(async () => close.click());
    await tick(3000);
    await act(async () => { toast.error("Erro novo", { duration: 5000, closeButton: true }); });
    await tick(10);
    await tick(2500);
    expect([...errors()].map((node) => node.textContent)).toEqual([expect.stringContaining("Erro novo")]);
    expect(saves.getPendingFields("toast-card")).toEqual(["CPF"]);
    await tick(3000);
    expect(errors()).toHaveLength(0);
    expect(saves.getPendingFields("toast-card")).toEqual(["CPF"]);
    expect(container.querySelector("input")!.value).toBe("11111111111");
  } finally {
    await act(async () => { toast.dismiss(); root.unmount(); });
    container.remove();
    vi.useRealTimers();
  }
});
