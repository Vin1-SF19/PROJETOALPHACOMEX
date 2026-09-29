// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { VisualizadorAnexoCard } from "@/components/bpm/anexos/VisualizadorAnexoCard";

it("mostra no modal as cláusulas do contrato gerado mesmo sem PDF", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    titulo: "Contrato Alpha", status: "CONFERENCIA", pdfDisponivel: false,
    clausulas: [{ id: "c1", ordem: 1, titulo: "Objeto", conteudo: "Prestação de serviços" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(h(VisualizadorAnexoCard, {
    anexo: { id: "anexo-1", nome: "Contrato Alpha", tipo: "application/x-painel-alpha-documento" },
    onClose: vi.fn(),
  })));
  await act(async () => { await Promise.resolve(); });

  expect(fetchMock).toHaveBeenCalledWith("/api/bpm/anexos/anexo-1/preview", expect.any(Object));
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Prestação de serviços");
  expect(document.querySelector('[role="dialog"] iframe')).toBeNull();

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("abre o contrato padrão em PDF e oferece acesso ao Gerador", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", status: "CONFERENCIA", pdfDisponivel: true,
    clausulas: [{ id: "c1", ordem: 1, titulo: "Objeto", conteudo: "Prestação de serviços" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } })));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(h(VisualizadorAnexoCard, {
    anexo: { id: "anexo-2", nome: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", tipo: "application/x-painel-alpha-documento" },
    onClose: vi.fn(),
  })));
  await act(async () => { await Promise.resolve(); });

  expect(document.querySelector('[role="dialog"] iframe')?.getAttribute("src"))
    .toBe("/api/bpm/anexos/anexo-2/preview?formato=pdf");
  expect(document.querySelector('[role="dialog"] a[href="/api/bpm/anexos/anexo-2"]')?.textContent)
    .toContain("Abrir no Gerador de Documentos");

  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
