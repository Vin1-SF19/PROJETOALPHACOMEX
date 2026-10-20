// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampoBpmInput } from "@/app/PainelAlpha/AlphaCRM/CampoBpmInput";
import { PainelResumoEtapas } from "@/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas";
import { FormularioEtapaWorkspace, type FormularioEtapaAdmin } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace";
import { PipelineEditorStateProvider } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineEditorStateProvider";
import { SalvarFormularioEtapaBpm } from "@/actions/bpm/FormulariosEtapa";
import { ObterUsoCamposBpm } from "@/actions/bpm/Campos";

vi.mock("@/actions/bpm/Anexos", () => ({ RegistrarAnexoBpm: vi.fn() }));
vi.mock("@/actions/bpm/Campos", () => ({ CriarCampoBpm: vi.fn(), AtualizarCampoBpm: vi.fn(), ExcluirCampoBpm: vi.fn(), ObterUsoCamposBpm: vi.fn() }));
vi.mock("@/actions/bpm/FormulariosEtapa", () => ({ SalvarFormularioEtapaBpm: vi.fn() }));
vi.mock("@/actions/bpm/PerguntasFollowUp", () => ({ ListarPerguntasFollowUpBpm: vi.fn(), SalvarPerguntaFollowUpBpm: vi.fn(), ExcluirPerguntaFollowUpBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer", () => ({ FormularioEtapaRenderer: () => null }));

const campo = { id: "rel", nome: "Parceiro", tipo: "relacionamento", obrigatorio: false, opcoesJson: null };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ObterUsoCamposBpm).mockResolvedValue({ success: true, data: {} });
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}

it("mantém relacionamento na composição/publicação e remove apenas da criação", async () => {
  const formulario: FormularioEtapaAdmin = { id: "form", ativo: true, versao: 1, secoes: [{ chave: "sec", titulo: "Seção", componentes: [] }] };
  await act(async () => root.render(h(PipelineEditorStateProvider, {
    children: h(FormularioEtapaWorkspace, {
      pipelineId: "pipeline", etapas: [{ id: "etapa", nome: "Etapa", ativo: true, formulario }],
      campos: [{ ...campo, etapaConfiguracoes: [{ etapaId: "etapa", visivel: true }] }],
      onFormularioAtualizado: () => {},
    }),
  })));
  await click("Adicionar campo");
  const adicionar = document.querySelector<HTMLButtonElement>('[aria-label="Adicionar Parceiro à seção"]')!;
  expect(adicionar).toBeTruthy();
  await act(async () => adicionar.click());
  expect(container.querySelector('input[aria-label="Rótulo de Parceiro"]')).toBeTruthy();
  vi.mocked(SalvarFormularioEtapaBpm).mockResolvedValue({ success: true, data: formulario } as Awaited<ReturnType<typeof SalvarFormularioEtapaBpm>>);
  await click("Publicar composição");
  expect(JSON.stringify(vi.mocked(SalvarFormularioEtapaBpm).mock.calls)).toContain('"rel"');
  await click("Adicionar campo");
  await click("Criar campo");
  const tipo = document.querySelector<HTMLSelectElement>('[role="dialog"] select')!;
  expect([...tipo.options].map((option) => option.value)).toEqual([
    "texto", "texto_longo", "numero", "moeda", "percentual", "data", "data_hora", "booleano",
    "selecao", "multiselecao", "cnpj", "cpf", "email", "lista_email", "telefone", "url", "arquivo",
  ]);
});

it("exibe nomes no campo Usuário e envia somente o ID ao selecionar", async () => {
  const onChange = vi.fn();
  const campoUsuario = { ...campo, id: "usuario-existente", nome: "Vendedor responsável", tipo: "usuario",
    usuariosOpcoes: [{ id: 42, nome: "Closer original", ativo: true }, { id: 51, nome: "Outro vendedor", ativo: true }] };
  await act(async () => root.render(h(CampoBpmInput, {
    campo: campoUsuario,
    value: "42",
    onChange,
    className: "",
  })));
  const input = container.querySelector<HTMLSelectElement>("select")!;
  expect(input.value).toBe("42");
  expect(input.selectedOptions[0].textContent).toBe("Closer original");
  await act(async () => {
    input.value = "51";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith("51");
});

it.each([
  { value: "42", nome: "Closer original" },
  { value: "999", nome: "Usuário indisponível" },
  { value: "Closer legado", nome: "Closer legado" },
  { value: "", nome: "" },
])("campo de usuário somente leitura mostra '$nome' sem expor ID", async ({ value, nome }) => {
  const onChange = vi.fn();
  await act(async () => root.render(h(CampoBpmInput, {
    campo: { ...campo, tipo: "usuario", somenteLeitura: true,
      usuariosOpcoes: [{ id: 42, nome: "Closer original", ativo: false }] },
    value, onChange, className: "",
  })));
  const input = container.querySelector<HTMLInputElement>("input")!;
  expect(input.type).toBe("text");
  expect(input.value).toBe(nome);
  expect(input.readOnly).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
});

it.each([false, true])("renderiza valor existente com readOnly=%s", async (readOnly) => {
  const onChange = vi.fn();
  await act(async () => root.render(h(CampoBpmInput, { campo, value: "Parceiro atual", onChange, className: "", readOnly })));
  const input = container.querySelector("input")!;
  expect(input.value).toBe("Parceiro atual");
  expect(input.type).toBe("text");
  expect(input.disabled).toBe(readOnly);
  if (!readOnly) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Novo parceiro");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("Novo parceiro");
  }
});

it("resumo de etapas anteriores apresenta o nome resolvido do vendedor", async () => {
  await act(async () => root.render(h(PainelResumoEtapas, {
    accent: "1,2,3",
    etapas: [{ id: "antes", nome: "Comercial", ordem: 0 }, { id: "atual", nome: "Financeiro", ordem: 1 }],
    card: {
      id: "card", etapa: { id: "atual" }, historico: [],
      campoValores: [{ id: "valor", valor: "42", valorExibicao: "Closer original",
        campo: { nome: "Vendedor responsável", etapaConfiguracoes: [{ etapaId: "antes" }] } }],
    } as unknown as React.ComponentProps<typeof PainelResumoEtapas>["card"],
  })));
  expect(container.querySelector("dd")?.textContent).toBe("Closer original");
});
