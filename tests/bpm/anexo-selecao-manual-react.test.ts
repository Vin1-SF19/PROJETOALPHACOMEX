// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSaveProvider, useCardSave } from "@/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext";
import { PainelCamposEtapaAtual } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";

vi.mock("@/actions/bpm/Cards", () => ({ AtualizarCardBpm: vi.fn(), ObterCardBpm: vi.fn() }));
vi.mock("@/actions/bpm/ConsultaCnpjFinanceiro", () => ({ ConsultarCnpjNovoContrato: vi.fn() }));
vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), dismiss: vi.fn() } }));
vi.mock("@/components/bpm/anexos/VisualizadorAnexoCard", () => ({ VisualizadorAnexoCard: () => null }));

const campo = {
  id: "campo-arquivo", nome: "Contrato assinado/anexo", tipo: "arquivo", valor: "",
  editavel: true, obrigatorio: false, pipelineId: "pipeline", etapaId: "etapa", ordem: 0, opcoesJson: null,
};
const card = {
  id: "card", updatedAt: "2026-09-29T10:00:00Z",
  etapa: { id: "etapa", nome: "Elaboração de contrato", chave: "elaboracao_contrato" },
  camposEtapa: [campo], anexos: [],
} as unknown as React.ComponentProps<typeof PainelCamposEtapaAtual>["card"];
let root: Root;
let container: HTMLDivElement;
let saveContext: ReturnType<typeof useCardSave>;
function Probe() {
  const context = useCardSave();
  React.useEffect(() => { saveContext = context; }, [context]);
  return null;
}
async function escolherArquivo(nome = "Ficha_Alpha.pdf") {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["%PDF-1.7\n%%EOF"], nome, { type: "application/pdf" });
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); });
  return input;
}

beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("substitui o seletor pelo arquivo escolhido e o X limpa o upload pendente do formulário", async () => {
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual, {
    card, campoIds: [campo.id], instanceKey: "form", accent: "1,2,3",
    podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));

  const input = await escolherArquivo();
  expect(input.classList.contains("sr-only")).toBe(true);
  expect(input.getAttribute("aria-hidden")).toBe("true");
  expect(container.textContent).toContain("Ficha_Alpha.pdf");
  expect(container.textContent).not.toContain("Nenhum arquivo escolhido");
  expect(saveContext.getPendingUpload("card:arquivo:campo-arquivo")?.nome).toBe("Ficha_Alpha.pdf");

  const remover = container.querySelector<HTMLButtonElement>('button[aria-label="Remover arquivo Ficha_Alpha.pdf"]')!;
  await act(async () => remover.click());
  expect(saveContext.getPendingUpload("card:arquivo:campo-arquivo")).toBeUndefined();
  expect(input.classList.contains("sr-only")).toBe(false);
  expect(container.querySelector('button[aria-label="Remover arquivo Ficha_Alpha.pdf"]')).toBeNull();
});

it("X remove apenas seleção pendente, sem excluir o anexo já vinculado", async () => {
  const onChange = vi.fn();
  const onFileRemoved = vi.fn();
  await act(async () => root.render(h(CampoBpmInput, {
    campo, value: "anexo-existente", onChange, onFileRemoved,
    arquivoAtual: { id: "anexo-existente", nome: "anterior.pdf", url: "/api/bpm/anexos/anexo-existente" },
    className: "input", cardId: "card", registerFileSave: vi.fn().mockResolvedValue(true),
  })));
  await escolherArquivo("novo.pdf");
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Remover arquivo novo.pdf"]')!.click());

  expect(onFileRemoved).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();
  expect(container.textContent).toContain("anterior.pdf");
});

it("editar URL cancela a seleção de arquivo exibida e a pendência de salvamento", async () => {
  const campoUrl = { ...campo, tipo: "url_ou_arquivo", nome: "Contrato ou link" };
  const cardUrl = { ...card, camposEtapa: [campoUrl] } as typeof card;
  await act(async () => root.render(h(CardSaveProvider, null, h(Probe), h(PainelCamposEtapaAtual, {
    card: cardUrl, campoIds: [campoUrl.id], instanceKey: "form", accent: "1,2,3",
    podeEditar: true, realtimeRevision: 0, onAtualizado: vi.fn(),
  }))));
  const input = await escolherArquivo("novo.pdf");
  expect(saveContext.getPendingUpload("card:arquivo:campo-arquivo")?.nome).toBe("novo.pdf");
  const url = container.querySelector<HTMLInputElement>('input[type="url"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(url, "https://example.com/contrato");
    url.dispatchEvent(new Event("input", { bubbles: true }));
    url.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(saveContext.getPendingUpload("card:arquivo:campo-arquivo")).toBeUndefined();
  expect(container.querySelector('button[aria-label="Remover arquivo novo.pdf"]')).toBeNull();
  expect(input.classList.contains("sr-only")).toBe(false);
});
