// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

it("aceita 0..100 e bloqueia percentuais fora do intervalo", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const onChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(h(CampoBpmInput, {
    campo: { id: "p", nome: "Percentual", tipo: "percentual", obrigatorio: false, opcoesJson: null },
    value: "",
    onChange,
    className: "",
  })));
  const input = container.querySelector<HTMLInputElement>("input")!;
  expect(input.min).toBe("0");
  expect(input.max).toBe("100");
  for (const valor of ["0", "50.5", "100", "", "-1", "100.01"]) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  expect(onChange.mock.calls.map(([valor]) => valor)).toEqual(["0", "50.5", "100"]);
  await act(async () => root.unmount());
  container.remove();
});
