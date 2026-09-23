// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";

vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
let saves: ReturnType<typeof useCardSave>;

function Probe() {
  const context = useCardSave();
  React.useEffect(() => { saves = context; }, [context]);
  return null;
}

function makeCard(campos: Array<{ id: string; nome: string; tipo: string; opcoesJson?: string | null }>) {
  return {
    id: "card",
    updatedAt: "2026-09-22T10:00:00Z",
    etapa: { id: "etapa", nome: "Revisão", chave: "RADAR" },
    camposEtapa: campos.map((c) => ({
      pipelineId: "pipeline", etapaId: "etapa", obrigatorio: false, ordem: 0,
      id: c.id, nome: c.nome, tipo: c.tipo, opcoesJson: c.opcoesJson ?? null,
      valor: "", editavel: true,
    })),
  } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
}

async function render(card: React.ComponentProps<typeof PainelCamposEtapaAtual>["card"], campoIds: string[]) {
  await act(async () => root.render(h(CardSaveProvider, { children: [
    h(Probe, { key: "probe" }),
    h(PainelCamposEtapaAtual, { key: "panel", card, campoIds, instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() }),
  ] })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({
    success: true,
    data: { ...makeCard([]), updatedAt: new Date("2026-09-22T10:01:00Z"), camposEtapa: [] },
  } as Awaited<ReturnType<typeof ObterCardBpm>>);
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("select dispara a action imediatamente na mudança, sem blur", async () => {
  const card = makeCard([{ id: "status", nome: "Status", tipo: "selecao", opcoesJson: '["A","B","C"]' }]);
  await render(card, ["status"]);

  const select = container.querySelector<HTMLSelectElement>("#campo-bpm-status")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "B");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // Sem blur: a action já foi chamada imediatamente (delay=0)
  expect(AtualizarCardBpm).toHaveBeenCalledOnce();
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({
    cardId: "card",
    camposValores: { status: "B" },
  }));
});

it("multiselect dispara a action imediatamente ao selecionar, sem blur", async () => {
  const card = makeCard([{ id: "tags", nome: "Tags", tipo: "multiselecao", opcoesJson: '["X","Y","Z"]' }]);
  await render(card, ["tags"]);

  const buttons = container.querySelectorAll<HTMLButtonElement>('[role="group"] button');
  expect(buttons.length).toBe(3);
  await act(async () => { buttons[0].click(); });

  // multiselect chama onChange + onBlur; a action é disparada imediatamente (delay=0)
  expect(AtualizarCardBpm).toHaveBeenCalled();
  expect(AtualizarCardBpm).toHaveBeenLastCalledWith(expect.objectContaining({
    cardId: "card",
    camposValores: { tags: '["X"]' },
  }));
});

it("booleano (Sim/Não) dispara a action imediatamente na mudança, sem blur", async () => {
  const card = makeCard([{ id: "ativo", nome: "Ativo", tipo: "booleano" }]);
  await render(card, ["ativo"]);

  const select = container.querySelector<HTMLSelectElement>("#campo-bpm-ativo")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "Sim");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(AtualizarCardBpm).toHaveBeenCalledOnce();
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({
    cardId: "card",
    camposValores: { ativo: "Sim" },
  }));
});

it("data dispara a action imediatamente na mudança, sem blur", async () => {
  const card = makeCard([{ id: "prazo", nome: "Prazo", tipo: "data" }]);
  await render(card, ["prazo"]);

  const input = container.querySelector<HTMLInputElement>("#campo-bpm-prazo")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2026-10-01");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  expect(AtualizarCardBpm).toHaveBeenCalledOnce();
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({
    cardId: "card",
    camposValores: { prazo: "2026-10-01" },
  }));
});

it("duas edições rápidas no mesmo campo de select persistem a última", async () => {
  const card = makeCard([{ id: "status", nome: "Status", tipo: "selecao", opcoesJson: '["A","B","C"]' }]);
  await render(card, ["status"]);

  const select = container.querySelector<HTMLSelectElement>("#campo-bpm-status")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "B");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "C");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await act(async () => { await saves.flushSaves("card"); });

  // A última edição (C) é a que foi persistida
  expect(AtualizarCardBpm).toHaveBeenLastCalledWith(expect.objectContaining({
    cardId: "card",
    camposValores: { status: "C" },
  }));
});

it("falha da action em campo imediato preserva o valor para nova tentativa", async () => {
  vi.mocked(AtualizarCardBpm).mockRejectedValueOnce(new Error("offline"));
  const card = makeCard([{ id: "status", nome: "Status", tipo: "selecao", opcoesJson: '["A","B"]' }]);
  await render(card, ["status"]);

  const select = container.querySelector<HTMLSelectElement>("#campo-bpm-status")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "B");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await act(async () => { await saves.flushSaves("card"); });

  // O valor continua disponível no input
  expect(select.value).toBe("B");
  // Pendência registrada
  expect(saves.getPendingFields("card").length).toBeGreaterThan(0);
});
