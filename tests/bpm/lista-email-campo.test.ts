// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

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

const campo = { id: "emails", nome: "Destinatários", tipo: "lista_email", obrigatorio: false, opcoesJson: null };

describe("campo dinâmico de lista de e-mails", () => {
  it("adiciona, edita e remove textfields de e-mail", async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    await act(async () => root.render(h(CampoBpmInput, {
      campo, value: '["um@alpha.com"]', onChange, onBlur, className: "input",
    })));

    const adicionar = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Adicionar e-mail"))!;
    await act(async () => adicionar.click());
    expect(onChange).toHaveBeenLastCalledWith('["um@alpha.com",""]');

    await act(async () => root.render(h(CampoBpmInput, {
      campo, value: '["um@alpha.com",""]', onChange, onBlur, className: "input",
    })));
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="email"]');
    expect(inputs).toHaveLength(2);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(inputs[1], "dois@alpha.com");
      inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith('["um@alpha.com","dois@alpha.com"]');

    const remover = container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Remover"]')[0];
    await act(async () => remover.click());
    expect(onChange).toHaveBeenLastCalledWith('[""]');
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it("normaliza, remove vazios e duplicados e rejeita endereço inválido", () => {
    const valido = validarValoresCamposBpm([campo], {
      emails: '[" Pessoa@Alpha.COM ","","pessoa@alpha.com"]',
    });
    expect(valido).toEqual({ success: true, valores: { emails: '["pessoa@alpha.com"]' } });

    const invalido = validarValoresCamposBpm([campo], { emails: '["sem-arroba"]' });
    expect(invalido.success).toBe(false);
  });
});
