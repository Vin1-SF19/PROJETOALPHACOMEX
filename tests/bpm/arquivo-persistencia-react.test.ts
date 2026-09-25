// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { RegistrarAnexoBpm } from "@/actions/bpm/Anexos";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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
