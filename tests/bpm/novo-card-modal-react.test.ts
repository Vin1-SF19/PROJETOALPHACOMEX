// @vitest-environment happy-dom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NovoCardModal from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal";

vi.mock("@/actions/bpm/Cards", () => ({
  BuscarEmpresasBpm: vi.fn(async () => ({ success: true, data: [] })),
  ListarUsuariosResponsavelBpm: vi.fn(async () => ({ success: true, data: [{ id: 1, nome: "Responsável" }] })),
}));

let root: Root;
let container: HTMLDivElement;
let fetchAnterior: typeof fetch;

function editar(label: string, valor: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  fetchAnterior = globalThis.fetch;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(NovoCardModal, {
    pipelineId: "pipeline", etapaId: "etapa", etapaNome: "Novo Lead", currentUserId: 1, accent: "1,2,3",
    onClose: vi.fn(), onCriado: vi.fn(async () => ({ success: true as const })),
  })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  globalThis.fetch = fetchAnterior;
});

it("não sobrescreve a razão social editada após iniciar a busca de CNPJ", async () => {
  let responder!: (value: Response) => void;
  globalThis.fetch = vi.fn(() => new Promise<Response>((resolve) => { responder = resolve; })) as typeof fetch;

  await act(async () => editar("CNPJ", "12345678000195"));
  expect(globalThis.fetch).toHaveBeenCalledOnce();
  await act(async () => editar("Razão social", "Nome digitado"));
  await act(async () => responder({
    ok: true,
    json: async () => ({ razaoSocial: "Nome antigo", nomeFantasia: "Outro nome", uf: "SP", municipio: "São Paulo" }),
  } as Response));

  expect(document.querySelector<HTMLInputElement>('input[aria-label="Razão social"]')?.value).toBe("Nome digitado");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Nome fantasia"]')?.value).toBe("");
});

it("mostra o nome configurado da etapa no cadastro", () => {
  expect(container.textContent).toContain("Novo Lead");
});
