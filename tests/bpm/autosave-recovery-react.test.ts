// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { toast } from "sonner";
import PainelProximaEtapa from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa";
import { MoverCardBpm } from "@/actions/bpm/Cards";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/actions/bpm/Checklists", () => ({ ObterResumoChecklistCardBpm: vi.fn(async () => ({ success: false })) }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CampoBpmInput", () => ({ CampoBpmInput: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Cards", () => ({ MoverCardBpm: vi.fn(async () => ({ success: true })), ObterRequisitosTransicaoBpm: vi.fn(async () => ({ success: true, data: { etapaDestino: { id: "destino", nome: "Avançar" }, campos: [], faltantes: [], guardas: [] } })), SalvarRequisitosEMoverCardBpm: vi.fn(async () => ({ success: true })), ObterCardBpm: vi.fn(async () => ({ success: true, data: { updatedAt: "2026-09-22T12:00:00Z" } })) }));
let root: Root;
let host: HTMLDivElement;
let context: ReturnType<typeof useCardSave>;
function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); root = createRoot(host);
  await act(async () => root.render(h(CardSaveProvider, { children: h(Probe) })));
});
afterEach(async () => { await act(async () => root.unmount()); });
function retry() {
  const args = vi.mocked(toast.error).mock.calls.at(-1);
  const action = args?.[1]?.action;
  if (!action || typeof action !== "object" || React.isValidElement(action) || !("onClick" in action)) throw new Error("Retry ausente");
  action.onClick({} as React.MouseEvent<HTMLButtonElement>);
}
it("mantém falha em flushs repetidos e permite retry após desmontar o consumidor", async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  await context.registerSave(save, "card", "card:arquivo");
  expect(await context.flushSaves()).toBe(false);
  expect(await context.flushSaves()).toBe(false);
  await act(async () => root.render(h(CardSaveProvider, { children: null })));
  retry();
  expect(await context.flushSaves()).toBe(true);
  expect(save).toHaveBeenCalledTimes(2);
});
it("retry antigo nunca reaplica valor substituído por uma edição nova", async () => {
  const old = vi.fn(async () => false);
  await context.registerSave(old, "card", "card:resumo");
  const current = vi.fn(async () => true);
  await context.registerSave(current, "card", "card:resumo");
  retry();
  await context.flushSaves();
  expect(old).toHaveBeenCalledTimes(1);
  expect(current).toHaveBeenCalledTimes(1);
});
it("a seção seguinte usa a versão confirmada pela primeira na fila", async () => {
  let release!: (value: boolean) => void;
  const first = context.registerSave(() => new Promise<boolean>((resolve) => { release = resolve; }), "card", "card:first");
  const observed: string[] = [];
  const second = context.registerSave(async () => { observed.push(context.getVersion("card", "2026-09-22T10:00:00Z")); return true; }, "card", "card:second");
  await Promise.resolve();
  expect(observed).toEqual([]);
  release(true);
  await Promise.all([first, second]);
  expect(observed).toEqual(["2026-09-22T12:00:00.000Z"]);
});

it("retry antecipa debounce novo sem reenviar a revisão antiga", async () => {
  const old = vi.fn(async () => false);
  await context.registerSave(old, "card", "card:resumo");
  const current = vi.fn(async () => true);
  context.scheduleSave("card:resumo", () => { void context.registerSave(current, "card", "card:resumo"); });
  retry();
  await context.flushSaves();
  expect(old).toHaveBeenCalledTimes(1);
  expect(current).toHaveBeenCalledTimes(1);
});

it("notifica apenas o consumidor atual do card após confirmação real", async () => {
  const old = vi.fn();
  const current = vi.fn();
  const other = vi.fn();
  const unsubscribe = context.subscribeConfirmation("card", old);
  context.subscribeConfirmation("other", other);
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
  await context.registerSave(save, "card", "card:status");
  expect(old).not.toHaveBeenCalled();
  unsubscribe();
  context.subscribeConfirmation("card", current);
  retry();
  await context.flushSaves();
  expect(old).not.toHaveBeenCalled();
  expect(other).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: "2026-09-22T12:00:00Z" }), "card:status");
});


it("falha de A não bloqueia flush de B e preserva rascunho e retry de A após reabertura", async () => {
  context.setDraft("A:campo", { texto: "Edição de A" });
  context.setPendingFields("A:campo", ["Texto"]);
  const saveA = vi.fn().mockResolvedValueOnce(false).mockImplementation(async () => {
    context.setPendingFields("A:campo", []);
    context.setDraft("A:campo");
    return true;
  });
  await context.registerSave(saveA, "A", "A:campo");
  await act(async () => root.render(h(CardSaveProvider, { children: null })));
  await act(async () => root.render(h(CardSaveProvider, { children: h(Probe) })));
  const saveB = vi.fn(async () => true);
  context.scheduleSave("B:campo", () => { void context.registerSave(saveB, "B", "B:campo"); });
  expect(await context.flushSaves("B")).toBe(true);
  expect(saveB).toHaveBeenCalledTimes(1);
  expect(context.getDraft("A:campo")).toEqual({ texto: "Edição de A" });
  expect(context.getPendingFields("B")).toEqual([]);
  expect(await context.flushSaves("A")).toBe(false);
  retry();
  expect(await context.flushSaves("A")).toBe(true);
  expect(context.getDraft("A:campo")).toBeUndefined();
});

it("rede pendente de A não impede B e flush de B não antecipa debounce de A", async () => {
  let release!: (value: boolean) => void;
  const pendingA = context.registerSave(() => new Promise<boolean>((resolve) => { release = resolve; }), "A", "A:campo");
  const scheduledA = vi.fn();
  context.scheduleSave("A:outro", scheduledA, 60_000);
  const saveB = vi.fn(async () => true);
  context.scheduleSave("B:campo", () => { void context.registerSave(saveB, "B", "B:campo"); });
  try {
    expect(await context.flushSaves("B")).toBe(true);
    expect(saveB).toHaveBeenCalledTimes(1);
    expect(scheduledA).not.toHaveBeenCalled();
  } finally {
    release(true);
    await pendingA;
    context.flushScheduled("A:");
  }
});


it("flush distingue IDs com prefixo comum e mantém a recuperação do outro card", async () => {
  vi.useFakeTimers();
  try {
    context.setDraft("AB:campo", { texto: "Rascunho de AB" });
    context.setPendingFields("AB:campo", ["Texto AB"]);
    const saveAB = vi.fn(async () => false);
    await context.registerSave(saveAB, "AB", "AB:campo");
    const scheduledAB = vi.fn();
    context.scheduleSave("AB:outro", scheduledAB);
    const saveA = vi.fn(async () => true);
    context.scheduleSave("A:campo", () => { void context.registerSave(saveA, "A", "A:campo"); });

    expect(await context.flushSaves("A")).toBe(true);
    expect(saveA).toHaveBeenCalledOnce();
    expect(scheduledAB).not.toHaveBeenCalled();
    expect(context.getPendingFields("A")).toEqual([]);
    expect(context.getDraft("AB:campo")).toEqual({ texto: "Rascunho de AB" });
    expect(await context.flushSaves("AB")).toBe(false);
    expect(scheduledAB).toHaveBeenCalledOnce();
    expect(saveAB).toHaveBeenCalledOnce();
  } finally {
    context.flushScheduled();
    vi.useRealTimers();
  }
});

it("botão de avanço move B após falha de A, mas bloqueia pendência do próprio B", async () => {
  await context.registerSave(async () => false, "A", "A:campo");
  context.setDraft("A:campo", { texto: "Preservado" });
  context.setPendingFields("A:campo", ["Texto A"]);
  const card = { id: "B", etapa: { id: "origem", chave: "RADAR" } } as React.ComponentProps<typeof PainelProximaEtapa>["card"];
  const onMovido = vi.fn();
  await act(async () => root.render(h(CardSaveProvider, { children: [h(Probe, { key: "probe" }), h(PainelProximaEtapa, {
    key: "move", card, etapas: [{ id: "destino", nome: "Avançar", ordem: 1, script: null }],
    podeMoverEtapa: true, accent: "1,2,3", onMovido,
  })] })));
  context.setPendingFields("B:campo", ["Texto B"]);
  await act(async () => host.querySelector("button")!.click());
  expect(MoverCardBpm).not.toHaveBeenCalled();
  context.scheduleSave("B:campo", () => { void context.registerSave(async () => {
    context.setPendingFields("B:campo", []);
    return true;
  }, "B", "B:campo"); });
  await act(async () => host.querySelector("button")!.click());
  expect(MoverCardBpm).toHaveBeenCalledWith({ cardId: "B", etapaDestinoId: "destino" });
  expect(onMovido).toHaveBeenCalledTimes(1);
  expect(context.getDraft("A:campo")).toEqual({ texto: "Preservado" });
});
