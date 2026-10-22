// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getTema } from "@/lib/temas";
import { fmtDateTime } from "@/lib/format-date";
const mocks = vi.hoisted(() => ({ buscar: vi.fn(), atualizar: vi.fn(), fetch: vi.fn() }));
vi.mock("@/actions/PreAnalise", () => ({ buscarRadarSalvo: mocks.buscar, atualizarRadar: mocks.atualizar }));
vi.mock("@/components/ModalPdf", () => ({ ModalPDF: () => null }));
import BlocoResultados from "@/app/PainelAlpha/SistemaPreAnalise/BlocoResultados";
const mounts: { root: ReturnType<typeof createRoot>; container: HTMLDivElement }[] = [];
const dataOriginal = "2026-10-01T12:00:00Z";
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("fetch", mocks.fetch); mocks.buscar.mockResolvedValue({ data: null }); mocks.atualizar.mockResolvedValue({ success: true });
});
afterEach(async () => {
  for (const { root, container } of mounts.splice(0)) { await act(async () => root.unmount()); container.remove(); }
  vi.unstubAllGlobals();
});
async function consultar(comSnapshot = true) {
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container); mounts.push({ root, container });
  await act(async () => root.render(h(BlocoResultados, { visual: getTema(), userName: "Teste", dados: {
    rfb: { dados: { cnpj: "33000167000101", razaoSocial: "Empresa de teste" } },
    ...(comSnapshot ? { radar: { dados: { situacao: "HABILITADA", submodalidade: "ILIMITADA" }, consultadoEm: dataOriginal } } : {}),
  } })));
  const botao = Array.from(container.querySelectorAll("button")).find(b => /^(Reconsultar|Iniciar Consulta)$/.test(b.textContent?.trim() ?? ""))!;
  await act(async () => botao.click()); return container;
}
const ausencias = [
  { status: 200, ok: true, payload: { situacao: "NÃO CONSTA NO ARQUIVO CONSULTADO", submodalidade: "" } },
  { status: 404, ok: false, payload: { error: "Não encontrado", code: "NOT_FOUND" } },
];
it.each(ausencias)("preserva snapshot e data quando CSV retorna $status e histórico vazio", async resposta => {
  mocks.fetch.mockResolvedValue({ ...resposta, json: async () => resposta.payload });
  const container = await consultar();
  expect(mocks.buscar).toHaveBeenCalledWith("33000167000101"); expect(mocks.atualizar).not.toHaveBeenCalled();
  expect(container.textContent).toContain("ILIMITADA"); expect(container.textContent).toContain("HABILITADA");
  expect(container.textContent).toContain(fmtDateTime(dataOriginal)); expect(container.textContent).toContain("salva anteriormente");
});
it.each(["erro", "exceção"])("preserva snapshot e data se histórico falhar por %s", async modo => {
  mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ausencias[0].payload });
  if (modo === "erro") mocks.buscar.mockResolvedValue({ error: "Indisponível", data: null });
  else mocks.buscar.mockRejectedValue(new Error("timeout"));
  const container = await consultar();
  expect(container.textContent).toContain("ILIMITADA"); expect(container.textContent).toContain(fmtDateTime(dataOriginal));
  expect(container.textContent).toContain("histórico adicional"); expect(mocks.atualizar).not.toHaveBeenCalled();
});
it.each(ausencias)("exibe histórico com data de origem sem gravar nem carimbar agora ($status)", async resposta => {
  mocks.fetch.mockResolvedValue({ ...resposta, json: async () => resposta.payload });
  const historica = "2026-09-10T15:00:00Z";
  mocks.buscar.mockResolvedValue({ data: { situacao: "HABILITADA", submodalidade: "LIMITADA", consultadoEmHistorico: historica, fonteHistorica: "legado" } });
  const container = await consultar(false);
  expect(container.textContent).toContain("LIMITADA"); expect(container.textContent).toContain(fmtDateTime(historica));
  expect(mocks.atualizar).not.toHaveBeenCalled();
});
it("mantém snapshot na falha de rede sem gravar", async () => {
  mocks.fetch.mockRejectedValue(new Error("offline")); const container = await consultar();
  expect(container.textContent).toContain("ILIMITADA"); expect(container.textContent).toContain("dados salvos foram preservados");
  expect(container.textContent).toContain(fmtDateTime(dataOriginal)); expect(mocks.atualizar).not.toHaveBeenCalled();
});
it("mantém snapshot em erro HTTP com resposta JSON sem gravar", async () => {
  mocks.fetch.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "Indisponível", code: "UPSTREAM_UNAVAILABLE" }) });
  const container = await consultar();
  expect(container.textContent).toContain("ILIMITADA"); expect(container.textContent).toContain("dados salvos foram preservados");
  expect(container.textContent).toContain(fmtDateTime(dataOriginal)); expect(mocks.atualizar).not.toHaveBeenCalled();
});
it("complementa histórico parcial sem apagar situação já conhecida", async () => {
  mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ausencias[0].payload });
  mocks.buscar.mockResolvedValue({ data: { submodalidade: "LIMITADA", consultadoEmHistorico: dataOriginal, fonteHistorica: "legado" } });
  const container = await consultar();
  expect(container.textContent).toContain("HABILITADA"); expect(container.textContent).toContain("LIMITADA");
  expect(mocks.atualizar).not.toHaveBeenCalled();
});
it("persiste resposta confirmada e não consulta histórico", async () => {
  mocks.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ situacao: "NÃO HABILITADA", submodalidade: "" }) });
  const container = await consultar();
  expect(container.textContent).toContain("NÃO HABILITADA"); expect(mocks.atualizar).toHaveBeenCalledTimes(1);
  expect(mocks.buscar).not.toHaveBeenCalled();
});
