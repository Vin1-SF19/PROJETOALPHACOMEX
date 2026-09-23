// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("contraste dos selects do formulário de etapa", () => {
  it.each(["selecao", "booleano"])(
    "mantém controle, placeholder e opções legíveis para %s",
    async (tipo) => {
      const onChange = vi.fn();
      await act(async () => root.render(h(CampoBpmInput, {
        campo: {
          id: tipo,
          nome: tipo,
          tipo,
          obrigatorio: true,
          opcoesJson: tipo === "selecao" ? '["Opção A"]' : null,
        },
        value: "",
        onChange,
        className: "bg-white text-black focus:ring-2",
      })));

      const select = container.querySelector("select")!;
      expect(select.className).toContain("bg-slate-900");
      expect(select.className).toContain("text-slate-100");
      expect(select.className).toContain("focus:ring-2");
      expect(select.className).not.toContain("bg-white");
      expect(select.className).not.toContain("text-black");
      expect([...select.options].every((option) =>
        option.className.includes("bg-slate-900") &&
        option.className.includes("text-slate-100"),
      )).toBe(true);
    },
  );

  it("destaca opções selecionadas e preserva JSON, blur e bloqueio da multisseleção", async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const campo = {
      id: "multi",
      nome: "Serviços",
      tipo: "multiselecao",
      obrigatorio: false,
      opcoesJson: '["Radar","Drawback"]',
    };
    await act(async () => root.render(h(CampoBpmInput, {
      campo,
      value: '["Radar"]',
      onChange,
      onBlur,
      className: "bg-white text-black",
    })));

    const buttons = container.querySelectorAll<HTMLButtonElement>('[role="group"] button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain("Radar");
    expect(buttons[1].textContent).toBe("Drawback");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[0].className).toContain("bg-cyan-500/20");
    expect(buttons[0].className).toContain("text-cyan-100");
    await act(async () => buttons[1].click());
    expect(onChange).toHaveBeenCalledExactlyOnceWith('["Radar","Drawback"]');
    expect(onBlur).toHaveBeenCalledOnce();

    await act(async () => root.render(h(CampoBpmInput, {
      campo,
      value: '["Radar","Drawback"]',
      onChange,
      onBlur,
      className: "",
    })));
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    await act(async () => buttons[0].click());
    expect(onChange).toHaveBeenNthCalledWith(2, '["Drawback"]');
    expect(onBlur).toHaveBeenCalledTimes(2);

    await act(async () => root.render(h(CampoBpmInput, {
      campo,
      value: '["Radar"]',
      onChange,
      onBlur,
      className: "",
      readOnly: true,
    })));
    for (const button of container.querySelectorAll<HTMLButtonElement>('[role="group"] button')) {
      expect(button.disabled).toBe(true);
      await act(async () => button.click());
    }
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onBlur).toHaveBeenCalledTimes(2);
  });
});
