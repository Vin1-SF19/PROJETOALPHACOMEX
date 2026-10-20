// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ler: vi.fn(), salvar: vi.fn() }));
vi.mock("@/actions/bpm/VisibilidadePipeline", () => ({ LerVisibilidadePipelineBpm: m.ler, SalvarVisibilidadePipelineBpm: m.salvar }));
import { VisibilidadePipelineSection } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/VisibilidadePipelineSection";
it("publica setores e autorização individual sem alterar supervisão legada", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  const legado = { version: 1, supervisores: [{ usuarioId: 7, setorIds: [4] }] };
  const data = { versao: 2, setorIds: [], setores: [{ id: 3, nome: "Comercial" }, { id: 4, nome: "Financeiro" }], usuarios: [{ id: 7, nome: "Líder da equipe" }], visualizacao: legado };
  m.ler.mockResolvedValue({ success: true, data }); m.salvar.mockResolvedValue({ success: true, versao: 3 });
  const container = document.createElement("div"); document.body.append(container); let root = createRoot(container); const onPublished = vi.fn();
  const props = { pipelineId: "clw000000000000000pipeline", publicationBlocked: false, onPublished };
  try {
    await act(async () => root.render(h(VisibilidadePipelineSection, props)));
    expect(container.querySelector('select[aria-label="Usuário para autorizar"]')).not.toBeNull();
    expect(container.textContent).toContain("Quem tem acesso ao pipeline pode consultar os cards dos colegas");
    expect(container.textContent).toContain("somente leitura");
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Usuário para autorizar"]')!;
    await act(async () => { select.value = "7"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent === "Autorizar usuário")!.click(); });
    expect(container.textContent).toContain("Líder da equipe");
    await act(async () => { container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); });
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent === "Publicar visibilidade do pipeline")!.click(); });
    expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId: props.pipelineId, versao: 2, setorIds: [3], usuariosAutorizados: [7] });
    expect(data.visualizacao).toEqual(legado);
    expect(onPublished).toHaveBeenCalledOnce(); expect(container.textContent).toContain("Visibilidade do pipeline publicada.");
    await act(async () => root.unmount());
    m.ler.mockResolvedValue({ success: true, data: { ...data, versao: 3, setorIds: [3] } });
    root = createRoot(container); await act(async () => root.render(h(VisibilidadePipelineSection, props)));
    const checks = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'); expect(checks[0].checked).toBe(true); expect(checks[1].checked).toBe(false);
    expect(container.querySelector('legend')?.textContent).toBe('Usuários autorizados individualmente');
  } finally { await act(async () => root.unmount()); container.remove(); }
});
it("carrega autorizações existentes, remove pessoa e respeita bloqueio de publicação", async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  m.ler.mockResolvedValue({ success: true, data: { versao: 3, setorIds: [4], setores: [{ id: 4, nome: "Financeiro" }], usuarios: [{ id: 7, nome: "Pessoa de outro setor" }], usuariosAutorizados: [7] } });
  m.salvar.mockResolvedValue({ success: true, versao: 4 });
  const container = document.createElement("div"); document.body.append(container); const root = createRoot(container);
  const props = { pipelineId: "clw000000000000000pipeline", publicationBlocked: false, onPublished: vi.fn() };
  try {
    await act(async () => root.render(h(VisibilidadePipelineSection, props)));
    expect(container.textContent).toContain("Pessoa de outro setor");
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Remover autorização de Pessoa de outro setor"]')!.click());
    await act(async () => [...container.querySelectorAll("button")].find((b) => b.textContent === "Publicar visibilidade do pipeline")!.click());
    expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId: props.pipelineId, versao: 3, setorIds: [4], usuariosAutorizados: [] });
    await act(async () => root.render(h(VisibilidadePipelineSection, { ...props, publicationBlocked: true })));
    expect(container.querySelector("fieldset")!.disabled).toBe(true);
    expect([...container.querySelectorAll("button")].find((b) => b.textContent === "Publicar visibilidade do pipeline")!.disabled).toBe(true);
  } finally { await act(async () => root.unmount()); container.remove(); }
});
