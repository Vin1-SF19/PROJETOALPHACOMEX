// @vitest-environment happy-dom
import React, { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CANAIS_ORIGEM_PADRAO } from "@/lib/comercial/canais-origem";
import NovoCardModal from "@/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal";

const buscarPorCnpj = vi.hoisted(() => vi.fn());
const consultarDadosCnpj = vi.hoisted(() => vi.fn());
const onCriado = vi.fn();

vi.mock("@/actions/bpm/Cards", () => ({
  BuscarEmpresaPorCnpjBpm: buscarPorCnpj,
  BuscarEmpresasBpm: vi.fn(async () => ({ success: true, data: [] })),
  ListarUsuariosResponsavelBpm: vi.fn(async () => ({ success: true, data: [{ id: 1, nome: "Responsável" }] })),
}));
vi.mock("@/actions/parceiros", () => ({ listarParceirosSimples: vi.fn(async () => [
  { id: 5, nome: "Parceiro teste", nomeFantasia: null, representantes: [] },
]) }));
vi.mock("@/components/comercial/SeletorParceiroPesquisavel", () => ({
  SeletorParceiroPesquisavel: ({ onChange, disabled }: { onChange: (id: number) => void; disabled: boolean }) =>
    createElement("button", { type: "button", disabled, onClick: () => onChange(5) }, "Selecionar parceiro teste"),
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

it("oferece canal de origem em select, retira Qualificação e deixa radar opcional", () => {
  const canal = container.querySelector<HTMLSelectElement>("select#novo-card-canal")!;
  expect(canal).not.toBeNull();
  expect([...canal.options].map((option) => option.value)).toEqual(["", ...CANAIS_ORIGEM_PADRAO]);
  expect(container.querySelector("#novo-card-qualificacao")).toBeNull();
  expect(container.textContent).not.toContain("Qualificação");
  expect(container.querySelector<HTMLSelectElement>("#novo-card-radar")?.required).toBe(false);
  expect(container.textContent).toContain("Radar pretendido (opcional)");
});

async function preencherEmpresaExistente() {
  buscarPorCnpj.mockResolvedValueOnce({ success: true, data: {
    id: 42, cnpj: "11222333000181", razaoSocial: "Empresa cadastrada", nomeFantasia: null, uf: "SP", municipio: "São Paulo",
  } });
  await act(async () => editar("CNPJ", "11222333000181"));
}
async function clicar(texto: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === texto)!;
  expect(button).toBeDefined();
  await act(async () => button.click());
}
async function escreverCanal(valor: string) {
  const input = container.querySelector<HTMLInputElement>("#novo-card-canal-novo")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("cadastra com canal padrão e sem radar ou Qualificação no payload", async () => {
  await preencherEmpresaExistente();
  await act(async () => {
    const select = container.querySelector<HTMLSelectElement>("#novo-card-canal")!;
    select.value = "Evento";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await clicar("Criar Card");
  expect(onCriado).toHaveBeenCalledOnce();
  const dados = onCriado.mock.calls[0][0];
  expect(dados).toMatchObject({ empresaId: 42, canalOrigem: "Evento" });
  expect(dados.radarPretendido).toBeUndefined();
  expect(dados).not.toHaveProperty("qualificacao");
});

it("permite cadastrar mesmo sem opções de radar configuradas", async () => {
  await act(async () => root.render(createElement(NovoCardModal, {
    pipelineId: "pipeline", etapaId: "etapa", etapaNome: "Novo Lead", currentUserId: 1, accent: "1,2,3",
    radarOpcoes: [], onClose: vi.fn(), onCriado,
  })));
  await preencherEmpresaExistente();
  await clicar("Criar Card");
  expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 42, radarPretendido: undefined }));
});

it("adiciona e seleciona canal personalizado e o envia no cadastro", async () => {
  await preencherEmpresaExistente();
  await clicar("Personalizar");
  expect(container.querySelector<HTMLInputElement>("#novo-card-canal-novo")?.maxLength).toBe(120);
  await escreverCanal("  Feira   internacional  ");
  await clicar("Adicionar canal");
  expect(container.querySelector<HTMLSelectElement>("#novo-card-canal")?.value).toBe("Feira internacional");
  expect(container.querySelector("#novo-card-canal-novo")).toBeNull();
  await clicar("Criar Card");
  expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({ canalOrigem: "Feira internacional", radarPretendido: undefined }));
});

it("recusa personalização vazia e permite cancelar sem alterar a seleção", async () => {
  await clicar("Personalizar");
  await escreverCanal("   ");
  const adicionar = [...container.querySelectorAll("button")].find((button) => button.textContent === "Adicionar canal")!;
  expect(adicionar.disabled).toBe(true);
  await escreverCanal("Não confirmado");
  await clicar("Cancelar personalização");
  expect(container.querySelector<HTMLSelectElement>("#novo-card-canal")?.value).toBe("");
  expect(container.textContent).not.toContain("Não confirmado");
});

it("reutiliza canal existente sem duplicar opções por diferenças de caixa e espaços", async () => {
  await clicar("Personalizar");
  await escreverCanal("  evento ");
  await clicar("Adicionar canal");
  const select = container.querySelector<HTMLSelectElement>("#novo-card-canal")!;
  expect(select.value).toBe("Evento");
  expect(select.options.length).toBe(CANAIS_ORIGEM_PADRAO.length + 1);
});

it("preserva o canal personalizado e cadastra indicação com parceiro no seletor escuro", async () => {
  await preencherEmpresaExistente();
  await act(async () => {
    const select = container.querySelector<HTMLSelectElement>("#novo-card-canal")!;
    expect(select.style.colorScheme).toBe("dark");
    select.value = "Indicação Parceiro";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await clicar("Selecionar parceiro teste");
  await clicar("Criar Card");
  expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({ empresaId: 42, canalOrigem: "Indicação Parceiro", parceiroOrigemId: 5 }));
});
