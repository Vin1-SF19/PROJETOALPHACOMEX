// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ obter: vi.fn(), salvar: vi.fn(), consulta: vi.fn() }));
vi.mock("@/actions/bpm/FichaViabilidade", () => ({ ObterFichaViabilidadeBpm: api.obter, SalvarComplementoFichaViabilidadeBpm: api.salvar }));
vi.mock("@/actions/PreAnalise", () => ({ upsertConsulta: api.consulta }));
vi.mock("@react-pdf/renderer", () => ({ pdf: vi.fn() }));
vi.mock("@/components/GerarFicha", () => ({ FichaAlphaPDF: () => null }));
import { AnexosComFichaCard } from "@/components/bpm/anexos/AnexosComFichaCard";
import type { FichaViabilidadeDTO } from "@/lib/bpm/ficha-viabilidade-documento";
let root: Root, host: HTMLDivElement, atual: FichaViabilidadeDTO;
const anexos = [{ id: "outro", nome: "Outro.pdf", tamanho: 12, tipo: "application/pdf" }, { id: "ficha", nome: "Ficha.pdf", tamanho: 42, tipo: "application/pdf" }];
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  atual = { anexoId: "ficha", empresaId: 1, empresaNome: "Empresa A", userLogado: "TI", revision: 1, dados: { rfb: { dados: { razaoSocial: "Empresa A", cnpj: "123" } }, extra: { nomeResponsavel: "Sheila", origemLead: "Site" } } };
  api.obter.mockImplementation(() => Promise.resolve({ success: true, estado: "PRONTA", data: atual, gerada: false, solicitacaoId: null }));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(podeEditar = true, onAbrir = vi.fn(), onAtualizado = vi.fn()) {
  await act(async () => { root.render(h(AnexosComFichaCard, { cardId: "card-ficha", anexos, consultarFicha: true, podeEditar, podeExcluir: false, realtimeRevision: 1, onAbrir, onExcluir: vi.fn(), onAtualizado })); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
const botao = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label)!;
async function complementar() { await act(async () => { botao("Complementar Ficha").click(); }); await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); }); }
async function alterarNome(value: string) {
  await act(async () => { const input = document.querySelector<HTMLInputElement>('[aria-label="Nome do Responsável"]')!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
it("botão pertence ao anexo identificado, abre o mesmo modal e salva/reabre o confirmado", async () => {
  const abrir = vi.fn(), atualizado = vi.fn();
  await render(true, abrir, atualizado);
  expect(botao("Complementar Ficha")).toBeTruthy();
  expect(botao("Complementar Ficha").parentElement?.textContent).toContain("Ficha.pdf");
  expect(botao("Complementar Ficha").parentElement?.textContent).not.toContain("Outro.pdf");
  expect(botao("Complementar Ficha").compareDocumentPosition(botao("Ficha.pdf")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async () => botao("Ficha.pdf").click()); expect(abrir).toHaveBeenCalledWith(anexos[1]);
  await complementar();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Complementar");
  expect(document.querySelector<HTMLInputElement>('[aria-label="Nome do Responsável"]')?.value).toBe("Sheila");
  await alterarNome("Complementado");
  api.salvar.mockImplementation(async ({ extras }: { extras: FichaViabilidadeDTO["dados"]["extra"] }) => {
    atual = { ...atual, revision: 2, dados: { ...atual.dados, extra: extras } }; return { success: true, data: atual };
  });
  await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(api.salvar).toHaveBeenCalledExactlyOnceWith({ cardId: "card-ficha", expectedRevision: 1, extras: expect.objectContaining({ nomeResponsavel: "Complementado", origemLead: "Site" }) });
  expect(atualizado).toHaveBeenCalledOnce(); expect(document.querySelector('[role="dialog"]')).toBeNull();
  await complementar(); expect(document.querySelector<HTMLInputElement>('[aria-label="Nome do Responsável"]')?.value).toBe("Complementado");
  await alterarNome("Não salvo"); await act(async () => botao("Fechar").click()); await complementar();
  expect(document.querySelector<HTMLInputElement>('[aria-label="Nome do Responsável"]')?.value).toBe("Complementado");
  expect(api.salvar).toHaveBeenCalledOnce(); expect(api.consulta).not.toHaveBeenCalled();
});
it("somente leitura continua abrindo PDF sem apresentar a ação de complementar", async () => {
  const abrir = vi.fn(); await render(false, abrir);
  expect(botao("Complementar Ficha")).toBeUndefined();
  await act(async () => botao("Ficha.pdf").click()); expect(abrir).toHaveBeenCalledWith(anexos[1]);
});
it("erro de leitura de metadados não esconde anexos e oferece retentativa", async () => {
  api.obter.mockResolvedValue({ success: false, error: "Indisponível" }); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Tentar novamente");
  expect(botao("Ficha.pdf")).toBeTruthy(); expect(botao("Complementar Ficha")).toBeUndefined();
  api.obter.mockResolvedValue({ success: true, estado: "PRONTA", data: atual, gerada: false, solicitacaoId: null });
  await act(async () => { botao("Tentar novamente").click(); await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(botao("Complementar Ficha")).toBeTruthy();
});
