// @vitest-environment happy-dom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NovoCardModal from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal";

const buscarPorCnpj = vi.hoisted(() => vi.fn());
const onCriado = vi.fn();

vi.mock("@/actions/bpm/Cards", () => ({
  BuscarEmpresaPorCnpjBpm: buscarPorCnpj,
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
  buscarPorCnpj.mockReset().mockResolvedValue({ success: true, data: null });
  onCriado.mockReset().mockResolvedValue({ success: true });
  fetchAnterior = globalThis.fetch;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(NovoCardModal, {
    pipelineId: "pipeline", etapaId: "etapa", etapaNome: "Novo Lead", currentUserId: 1, accent: "1,2,3",
    onClose: vi.fn(), onCriado,
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

it("vincula empresa existente automaticamente pelo CNPJ, sem consulta externa", async () => {
  const fetchMock = vi.fn();
  globalThis.fetch = fetchMock as typeof fetch;
  buscarPorCnpj.mockResolvedValueOnce({
    success: true,
    data: { id: 42, cnpj: "12.345.678/0001-90", razaoSocial: "Empresa Cadastrada", nomeFantasia: "Fantasia", uf: "SP", municipio: "São Paulo" },
  });

  await act(async () => editar("CNPJ", "12345678000190"));

  expect(buscarPorCnpj).toHaveBeenCalledWith("12345678000190");
  expect(container.textContent).toContain("Empresa encontrada pelo CNPJ e vinculada automaticamente.");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Razão social"]')?.value).toBe("Empresa Cadastrada");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Nome fantasia"]')?.value).toBe("Fantasia");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Município"]')?.value).toBe("São Paulo");
  expect(fetchMock).not.toHaveBeenCalled();

  await act(async () => {
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Criar Card")?.click();
  });
  expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 42 }));
});

it("ignora resposta antiga quando o CNPJ muda durante a consulta", async () => {
  let responder!: (value: unknown) => void;
  buscarPorCnpj.mockImplementationOnce(() => new Promise((resolve) => { responder = resolve; }));

  await act(async () => editar("CNPJ", "12345678000190"));
  await act(async () => editar("CNPJ", "123"));
  await act(async () => responder({ success: true, data: { id: 42, cnpj: "12345678000190", razaoSocial: "Empresa antiga", nomeFantasia: null, uf: null, municipio: null } }));

  expect(container.textContent).not.toContain("Empresa encontrada pelo CNPJ");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Razão social"]')?.value).toBe("");
});
