// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ler: vi.fn(), salvar: vi.fn() }));
vi.mock("@/actions/bpm/AcessosPipeline", () => ({ LerAcessosPipelineBpm: m.ler, SalvarAcessosPipelineBpm: m.salvar }));
import { AcessosPipelineSection } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AcessosPipelineSection";

const pipelineId = "clw000000000000000pipeline";
const outroPipelineId = "clw00000000000000pipeline2";
const config = { versao: 2, regras: [], setores: [{ id: 3, nome: "Comercial" }], usuarios: [{ id: 7, nome: "Maria" }], acessoAnteriorAberto: false };
let root: Root;
let container: HTMLDivElement;
const onPublished = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  m.ler.mockResolvedValue({ success: true, data: config });
  m.salvar.mockResolvedValue({ success: true, versao: 3 });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render(props = {}) {
  await act(async () => root.render(h(AcessosPipelineSection, { pipelineId, pipelineNome: "Comercial", onPublished, ...props })));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
}
function selectLabel(text: string): HTMLSelectElement {
  const label = [...container.querySelectorAll("label")].find((l) => l.querySelector("span")?.textContent === text);
  const select = label?.querySelector("select");
  expect(select).toBeTruthy(); return select!;
}
async function change(select: HTMLSelectElement, value: string) {
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  expect(button).toBeTruthy();
  await act(async () => { button!.click(); await new Promise((resolve) => setTimeout(resolve, 25)); });
}

it("libera setor no funil com nível administrativo e publica pela versão carregada", async () => {
  await render();
  await change(selectLabel("Setor"), "3");
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await click("Liberar acesso");
  expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId, versao: 2, regras: [{ tipo: "SETOR", id: 3, nivel: "ADMINISTRATIVO" }] });
  expect(onPublished).toHaveBeenCalledOnce();
  expect(container.textContent).toContain("Acessos de Comercial salvos.");
  expect(container.querySelector('select[aria-label="Nível de acesso de Comercial"]')).toBeTruthy();
});

it("preserva usuário e nível ao escolher outro funil e autoriza individualmente", async () => {
  await render({ pipelineId: undefined, pipelineNome: undefined, pipelines: [{ id: pipelineId, nome: "Comercial" }, { id: outroPipelineId, nome: "Operacional" }] });
  await change(selectLabel("Liberar para"), "USUARIO");
  await change(selectLabel("Usuário"), "7");
  await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await change(selectLabel("Funil"), outroPipelineId);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
  expect(selectLabel("Usuário").value).toBe("7");
  expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
  await click("Liberar acesso");
  expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId: outroPipelineId, versao: 2, regras: [{ tipo: "USUARIO", id: 7, nivel: "ADMINISTRATIVO" }] });
});

it("rebaixa e remove concessão usando a versão retornada por cada publicação", async () => {
  m.ler.mockResolvedValue({ success: true, data: { ...config, regras: [{ tipo: "USUARIO", id: 7, nivel: "ADMINISTRATIVO" }] } });
  await render();
  await change(container.querySelector<HTMLSelectElement>('select[aria-label="Nível de acesso de Maria"]')!, "PADRAO");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 25)); });
  expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId, versao: 2, regras: [{ tipo: "USUARIO", id: 7, nivel: "PADRAO" }] });
  await act(async () => { container.querySelector<HTMLButtonElement>('button[aria-label="Remover acesso de Maria"]')!.click(); await new Promise((resolve) => setTimeout(resolve, 25)); });
  expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId, versao: 3, regras: [] });
  expect(container.textContent).toContain("Nenhum setor ou usuário na lista");
});

it("permite fechar lista vazia explicitamente sem conceder acesso temporário", async () => {
  await render(); await click("Restringir a administradores");
  expect(m.salvar).toHaveBeenCalledExactlyOnceWith({ pipelineId, versao: 2, regras: [] });
});

it("apresenta conflito sem substituir concessões e recarrega antes de novo salvamento", async () => {
  m.salvar.mockResolvedValue({ success: false, error: "A configuração mudou. Recarregue antes de salvar." });
  await render(); await change(selectLabel("Setor"), "3"); await click("Liberar acesso");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("A configuração mudou");
  expect(onPublished).not.toHaveBeenCalled();
  m.ler.mockResolvedValue({ success: true, data: { ...config, versao: 9 } });
  await click("Recarregar acessos");
  m.salvar.mockResolvedValue({ success: true, versao: 10 });
  await click("Liberar acesso");
  expect(m.salvar).toHaveBeenLastCalledWith({ pipelineId, versao: 9, regras: [{ tipo: "SETOR", id: 3, nivel: "PADRAO" }] });
});

it("mostra erro recuperável de carregamento e respeita bloqueio do rascunho principal", async () => {
  m.ler.mockResolvedValueOnce({ success: false, error: "Não foi possível carregar os acessos." });
  await render();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Não foi possível carregar");
  await click("Recarregar acessos");
  expect(container.textContent).toContain("Nenhum setor ou usuário na lista");
  await render({ publicationBlocked: true });
  expect(container.querySelector("fieldset")?.disabled).toBe(true);
  expect(container.textContent).toContain("Publique ou descarte o rascunho principal");
  expect(m.salvar).not.toHaveBeenCalled();
});

it("informa acesso anterior aberto e o encerra ao salvar lista vazia", async () => {
  m.ler.mockResolvedValue({ success: true, data: { ...config, acessoAnteriorAberto: true } });
  await render();
  expect(container.textContent).toContain("ainda está aberto a todos");
  await click("Restringir a administradores");
  expect(m.salvar).toHaveBeenCalledExactlyOnceWith({ pipelineId, versao: 2, regras: [] });
  expect(container.textContent).not.toContain("ainda está aberto a todos");
});
