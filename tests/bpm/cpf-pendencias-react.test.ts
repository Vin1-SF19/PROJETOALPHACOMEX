// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CampoBpmInput", () => ({ CampoBpmInput: (props: { value: string; onChange: (value: string) => void; onBlur: () => void }) => h("input", { value: props.value, onInput: (event: React.FormEvent<HTMLInputElement>) => props.onChange(event.currentTarget.value), onBlur: props.onBlur }) }));
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
let root: Root;
let container: HTMLDivElement;
let saves: ReturnType<typeof useCardSave>;
const campo = { id: "cpf", nome: "CPF", tipo: "cpf", opcoesJson: null, valor: "", editavel: true };
const card = { id: "card", updatedAt: "2026-09-22T10:00:00Z", etapa: { id: "etapa", nome: "Revisão de Radar", chave: "RADAR" }, camposEtapa: [campo] } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
function Probe() { const context = useCardSave(); React.useEffect(() => { saves = context; }, [context]); return null; }
async function render(show = true) {
  await act(async () => root.render(h(CardSaveProvider, { children: [h(Probe, { key: "probe" }), show && h(PainelCamposEtapaAtual, { key: "panel", card, campoIds: ["cpf"], instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() })] })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}
async function edit(value: string) {
  await act(async () => { const input = container.querySelector("input")!; input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); });
}
async function blur() { await act(async () => { container.querySelector("input")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); }); }
beforeEach(async () => {
  vi.resetAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container); await render();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it.each(["529.982.247-25", "52998224725"])("normaliza e reconcilia CPF %s com o servidor", async (valor) => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, updatedAt: new Date("2026-09-22T10:01:00Z"), camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await edit(valor); await blur();
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({ camposValores: { cpf: "52998224725" } }));
  expect(container.querySelector("input")!.value).toBe("52998224725"); expect(saves.getPendingFields()).toEqual([]);
});
it("CPF inválido mantém pendência em fechamentos repetidos", async () => {
  await edit("111.111.111-11"); await blur();
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
  expect(await saves.flushSaves()).toBe(false); expect(await saves.flushSaves()).toBe(false);
  expect(saves.getPendingFields()).toEqual(["CPF"]);
});
it("falha de rede não apaga pendências", async () => {
  vi.mocked(AtualizarCardBpm).mockRejectedValue(new Error("offline"));
  await edit("52998224725"); await blur();
  expect(await saves.flushSaves()).toBe(false); expect(await saves.flushSaves()).toBe(false);
  expect(container.querySelector("input")!.value).toBe("52998224725");
});
it("save antigo não confirma edição mais recente", async () => {
  let resolveSave!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm).mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await edit("52998224725"); await blur(); await edit("123");
  await act(async () => resolveSave({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>));
  expect(container.querySelector("input")!.value).toBe("123"); expect(saves.getPendingFields()).toEqual(["CPF"]);
});
it("flush aguarda saves acrescentados durante a espera", async () => {
  let release!: (value: boolean) => void;
  saves.registerSave(() => new Promise((resolve) => { release = resolve; }));
  const flush = saves.flushSaves(); await Promise.resolve();
  const second = vi.fn(async () => true); saves.registerSave(second); release(true);
  expect(await flush).toBe(true); expect(second).toHaveBeenCalledOnce();
});
it("validação compartilhada recusa dígitos verificadores inválidos", () => {
  expect(validarValoresCamposBpm([campo], { cpf: "52998224724" }).success).toBe(false);
});
