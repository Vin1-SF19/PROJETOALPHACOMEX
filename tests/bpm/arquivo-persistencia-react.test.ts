// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";
import { ObterCardBpm } from "@/actions/bpm/Cards";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));

it("enfileira upload e registro antes do await e abre o arquivo confirmado no modal", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    success: true,
    file: { recibo: "recibo-assinado" },
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
  vi.mocked(RegistrarAnexoBpm).mockResolvedValue({
    success: true,
    data: { id: "anexo-1", nome: "contrato.pdf", url: "/api/bpm/anexos/anexo-1" },
  } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  const registerFileSave = vi.fn(async (save: () => Promise<boolean>) => save());
  const onFileConfirmed = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(h(CampoBpmInput, {
    campo: { id: "campo-arquivo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
    value: "",
    onChange: vi.fn(),
    className: "",
    cardId: "card-1",
    registerFileSave,
    onFileConfirmed,
  })));
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["pdf"], "contrato.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));

  expect(registerFileSave).toHaveBeenCalledOnce();
  expect(RegistrarAnexoBpm).toHaveBeenCalledExactlyOnceWith({
    cardId: "card-1",
    campoId: "campo-arquivo",
    recibo: "recibo-assinado",
  });
  expect(onFileConfirmed).toHaveBeenCalledWith({
    id: "anexo-1",
    nome: "contrato.pdf",
    url: "/api/bpm/anexos/anexo-1",
  });

  await act(async () => root.render(h(CampoBpmInput, {
    campo: { id: "campo-arquivo", nome: "Contrato", tipo: "arquivo", obrigatorio: false, opcoesJson: null },
    value: "anexo-1",
    arquivoAtual: { id: "anexo-1", nome: "contrato.pdf", url: "/api/bpm/anexos/anexo-1" },
    onChange: vi.fn(),
    className: "",
    cardId: "card-1",
  })));
  const abrir = Array.from(container.querySelectorAll("button")).find((botao) => botao.textContent === "contrato.pdf");
  expect(abrir).toBeDefined();
  await act(async () => abrir?.click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("contrato.pdf");

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("limpa a pendência do anexo depois de falha e retry pelo diálogo", async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const card = {
    id: "card-upload", updatedAt: "2026-09-22T10:00:00Z",
    etapa: { nome: "Reunião", chave: "RADAR" }, anexos: [],
    camposEtapa: [{ id: "anexo", nome: "Documento", tipo: "arquivo", valor: "", obrigatorio: false, opcoesJson: null, editavel: true }],
  };
  vi.stubGlobal("fetch", vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: "Falha" }), { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, file: { recibo: "recibo" } }), { status: 200 })));
  vi.mocked(RegistrarAnexoBpm).mockResolvedValue({ success: true, data: { id: "anexo-1", nome: "documento.pdf", url: "/anexo" } } as Awaited<ReturnType<typeof RegistrarAnexoBpm>>);
  vi.mocked(ObterCardBpm).mockResolvedValue({ success: true, data: {
    ...card, updatedAt: "2026-09-22T10:01:00Z", camposEtapa: [{ ...card.camposEtapa[0], valor: "anexo-1" }],
  } } as unknown as Awaited<ReturnType<typeof ObterCardBpm>>);
  let context!: ReturnType<typeof useCardSave>;
  function Probe() { const value = useCardSave(); React.useEffect(() => { context = value; }, [value]); return null; }
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(h(CardSaveProvider, null,
      h(Probe),
      h(PainelCamposEtapaAtual, { card: card as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"],
        campoIds: ["anexo"], instanceKey: "upload", accent: "1,2,3", podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn() }))));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["pdf"], "documento.pdf")] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(context.getPendingChanges("card-upload")).toEqual([{ label: "Documento", before: "", after: "documento.pdf" }]);
    expect(context.getFailedSaveKeys("card-upload")).toEqual(["card-upload:arquivo:anexo"]);
    expect(await context.flushSaves("card-upload")).toBe(false);
    await act(async () => { expect(await context.retryFailedSaves("card-upload")).toBe(true); });
    expect(context.getPendingChanges("card-upload")).toEqual([]);
    expect(context.getFailedSaveKeys("card-upload")).toEqual([]);
    expect(RegistrarAnexoBpm).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
