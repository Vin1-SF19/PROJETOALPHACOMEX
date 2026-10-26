// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { CampoBpmInput, type CampoBpmEditavel } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { MESES_PROTOCOLAR } from "@/lib/bpm/mes-protocolar";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
let root: Root;
let container: HTMLDivElement;
const campo: CampoBpmEditavel = { id: "mes", chave: "alpha.radar.viabilidade.mes_protocolar", nome: "Mês para protocolar", tipo: "data", obrigatorio: true, opcoesJson: null };

beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("seletor compartilhado do mês para protocolar", () => {
  it("seleciona, valida e reabre somente o mês, inclusive em campo legado de data", async () => {
    const change = vi.fn(), blur = vi.fn();
    const props = { campo, value: "2026-10-31", className: "bg-white text-black", onChange: change, onBlur: blur, invalid: true, describedBy: "erro-mes" };
    await act(async () => root.render(h(CampoBpmInput, props)));
    let select = container.querySelector("select")!;
    expect(container.querySelector('input[type="date"],input[type="month"]')).toBeNull();
    expect(select.value).toBe("Outubro");
    expect([...select.options].slice(1).map((option) => option.value)).toEqual([...MESES_PROTOCOLAR]);
    expect(select.required).toBe(true); expect(select.id).toBe("campo-bpm-mes");
    expect(select.getAttribute("aria-invalid")).toBe("true"); expect(select.getAttribute("aria-describedby")).toBe("erro-mes");
    expect(select.className).toContain("bg-slate-900"); expect(select.className).not.toContain("text-black");
    expect(change).not.toHaveBeenCalled();
    await act(async () => { select.value = "Março"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(change).toHaveBeenCalledExactlyOnceWith("Março");
    const resultado = validarValoresCamposBpm([campo], { mes: change.mock.calls[0][0] });
    expect(resultado.success).toBe(true);
    if (!resultado.success) throw new Error(resultado.error);
    await act(async () => root.render(h(CampoBpmInput, { ...props, value: resultado.valores.mes })));
    select = container.querySelector("select")!; expect(select.value).toBe("Março");
    await act(async () => select.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(blur).toHaveBeenCalledOnce();
  });

  it("preserva valor desconhecido sem escolher mês por padrão e respeita bloqueio", async () => {
    const change = vi.fn();
    await act(async () => root.render(h(CampoBpmInput, { campo, value: "A definir com cliente", onChange: change, className: "", readOnly: true })));
    const select = container.querySelector("select")!;
    expect(select.disabled).toBe(true); expect(select.value).toBe("A definir com cliente");
    expect(select.selectedOptions[0].disabled).toBe(true); expect(select.selectedOptions[0].textContent).toContain("registro anterior");
    expect(change).not.toHaveBeenCalled();
  });

  it("não troca outros campos de data por um mês e reconhece o alias global", async () => {
    const props = { campo: { ...campo, chave: null, nome: "Data de protocolo" }, value: "2026-10-31", onChange: vi.fn(), className: "" };
    await act(async () => root.render(h(CampoBpmInput, props)));
    expect(container.querySelector('input[type="date"]')).not.toBeNull(); expect(container.querySelector("select")).toBeNull();
    await act(async () => root.render(h(CampoBpmInput, { ...props, campo: { ...campo, chave: "alpha.mes.de.protocolo", nome: "Mês de protocolo", tipo: "texto" }, value: "" })));
    expect(container.querySelector("select")!.value).toBe(""); expect(props.onChange).not.toHaveBeenCalled();
  });
});
