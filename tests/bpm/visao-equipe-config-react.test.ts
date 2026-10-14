// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ler: vi.fn(), salvar: vi.fn() }));
vi.mock("@/actions/bpm/VisibilidadePipeline", () => ({ LerVisibilidadePipelineBpm: m.ler, SalvarVisibilidadePipelineBpm: m.salvar }));
import { VisibilidadePipelineSection } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection";
it("configura supervisor e setores, publica e restaura a escolha ao reabrir", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const data = { versao: 2, setorIds: [], setores: [{ id: 3, nome: "Comercial" }, { id: 4, nome: "Financeiro" }], usuarios: [{ id: 7, nome: "Líder da equipe" }], visualizacao: { version: 1, supervisores: [] as { usuarioId: number; setorIds: number[] }[] } };
  m.ler.mockResolvedValue({ success: true, data }); m.salvar.mockResolvedValue({ success: true, versao: 3 });
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container); const onPublished = vi.fn();
  const props = { pipelineId: "clw000000000000000pipeline", publicationBlocked: false, onPublished };
  try {
    await act(async () => root.render(h(VisibilidadePipelineSection, props)));
    await act(async () => { const select = container.querySelector("select")!; select.value = "7"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent === "Adicionar supervisor")!.click(); });
    await act(async () => { container.querySelector<HTMLInputElement>('fieldset input[type="checkbox"]')!.click(); });
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent === "Publicar visibilidade do pipeline")!.click(); });
    expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId: props.pipelineId, versao: 2, setorIds: [], visualizacao: { version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }] } });
    expect(onPublished).toHaveBeenCalledOnce(); expect(container.textContent).toContain("Visibilidade do pipeline publicada.");
    await act(async () => root.unmount());
    m.ler.mockResolvedValue({ success: true, data: { ...data, versao: 3, visualizacao: { version: 1, supervisores: [{ usuarioId: 7, setorIds: [3] }] } } });
    root = createRoot(container); await act(async () => root.render(h(VisibilidadePipelineSection, props)));
    expect(container.querySelector('legend')?.textContent).toBe("Líder da equipe");
    const checks = container.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]'); expect(checks[0].checked).toBe(true); expect(checks[1].checked).toBe(false);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
