// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ consulta: vi.fn(), pdf: vi.fn(), blob: vi.fn() }));
vi.mock("@/actions/PreAnalise", () => ({ upsertConsulta: api.consulta }));
vi.mock("@react-pdf/renderer", () => ({ pdf: api.pdf }));
vi.mock("@/components/GerarFicha", () => ({ FichaAlphaPDF: () => null }));
import { ModalPDF } from "@/components/ModalPdf";

let root: Root, host: HTMLDivElement;
const dados = { rfb: { dados: { cnpj: "123", razaoSocial: "Empresa da ficha" } } };
const iniciais = { nomeResponsavel: "Sheila", telefone: "48999990000", email: "contato@example.test", dataSituacao: "23/10/2026", horaSituacao: "09:00", mesProtocolo: "Outubro", origemLead: "Instagram", origemLeadDetalhe: "Campanha", observacoes: "Salvo" };
beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks(); api.blob.mockResolvedValue(new Blob(["PDF"], { type: "application/pdf" })); api.pdf.mockReturnValue({ toBlob: api.blob });
  api.consulta.mockResolvedValue({ success: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
async function render(props: Partial<React.ComponentProps<typeof ModalPDF>> = {}) {
  await act(async () => root.render(h(ModalPDF, { dados, radarDados: {}, user: "TI", isOpen: true, onClose: vi.fn(), modo: "complementar", dadosManuaisIniciais: iniciais, ...props })));
}
function input(label: string) { return document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; }
async function alterar(label: string, value: string) {
  await act(async () => {
    const el = input(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function salvar() { await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await Promise.resolve(); }); }
it("prefill completo preserva origem capitalizada e Fechar descarta somente rascunho", async () => {
  const close = vi.fn(), save = vi.fn();
  await render({ onClose: close, onSalvar: save });
  expect(input("Nome do Responsável").value).toBe("Sheila");
  expect(input("Telefone").value).toBe(iniciais.telefone);
  expect([...document.querySelectorAll("button")].find(b => b.textContent === "Instagram")?.getAttribute("aria-pressed")).toBe("true");
  await alterar("Nome do Responsável", "Rascunho");
  await act(async () => [...document.querySelectorAll("button")].find(b => b.textContent === "Fechar")!.click());
  expect(close).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled(); expect(api.consulta).not.toHaveBeenCalled();
  await render({ isOpen: false }); await render();
  expect(input("Nome do Responsável").value).toBe("Sheila");
  expect(api.pdf).not.toHaveBeenCalled();
});
it("Salva uma vez, mantém erro e rascunho em conflito e fecha somente após confirmação", async () => {
  let reject!: (reason: Error) => void;
  const save = vi.fn<(extras: NonNullable<React.ComponentProps<typeof ModalPDF>["dadosManuaisIniciais"]>) => Promise<void>>(() => new Promise<void>((_, no) => { reject = no; })), close = vi.fn();
  await render({ onSalvar: save, onClose: close }); await alterar("Nome do Responsável", "Complementado");
  await salvar(); await salvar();
  expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0][0]).toMatchObject({ ...iniciais, nomeResponsavel: "Complementado" });
  expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  expect(close).not.toHaveBeenCalled();
  await act(async () => reject(new Error("A ficha foi atualizada por outra pessoa. Reabra para conferir.")));
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("outra pessoa");
  expect(input("Nome do Responsável").value).toBe("Complementado"); expect(close).not.toHaveBeenCalled();
  save.mockImplementation(() => Promise.resolve()); await salvar();
  expect(close).toHaveBeenCalledOnce(); expect(api.consulta).not.toHaveBeenCalled(); expect(api.pdf).not.toHaveBeenCalled();
});
it("modo padrão continua usando consulta, modelo pre-analise e visualização PDF", async () => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  const createURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture");
  await render({ modo: "gerar", dadosManuaisIniciais: undefined });
  expect(input("Mês de Protocolo")).not.toBeNull();
  await alterar("Nome do Responsável", "Pré-Análise"); await salvar();
  expect(api.consulta).toHaveBeenCalledOnce(); expect(api.consulta.mock.calls[0][0].extra.nomeResponsavel).toBe("Pré-Análise");
  const doc = api.pdf.mock.calls[0][0]; expect(doc.props.finalidade).toBe("pre-analise"); expect(doc.props.dados.viabilidade).toBeUndefined();
  expect(open).toHaveBeenCalledWith("blob:fixture", "_blank"); expect(createURL).toHaveBeenCalled();
});
it("complemento usa só mês e não regrava a data legada quando outro campo é editado", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  await render({ dadosManuaisIniciais: { ...iniciais, mesProtocolo: "2026-10-31" }, onSalvar: save });
  const select = document.querySelector<HTMLSelectElement>('select[aria-label="Mês de Protocolo"]')!;
  expect(select.value).toBe("Outubro"); expect(select.options).toHaveLength(13);
  await alterar("Nome do Responsável", "Complementado"); await salvar();
  expect(save.mock.calls[0][0].mesProtocolo).toBe("2026-10-31");
  await act(async () => { select.value = "Março"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await salvar();
  expect(save.mock.calls[1][0].mesProtocolo).toBe("Março");
  expect(api.consulta).not.toHaveBeenCalled();
});
it("mantém uma origem de cadastro fora da grade original visível e sem substituir seu valor", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  await render({ dadosManuaisIniciais: { ...iniciais, origemLead: "Site" }, onSalvar: save });
  expect([...document.querySelectorAll("button")].find(b => b.textContent === "Site")?.getAttribute("aria-pressed")).toBe("true");
  expect(input("Complemento da origem").value).toBe("Campanha"); await salvar();
  expect(save.mock.calls[0][0].origemLead).toBe("Site");
});
