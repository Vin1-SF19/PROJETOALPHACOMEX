// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { toast } from "sonner";

vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));

const campos = ["primeiro", "segundo", "terceiro", "quarto"].map((id) => ({
  id, nome: id, tipo: "texto", valor: "", editavel: true, obrigatorio: false,
  pipelineId: "pipeline", etapaId: "etapa", ordem: 0, opcoesJson: null,
}));
const card = { id: "card", updatedAt: "2026-09-29T10:00:00Z", etapa: { id: "etapa", nome: "Confirmação de Pagamento", chave: "confirmacao_pagamento" }, camposEtapa: campos } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
let root: Root;
let container: HTMLDivElement;
let context: ReturnType<typeof useCardSave>;
function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
async function editar(id: string, valor: string) {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(`#campo-bpm-${id}`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}
function botaoSalvar() { return [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Salvar alterações") || button.textContent?.includes("Salvando "))!; }

beforeEach(async () => {
  vi.resetAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: card } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual, {
    card, campoIds: campos.map((campo) => campo.id), instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

it("não grava ao digitar, selecionar ou sair do campo; conta só os dois campos alterados", async () => {
  await editar("primeiro", "A");
  await editar("terceiro", "C");
  expect(AtualizarCardBpm).not.toHaveBeenCalled();
  expect(botaoSalvar().textContent).toContain("Salvar alterações (2)");
  expect(context.getPendingFields("card")).toEqual(["primeiro", "terceiro"]);
});

it("grava um campo por vez e mostra 1/2, 2/2 até confirmar", async () => {
  let resolverPrimeiro!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  let resolverSegundo!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm)
    .mockImplementationOnce(() => new Promise((resolve) => { resolverPrimeiro = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolverSegundo = resolve; }));
  await editar("primeiro", "A"); await editar("terceiro", "C");
  await act(async () => { botaoSalvar().click(); await Promise.resolve(); });
  expect(botaoSalvar().textContent).toContain("Salvando 1/2");
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(AtualizarCardBpm).toHaveBeenNthCalledWith(1, expect.objectContaining({ camposValores: { primeiro: "A" } }));
  await act(async () => { resolverPrimeiro({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: { primeiro: "A" } } }); await Promise.resolve(); });
  expect(botaoSalvar().textContent).toContain("Salvando 2/2");
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
  expect(AtualizarCardBpm).toHaveBeenNthCalledWith(2, expect.objectContaining({ camposValores: { terceiro: "C" }, versaoEsperadaEm: "2026-09-29T10:01:00.000Z" }));
  await act(async () => { resolverSegundo({ success: true, data: { updatedAt: new Date("2026-09-29T10:02:00Z"), camposValores: { terceiro: "C" } } }); await Promise.resolve(); });
  expect(context.getPendingFields("card")).toEqual([]);
  expect(botaoSalvar().hasAttribute("disabled")).toBe(true);
});

it("para na falha, preserva os campos restantes e permite tentar de novo", async () => {
  vi.mocked(AtualizarCardBpm)
    .mockResolvedValueOnce({ success: false, error: "Falha de validação" })
    .mockResolvedValueOnce({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: { primeiro: "A" } } })
    .mockResolvedValueOnce({ success: true, data: { updatedAt: new Date("2026-09-29T10:02:00Z"), camposValores: { terceiro: "C" } } });
  await editar("primeiro", "A"); await editar("terceiro", "C");
  await act(async () => { botaoSalvar().click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
  expect(context.getPendingFields("card")).toEqual(["primeiro", "terceiro"]);
  expect(toast.error).toHaveBeenCalledTimes(1);
  await act(async () => { botaoSalvar().click(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(3);
  expect(context.getPendingFields("card")).toEqual([]);
});

it("o comando de salvar do diálogo de saída usa o mesmo fluxo manual", async () => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true, data: { updatedAt: new Date("2026-09-29T10:01:00Z"), camposValores: { primeiro: "A" } } });
  await editar("primeiro", "A");
  expect(await context.flushSaves("card")).toBe(false);
  await act(async () => { expect(await context.retryFailedSaves("card")).toBe(true); });
  expect(AtualizarCardBpm).toHaveBeenCalledOnce();
  expect(context.getPendingFields("card")).toEqual([]);
});
