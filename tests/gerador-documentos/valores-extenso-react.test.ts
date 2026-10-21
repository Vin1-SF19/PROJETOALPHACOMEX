// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GerarDocumentoForm } from "@/components/GeradorDocumentos/GerarDocumentoForm";
import { ConferenciaClient } from "@/components/GeradorDocumentos/ConferenciaClient";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";
import { VARIAVEIS_CONTRATO_PADRAO } from "@/lib/gerador-documentos/contrato-padrao";

const mocks = vi.hoisted(() => ({ gerar: vi.fn(), atualizar: vi.fn(), buscar: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => h("span", null, children) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/actions/gerador-documentos", () => ({ GerarDocumento: mocks.gerar, AtualizarVariaveisContratoPadrao: mocks.atualizar, BuscarClientesParaContratante: mocks.buscar }));
vi.mock("@/actions/empresas-contratadas", () => ({ ListarEmpresasContratadas: vi.fn().mockResolvedValue({ success: true, data: [] }) }));
vi.mock("@/components/GeradorDocumentos/ModalNovaEmpresaContratada", () => ({ ModalNovaEmpresaContratada: () => null }));

let container: HTMLDivElement;
let root: Root;
const defs = VARIAVEIS_CONTRATO_PADRAO.filter((item) => /^(valor_|desconto_)/.test(item.nome));
const iniciais = { valor_total: "1.01", valor_total_extenso: "errado", valor_inicial: "2", valor_final: "3", desconto_valor: "0" };
function input(nome: string) {
  return container.querySelector<HTMLInputElement>(`#var-${nome}`) ?? [...container.querySelectorAll("label")].find((label) => label.textContent?.startsWith(defs.find((item) => item.nome === nome)!.label))!.querySelector("input")!;
}
async function digitar(campo: HTMLInputElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function botao(texto: string) { return [...container.querySelectorAll("button")].find((item) => item.textContent === texto)!; }
const documento = { id: "clx0000000000000000000000", titulo: "Contrato", status: "CONFERENCIA", finalizadoEm: null, pdfDisponivel: true, template: { titulo: "Modelo" }, variaveisJson: iniciais, variaveisDefinicoes: defs, clausulas: [] };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

describe("preenchimento automático no fluxo real", () => {
  it("deriva iniciais, acompanha quatro pares, limpa e envia o mesmo extenso ao gerar", async () => {
    vi.useFakeTimers();
    mocks.buscar.mockResolvedValue({ success: true, data: [{ id: 1, razaoSocial: "Cliente Exemplo", nomeFantasia: null, cnpj: null }] });
    mocks.gerar.mockResolvedValue({ success: true, pdfDisponivel: true, urlConferencia: "/conferencia" });
    await act(async () => root.render(h(GerarDocumentoForm, { template: { id: CONTRATO_PADRAO_ID, titulo: "Modelo", variaveis: defs, valoresIniciais: iniciais } })));
    expect(input("valor_total_extenso").value).toBe("um real e um centavo");
    expect(input("valor_total_extenso").readOnly).toBe(true);
    expect(input("valor_total").step).toBe("0.01");
    for (const [fonte, destino] of [["valor_total", "valor_total_extenso"], ["valor_inicial", "valor_inicial_extenso"], ["valor_final", "valor_final_extenso"], ["desconto_valor", "desconto_extenso"]]) {
      await digitar(input(fonte), "2.02");
      expect(input(destino).value).toBe("dois reais e dois centavos");
    }
    await digitar(input("valor_total"), ""); expect(input("valor_total_extenso").value).toBe("");
    await digitar(input("valor_total"), "10.50");
    await digitar(input("desconto_valor"), "1.234,56");
    expect(input("desconto_extenso").value).toContain("trinta e quatro reais e cinquenta e seis centavos");
    await digitar(container.querySelector("#busca-contratante")!, "Cliente");
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => botao("Cliente Exemplo").click());
    await act(async () => botao("Gerar documento").click());
    expect(mocks.gerar).toHaveBeenCalledWith(expect.objectContaining({ variaveis: expect.objectContaining({ valor_total: "10.50", valor_total_extenso: "dez reais e cinquenta centavos", valor_inicial: "2.02" }) }));
    expect(mocks.push).toHaveBeenCalledWith("/conferencia");
  });

  it("conferência marca correção inicial pendente e sincroniza com retorno persistido", async () => {
    const salvas = { ...iniciais, valor_total_extenso: "um real e um centavo", valor_inicial_extenso: "dois reais", valor_final_extenso: "três reais", desconto_extenso: "zero reais" };
    mocks.atualizar.mockResolvedValue({ success: true, data: { variaveisJson: salvas, clausulas: [], pdfDisponivel: true } });
    await act(async () => root.render(h(ConferenciaClient, { documento })));
    expect(input("valor_total_extenso").value).toBe("um real e um centavo");
    expect(botao("Atualizar dados do contrato").disabled).toBe(false);
    expect(botao("Finalizar").disabled).toBe(true);
    expect(container.querySelector('a[href$="/download"]')).toBeNull();
    await digitar(input("valor_total"), "2.02");
    expect(input("valor_total_extenso").value).toBe("dois reais e dois centavos");
    await digitar(input("valor_total"), ""); expect(input("valor_total_extenso").value).toBe("");
    await digitar(input("valor_total"), "1.01");
    await act(async () => botao("Atualizar dados do contrato").click());
    expect(input("valor_total_extenso").value).toBe(salvas.valor_total_extenso);
    expect(botao("Atualizar dados do contrato").disabled).toBe(true);
    expect(botao("Finalizar").disabled).toBe(false);
    expect(container.querySelector('a[href$="/download"]')).not.toBeNull();
  });

  it.each(["FINALIZADO", "ARQUIVADO"])("não corrige nem cria pendências em documento %s", async (status) => {
    await act(async () => root.render(h(ConferenciaClient, { documento: { ...documento, status } })));
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector('a[href$="/download"]')).not.toBeNull();
    expect(mocks.atualizar).not.toHaveBeenCalled();
  });
});
