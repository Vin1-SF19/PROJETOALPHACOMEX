// @vitest-environment happy-dom
// @vitest-environment-options {"happyDOM":{"settings":{"disableIframePageLoading":true}}}
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VisualizadorAnexoCard } from "@/components/bpm/anexos/VisualizadorAnexoCard";
import { urlContratoComercialSegura } from "@/components/bpm/anexos/VisualizadorContratoComercial";
const documento = { id: "contratacao:comercial:para_envio", nome: "Contrato final.pdf", tipo: "application/pdf", urlAcesso: "/api/bpm/cards/comercial/contrato?tipo=para_envio", origem: "CONTRATACAO" as const, somenteLeitura: true };
let root: Root, host: HTMLDivElement;
const fetchMock = vi.fn();
beforeEach(() => { (window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }).happyDOM.settings.disableIframePageLoading = true; vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true }); host = document.createElement("div"); document.body.append(host); root = createRoot(host); vi.stubGlobal("fetch", fetchMock); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:contrato-validado"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {}); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function montar(anexo = documento, cardId: string | undefined = "comercial") {
  await act(async () => root.render(h(VisualizadorAnexoCard, { anexo, cardId, onClose: vi.fn() })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
it("lê só o endpoint comercial autenticado, respeita MIME e libera o blob ao fechar", async () => {
  fetchMock.mockResolvedValue(new Response("%PDF-1.7", { headers: { "Content-Type": "application/pdf" } })); await montar();
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(documento.urlAcesso, expect.objectContaining({ cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal) }));
  expect(document.body.querySelector("iframe")?.src).toBe("blob:contrato-validado");
  expect(document.body.querySelector(`a[href="${documento.urlAcesso}"]`)).toBeTruthy();
  expect(document.body.textContent).toContain("somente leitura");
  await act(async () => root.render(h(VisualizadorAnexoCard, { anexo: null, cardId: "comercial", onClose: vi.fn() })));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:contrato-validado");
});
it.each(["https://externo.test/contrato.pdf", "//externo.test/contrato.pdf", "/api/bpm/cards/outro/contrato?tipo=para_envio", "/api/bpm/cards/comercial/contrato?tipo=para_envio&url=https://externo.test", "/api/bpm/cards/comercial/contrato?tipo=outro", "javascript:alert(1)"])("recusa endereço/contexto forjado: %s", async (urlAcesso) => {
  const anexo = { ...documento, urlAcesso };
  expect(urlContratoComercialSegura(anexo, "comercial")).toBeNull(); await montar(anexo);
  expect(fetchMock).not.toHaveBeenCalled(); expect(document.body.querySelector("iframe,a")).toBeNull(); expect(document.body.textContent).toContain("Documento indisponível");
});
it("falha de arquivo removido permanece honesta e permite tentar a consulta novamente", async () => {
  fetchMock.mockResolvedValueOnce(new Response("ausente", { status: 404 })).mockResolvedValueOnce(new Response("%PDF-1.7", { headers: { "Content-Type": "application/pdf" } }));
  await montar(); expect(document.body.textContent).toContain("O documento não está disponível"); expect(document.body.querySelector("iframe")).toBeNull();
  const atualizar = [...document.body.querySelectorAll("button")].find((button) => button.textContent === " Atualizar consulta" || button.textContent?.trim() === "Atualizar consulta")!;
  await act(async () => atualizar.click()); await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  expect(document.body.querySelector("iframe")).toBeTruthy(); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("não incorpora HTML como se fosse PDF", async () => {
  fetchMock.mockResolvedValue(new Response("<script>erro</script>", { headers: { "Content-Type": "text/html" } })); await montar();
  expect(document.body.querySelector("iframe")).toBeNull(); expect(document.body.textContent).toContain("Não foi possível confirmar o formato");
});
