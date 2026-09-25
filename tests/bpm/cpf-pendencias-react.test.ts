// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { toast } from "sonner";
import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
let root: Root;
let container: HTMLDivElement;
let saves: ReturnType<typeof useCardSave>;
const campo = { pipelineId: "pipeline", etapaId: "etapa", obrigatorio: false, ordem: 0, id: "cpf", nome: "CPF", tipo: "cpf", opcoesJson: null, valor: "", editavel: true };
const card = { id: "card", updatedAt: "2026-09-22T10:00:00Z", etapa: { id: "etapa", nome: "Revisão de Radar", chave: "RADAR" }, camposEtapa: [campo, { ...campo, id: "nome", nome: "Nome", tipo: "texto" }] } as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
function Probe() { const context = useCardSave(); React.useEffect(() => { saves = context; }, [context]); return null; }
async function render(show = true) {
  await act(async () => root.render(h(CardSaveProvider, { children: [h(Probe, { key: "probe" }), show && h(PainelCamposEtapaAtual, { key: "panel", card, campoIds: ["cpf", "nome"], instanceKey: "form", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() })] })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
}
async function edit(value: string) {
  await act(async () => { const input = container.querySelector("input")!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
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
  expect(toast.error).toHaveBeenCalledWith(
    "Erro ao salvar. A alteração foi preservada nesta sessão.",
    expect.objectContaining({ action: expect.objectContaining({ label: "Tentar novamente" }) }),
  );
  expect(await saves.flushSaves(card.id)).toBe(false); expect(await saves.flushSaves(card.id)).toBe(false);
  expect(saves.getPendingFields()).toEqual(["CPF"]);
});
it("falha de rede não apaga pendências", async () => {
  vi.mocked(AtualizarCardBpm).mockRejectedValue(new Error("offline"));
  await edit("52998224725"); await blur();
  expect(await saves.flushSaves(card.id)).toBe(false); expect(await saves.flushSaves(card.id)).toBe(false);
  expect(container.querySelector("input")!.value).toBe("52998224725");
});
it("retry bem-sucedido limpa a falha anterior do flush", async () => {
  vi.mocked(AtualizarCardBpm).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
    success: true,
    data: { updatedAt: new Date("2026-09-22T10:01:00Z"), camposValores: { cpf: "52998224725" } },
  });
  await edit("52998224725"); await blur();
  expect(await saves.flushSaves(card.id)).toBe(false);
  await blur();
  expect(await saves.flushSaves(card.id)).toBe(true);
  expect(saves.getPendingFields()).toEqual([]);
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

it("salva outro campo mesmo com CPF inválido pendente", async () => {
  await edit("11111111111"); await blur();
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, camposEtapa: [campo, { ...campo, id: "nome", nome: "Nome", tipo: "texto", valor: "Alpha" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>("#campo-bpm-nome")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Alpha");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(AtualizarCardBpm).toHaveBeenCalledWith(expect.objectContaining({ camposValores: { nome: "Alpha" } }));
  expect(saves.getPendingFields()).toEqual(["CPF"]);
});
it("retorna o resultado da tentativa atual depois de falha", async () => {
  expect(await saves.registerSave(async () => false)).toBe(false);
  expect(await saves.registerSave(async () => true)).toBe(true);
});

it("salva a reversão feita antes de terminar o primeiro autosave", async () => {
  let liberar!: (value: Awaited<ReturnType<typeof AtualizarCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm)
    .mockImplementationOnce(() => new Promise((resolve) => { liberar = resolve; }))
    .mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm)
    .mockResolvedValueOnce({ success: true, data: { ...card, updatedAt: new Date("2026-09-22T10:01:00Z"), camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>)
    .mockResolvedValueOnce({ success: true, data: { ...card, updatedAt: new Date("2026-09-22T10:02:00Z") } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await edit("52998224725"); await blur();
  await edit(""); await blur();
  await act(async () => { liberar({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>); await saves.flushSaves(); });
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
  expect(AtualizarCardBpm).toHaveBeenLastCalledWith(expect.objectContaining({ camposValores: { cpf: "" }, versaoEsperadaEm: "2026-09-22T10:01:00.000Z" }));
  expect(container.querySelector("input")!.value).toBe("");
  expect(saves.getPendingFields()).toEqual([]);
});

it("volta a salvar no blur após falha de rede sem perder o rascunho", async () => {
  vi.mocked(AtualizarCardBpm).mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await edit("52998224725"); await blur();
  expect(saves.getPendingFields()).toEqual(["CPF"]);
  await blur();
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
  expect(saves.getPendingFields()).toEqual([]);
  expect(container.querySelector("input")!.value).toBe("52998224725");
});

 it("salva sem blur ao vencer 500ms e faz flush ao desmontar", async () => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  vi.useFakeTimers();
  try {
    await edit("52998224725");
    await act(async () => { await vi.advanceTimersByTimeAsync(499); });
    expect(AtualizarCardBpm).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(AtualizarCardBpm).toHaveBeenCalledOnce();
    await edit("");
    await act(async () => root.unmount());
    expect(AtualizarCardBpm).toHaveBeenCalledTimes(2);
    root = createRoot(container);
  } finally { vi.useRealTimers(); }
 });

it("retry após reabrir usa a edição mais recente ainda em debounce", async () => {
  vi.mocked(AtualizarCardBpm).mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ success: true } as Awaited<ReturnType<typeof AtualizarCardBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, camposEtapa: [{ ...campo, valor: "" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await edit("52998224725"); await blur();
  const args = vi.mocked(toast.error).mock.calls.slice().reverse().find((call) => call[1]?.action);
  const action = args?.[1]?.action;
  if (!action || typeof action !== "object" || React.isValidElement(action) || !("onClick" in action)) throw new Error("Retry ausente");
  await render(false); await render(true);
  expect(container.querySelector("input")!.value).toBe("52998224725");
  await edit("");
  await act(async () => { action.onClick({} as React.MouseEvent<HTMLButtonElement>); await saves.flushSaves(); });
  expect(container.querySelector("input")!.value).toBe("");
  expect(saves.getPendingFields()).toEqual([]);
  // A reversão para o valor do servidor não precisa de uma segunda escrita.
  expect(AtualizarCardBpm).toHaveBeenCalledTimes(1);
});

it("retry de upload atualiza link do painel reaberto apesar do snapshot inicial antigo", async () => {
  const uploadCard = { ...card, anexos: [], camposEtapa: [
    { ...campo, id: "arquivo", nome: "Contrato", tipo: "arquivo" },
    { ...campo, id: "nome", nome: "Nome", tipo: "texto" },
  ] };
  async function renderUpload(show: boolean) {
    await act(async () => root.render(h(CardSaveProvider, { children: [h(Probe, { key: "probe" }), show && h(PainelCamposEtapaAtual, {
      key: "upload", card: uploadCard, campoIds: ["arquivo", "nome"], instanceKey: "upload", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
    })] })));
  }
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(new Response(JSON.stringify({ success: true, file: { recibo: "receipt" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(RegistrarAnexoBpm).mockResolvedValue({ success: true, data: { id: "anexo", nome: "contrato.pdf", url: "/api/bpm/anexos/anexo" } } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...uploadCard, updatedAt: new Date("2026-09-22T10:05:00Z"), camposEtapa: uploadCard.camposEtapa.map((item) => item.id === "arquivo" ? { ...item, valor: "anexo" } : item) } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await renderUpload(true);
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [new File(["pdf"], "contrato.pdf")] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
  await renderUpload(false);
  await renderUpload(true);
  const args = vi.mocked(toast.error).mock.calls.slice().reverse().find((call) => call[1]?.action);
  const action = args?.[1]?.action;
  if (!action || typeof action !== "object" || !("onClick" in action)) throw new Error("Retry ausente");
  await act(async () => { action.onClick({} as React.MouseEvent<HTMLButtonElement>); await saves.flushSaves(); });
  expect(container.querySelector('a[href="/api/bpm/anexos/anexo"]')).not.toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  vi.unstubAllGlobals();
});

it("reinicia debounce de texto por edição e envia somente o valor final aos 500ms", async () => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true });
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...card, camposEtapa: [campo, { ...campo, id: "nome", nome: "Nome", tipo: "texto", valor: "Alpha final" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  vi.useFakeTimers();
  try {
    const input = container.querySelector<HTMLInputElement>("#campo-bpm-nome")!;
    for (const value of ["A", "Alpha", "Alpha final"]) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(399); });
    expect(AtualizarCardBpm).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(AtualizarCardBpm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ camposValores: { nome: "Alpha final" } }));
  } finally { vi.useRealTimers(); }
});

it.each([
  ["selecao", "A"], ["multiselecao", '["A"]'], ["booleano", "Sim"],
  ["data", "2026-09-23"], ["data_hora", "2026-09-23T14:30"],
])("campo dinâmico %s da etapa salva no change sem blur nem avanço do relógio", async (tipo, valor) => {
  const dinamico = { ...campo, id: "dinamico", nome: "Campo da etapa", tipo, opcoesJson: '["A","B"]' };
  const dynamicCard = { ...card, camposEtapa: [dinamico] };
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true });
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: { ...dynamicCard, camposEtapa: [{ ...dinamico, valor }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  await act(async () => root.render(h(CardSaveProvider, null, h(PainelCamposEtapaAtual, {
    card: dynamicCard, campoIds: ["dinamico"], instanceKey: "dynamic", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));
  vi.useFakeTimers();
  try {
    await act(async () => {
      if (tipo === "multiselecao") {
        const group = container.querySelector<HTMLElement>("#campo-bpm-dinamico")!;
        expect(group.getAttribute("role")).toBe("group");
        const option = [...group.querySelectorAll("button")].find((button) => button.textContent === "A")!;
        expect(option.getAttribute("aria-pressed")).toBe("false");
        option.click();
        return;
      }
      const input = container.querySelector<HTMLInputElement | HTMLSelectElement>("#campo-bpm-dinamico")!;
      if (input instanceof HTMLSelectElement) {
        for (const option of input.options) option.selected = option.value === valor;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(AtualizarCardBpm).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ camposValores: { dinamico: valor } }));
  } finally { vi.useRealTimers(); }
});


it("mostra Salvo somente após confirmar no servidor e limpa sucesso na próxima edição", async () => {
  let confirmar!: (value: Awaited<ReturnType<typeof ObterCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true });
  vi.mocked(ObterCardBpm).mockImplementationOnce(() => new Promise((resolve) => { confirmar = resolve; }));
  expect(container.querySelector('[role="status"]')!.textContent).not.toContain("Salvo");
  await edit("52998224725"); await blur();
  expect(container.querySelector('[role="status"]')!.textContent).toContain("Salvando");
  await act(async () => {
    confirmar({ success: true, data: { ...card, camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
    await saves.flushSaves();
  });
  expect(container.querySelector('[role="status"]')!.textContent).toBe(" Salvo");
  await edit("123");
  expect(container.querySelector('[role="status"]')!.textContent).not.toContain("Salvo");
});

it("confirma pelo recibo da action sem segunda leitura sujeita a falha", async () => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue({
    success: true,
    data: { updatedAt: new Date("2026-09-22T10:01:00Z"), camposValores: { cpf: "52998224725" } },
  });
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: false, error: "offline" });
  await edit("52998224725"); await blur();
  expect(container.querySelector('[role="status"]')!.textContent).toContain("Salvo");
  expect(saves.getPendingFields()).toEqual([]);
  expect(ObterCardBpm).not.toHaveBeenCalled();
});

it.each(["action", "confirmação"])("não mostra Salvo quando falha a %s e preserva o valor", async (falha) => {
  vi.mocked(AtualizarCardBpm).mockResolvedValue(falha === "action" ? { success: false, error: "offline" } : { success: true });
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: false, error: "offline" });
  await edit("52998224725"); await blur();
  expect(container.querySelector('[role="status"]')!.textContent).toContain("Erro ao salvar");
  expect(container.querySelector('[role="status"]')!.textContent).not.toContain("Salvo");
  expect(container.querySelector("input")!.value).toBe("52998224725");
  expect(saves.getPendingFields()).toEqual(["CPF"]);
});

it("confirmação antiga durante novo debounce nunca mostra Salvo", async () => {
  let confirmar!: (value: Awaited<ReturnType<typeof ObterCardBpm>>) => void;
  vi.mocked(AtualizarCardBpm).mockResolvedValue({ success: true });
  vi.mocked(ObterCardBpm).mockImplementationOnce(() => new Promise((resolve) => { confirmar = resolve; }));
  await edit("52998224725"); await blur();
  await edit("123");
  await act(async () => {
    confirmar({ success: true, data: { ...card, camposEtapa: [{ ...campo, valor: "52998224725" }] } } as Awaited<ReturnType<typeof ObterCardBpm>>);
  });
  expect(container.querySelector('[role="status"]')!.textContent).toBe("Alterações pendentes");
  expect(container.querySelector("input")!.value).toBe("123");
  expect(saves.getPendingFields()).toEqual(["CPF"]);
});
