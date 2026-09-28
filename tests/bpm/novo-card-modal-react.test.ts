// @vitest-environment happy-dom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NovoCardModal from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal";

const buscarPorCnpj = vi.hoisted(() => vi.fn());
const consultarDadosCnpj = vi.hoisted(() => vi.fn());
const onCriado = vi.fn();

vi.mock("@/actions/bpm/Cards", () => ({
  BuscarEmpresaPorCnpjBpm: buscarPorCnpj,
  BuscarEmpresasBpm: vi.fn(async () => ({ success: true, data: [] })),
  ListarUsuariosResponsavelBpm: vi.fn(async () => ({ success: true, data: [{ id: 1, nome: "Responsável" }] })),
}));
vi.mock("@/actions/bpm/CardsConsultas", () => ({ ConsultarDadosCnpjNovoLeadBpm: consultarDadosCnpj }));

let root: Root;
let container: HTMLDivElement;
function editar(label: string, valor: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(async () => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  buscarPorCnpj.mockReset().mockResolvedValue({ success: true, data: null });
  consultarDadosCnpj.mockReset().mockResolvedValue({ success: true, data: { cadastro: null, falhas: [], radarSituacao: null } });
  onCriado.mockReset().mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(NovoCardModal, {
    pipelineId: "pipeline", etapaId: "etapa", etapaNome: "Novo Lead", currentUserId: 1, accent: "1,2,3",
    radarOpcoes: ["Revisão de Radar Ilimitado"],
    onClose: vi.fn(), onCriado,
  })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("não sobrescreve a razão social editada após iniciar a busca de CNPJ", async () => {
  let responder!: (value: unknown) => void;
  consultarDadosCnpj.mockImplementationOnce(() => new Promise((resolve) => { responder = resolve; }));

  await act(async () => editar("CNPJ", "11222333000181"));
  expect(consultarDadosCnpj).toHaveBeenCalledWith("pipeline", "11222333000181");
  await act(async () => editar("Razão social", "Nome digitado"));
  await act(async () => responder({ success: true, data: {
    cadastro: { razaoSocial: "Nome antigo", nomeFantasia: "Outro nome", uf: "SP", municipio: "São Paulo" },
    falhas: [], radarSituacao: null,
  } }));

  expect(document.querySelector<HTMLInputElement>('input[aria-label="Razão social"]')?.value).toBe("Nome digitado");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Nome fantasia"]')?.value).toBe("");
});

it("mostra o nome configurado da etapa no cadastro", () => {
  expect(container.textContent).toContain("Novo Lead");
});

it("vincula empresa existente automaticamente pelo CNPJ e enriquece os dados no servidor", async () => {
  buscarPorCnpj.mockResolvedValueOnce({
    success: true,
    data: { id: 42, cnpj: "11.222.333/0001-81", razaoSocial: "Empresa Cadastrada", nomeFantasia: "Fantasia", uf: "SP", municipio: "São Paulo" },
  });

  await act(async () => editar("CNPJ", "11222333000181"));

  expect(buscarPorCnpj).toHaveBeenCalledWith("11222333000181");
  expect(container.textContent).toContain("Empresa encontrada pelo CNPJ e vinculada automaticamente.");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Razão social"]')?.value).toBe("Empresa Cadastrada");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Nome fantasia"]')?.value).toBe("Fantasia");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Município"]')?.value).toBe("São Paulo");
  expect(consultarDadosCnpj).toHaveBeenCalledWith("pipeline", "11222333000181");

  await act(async () => {
    const select = document.querySelector<HTMLSelectElement>("#novo-card-radar")!;
    select.value = "Revisão de Radar Ilimitado";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await act(async () => {
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Criar Card")?.click();
  });
  expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 42 }));
});

it("ignora resposta antiga quando o CNPJ muda durante a consulta", async () => {
  let responder!: (value: unknown) => void;
  buscarPorCnpj.mockImplementationOnce(() => new Promise((resolve) => { responder = resolve; }));

  await act(async () => editar("CNPJ", "11222333000181"));
  await act(async () => editar("CNPJ", "123"));
  await act(async () => responder({ success: true, data: { id: 42, cnpj: "11222333000181", razaoSocial: "Empresa antiga", nomeFantasia: null, uf: null, municipio: null } }));

  expect(container.textContent).not.toContain("Empresa encontrada pelo CNPJ");
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Razão social"]')?.value).toBe("");
});

it("aguarda a consulta do CNPJ antes de criar o card, mesmo após edição manual", async () => {
  let responder!: (value: unknown) => void;
  consultarDadosCnpj.mockImplementationOnce(() => new Promise((resolve) => { responder = resolve; }));
  await act(async () => editar("CNPJ", "11222333000181"));
  await act(async () => editar("Razão social", "Nome digitado"));
  await act(async () => {
    const select = document.querySelector<HTMLSelectElement>("#novo-card-radar")!;
    select.value = "Revisão de Radar Ilimitado";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => {
    [...container.querySelectorAll("button")].find((button) => button.textContent === "Criar Card")?.click();
  });
  expect(onCriado).not.toHaveBeenCalled();
  await act(async () => responder({ success: true, data: { cadastro: null, falhas: [], radarSituacao: null } }));
  expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({
    novaEmpresa: expect.objectContaining({ cnpj: "11222333000181", razaoSocial: "Nome digitado" }),
  }));
});
