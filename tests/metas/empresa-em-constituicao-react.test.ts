// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  criar: vi.fn(), atualizar: vi.fn(), listar: vi.fn(), contratos: vi.fn(), buscar: vi.fn(), erro: vi.fn(),
}));
vi.mock("@/actions/ContratoComercial", () => ({
  criarContrato: mocks.criar,
  atualizarContrato: mocks.atualizar,
  listarClientesEmConstituicao: mocks.listar,
  buscarClienteParaContrato: mocks.buscar,
  getContratos: mocks.contratos,
  getColaboradoresComerciais: vi.fn(async () => ({ success: true, usuarios: [] })),
  getServicosComerciais: vi.fn(async () => ({ success: true, servicos: [] })),
  getProspeccoesAtivas: vi.fn(async () => ({ success: true, prospeccoes: [] })),
}));
vi.mock("@/actions/parceiros", () => ({ listarParceirosSimples: vi.fn(), buscarParceiroDetalheSimples: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.erro, success: vi.fn() } }));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, onClick }: React.HTMLAttributes<HTMLDivElement>) => h("div", { className, onClick }, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/comercial/ModalConfirmacaoFechamento", () => ({ default: () => null }));
import ModalGerenciamentoLeads from "@/components/comercial/ModalGerenciamentoLeads";

const contrato = {
  id: "cmuh4n69p00000agm844kax9s", clienteId: 42, cnpj: null, razaoSocial: "Empresa em abertura",
  nomeFantasia: null, valorContrato: 5000, formaPagamento: "INTEGRAL_PIX", servico: "Revisão RADAR 150K",
  canalAquisicao: "WhatsApp", closerNome: "Fulano", status: "ENVIADO", pagamentoConfirmado: false,
  pagamentoConfirmadoEm: null, contratoAssinado: false, contratoUrl: null, arquivado: false,
  arquivadoEm: null, mes: 10, ano: 2026, usuarioId: 7,
  usuario: { id: 7, nome: "Fulano", imagemUrl: null }, socios: [], observacoes: [], createdAt: "2026-10-19",
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  mocks.contratos.mockResolvedValue({ success: true, enviados: [], fechados: [], arquivados: [] });
  mocks.criar.mockResolvedValue({ success: true });
  mocks.atualizar.mockResolvedValue({ success: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function abrir() {
  await act(async () => root.render(h(ModalGerenciamentoLeads, {
    role: "COMERCIAL", nomeUsuario: "Fulano", onFechar: vi.fn(),
  })));
}
async function clicar(texto: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === texto);
  expect(button, texto).toBeDefined();
  await act(async () => button!.click());
}
function blocoEmpresa() {
  return [...container.querySelectorAll("p")].find((p) => p.textContent?.includes("1 · Empresa"))!.parentElement!.parentElement!;
}

describe("cadastro de empresa em constituição no Metas", () => {
  it("abre o cadastro direto, mantém validações comerciais e permite enviar sem selecionar empresa", async () => {
    await abrir();
    await clicar("Novo Cliente");
    await clicar("Empresa em Constituição");
    expect(blocoEmpresa().querySelector("select")).toBeNull();
    expect(blocoEmpresa().querySelector("input")?.value).toBe("Em constituição");
    expect(blocoEmpresa().textContent).not.toContain("BPM");
    await clicar("Contrato Enviado");
    expect(mocks.erro).toHaveBeenLastCalledWith("Informe o valor do contrato");
    expect(mocks.criar).not.toHaveBeenCalled();

    const valor = container.querySelector<HTMLInputElement>('input[placeholder="0,00"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(valor, "500000");
      valor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await clicar("SELECIONAR");
    await clicar("Integral na contratação - 10% OFF (Pix)");
    await clicar("SELECIONAR SERVIÇO");
    const servico = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("150"))!;
    await act(async () => servico.click());
    const canal = [...container.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "WhatsApp"))!;
    await act(async () => { canal.value = "WhatsApp"; canal.dispatchEvent(new Event("change", { bubbles: true })); });
    await clicar("Contrato Enviado");
    expect(mocks.criar).toHaveBeenCalledOnce();
    expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ empresaEmConstituicao: true, valorContrato: 5000 }));
    const payload = mocks.criar.mock.calls[0][0];
    expect(payload).not.toHaveProperty("cnpj");
    expect(payload).not.toHaveProperty("clienteId");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.buscar).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("volta a exigir consulta de CNPJ quando a opção é desmarcada", async () => {
    await abrir();
    await clicar("Novo Cliente");
    await clicar("Empresa em Constituição");
    await clicar("Empresa em Constituição");
    expect(container.querySelector<HTMLInputElement>('input[placeholder="00.000.000/0000-00"]')?.value).toBe("");
    await clicar("Contrato Enviado");
    expect(mocks.erro).toHaveBeenLastCalledWith("Consulte o CNPJ primeiro");
    expect(mocks.criar).not.toHaveBeenCalled();
  });

  it("edita sem lista e mantém o cliente original após desmarcar e remarcar", async () => {
    mocks.contratos.mockResolvedValue({ success: true, enviados: [contrato], fechados: [], arquivados: [] });
    await abrir();
    await act(async () => container.querySelector<HTMLButtonElement>('button[title="Editar lead"]')!.click());
    expect(blocoEmpresa().querySelector("select")).toBeNull();
    expect(blocoEmpresa().querySelector("input")?.value).toBe("Empresa em abertura");
    await clicar("Empresa em Constituição");
    await clicar("Empresa em Constituição");
    await clicar("Salvar Alterações");
    expect(mocks.atualizar).toHaveBeenCalledWith(expect.objectContaining({ id: contrato.id, clienteId: 42 }));
    expect(mocks.atualizar.mock.calls[0][0]).not.toHaveProperty("empresaEmConstituicao");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.criar).not.toHaveBeenCalled();
  });
});
