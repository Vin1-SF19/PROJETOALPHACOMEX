// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineEditorStateProvider, usePipelineEditorState } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineEditorStateProvider";
import { FormularioEtapaWorkspace, type FormularioEtapaAdmin } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace";

vi.mock("@/actions/bpm/Campos", () => ({ CriarCampoBpm: vi.fn(), ExcluirCampoBpm: vi.fn() }));
vi.mock("@/actions/bpm/FormulariosEtapa", () => ({ SalvarFormularioEtapaBpm: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/PainelAlpha/AlphaCRM/CardModal/FormularioEtapaRenderer", () => ({ FormularioEtapaRenderer: () => null }));
import { CriarCampoBpm, ExcluirCampoBpm } from "@/actions/bpm/Campos";
import { SalvarFormularioEtapaBpm } from "@/actions/bpm/FormulariosEtapa";
import { toast } from "sonner";

const stages = ["first", "second"].map((id) => ({ id, nome: id, ativo: true, formulario: {
  id: `form-${id}`, ativo: true, versao: 1,
  secoes: [{ chave: id, titulo: `Section ${id}`, componentes: [] }],
} }));
const field = { id: "existing", nome: "Existing", tipo: "texto", etapaConfiguracoes: [{ etapaId: "second", visivel: true }] };
let root: Root;
let container: HTMLDivElement;
let version: number;
let pipeline: string;
let currentStages: typeof stages;
const published = vi.fn();
function Editor() {
  const [tab, setTab] = usePipelineEditorState(`${pipeline}:tab`, "overview");
  return h("div", null, h("button", { onClick: () => setTab("fields") }, "Fields"),
    h("output", null, tab), tab === "fields" && h(FormularioEtapaWorkspace, {
      pipelineId: pipeline, etapas: currentStages, campos: [field],
      onFormularioAtualizado: () => {}, onPublished: published,
    }));
}
async function render() {
  await act(async () => root.render(h(PipelineEditorStateProvider, { key: pipeline, children: h(Editor, { key: version }) })));
}
async function click(label: string) {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
  expect(button, label).toBeTruthy();
  await act(async () => button!.click());
}
async function addExisting() {
  const select = container.querySelector<HTMLSelectElement>('select[aria-label="Adicionar campo à seção Section second"]');
  expect(select).toBeTruthy();
  await act(async () => { select!.value = field.id; select!.dispatchEvent(new Event("change", { bubbles: true })); });
}
function title() { return container.querySelector<HTMLInputElement>('input[aria-label="Título da seção 1"]')?.value; }
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  version = 1; pipeline = "p1"; currentStages = structuredClone(stages);
  await render(); await click("Fields"); await click("second");
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("workspace React com remontagem versionada", () => {
  it("remove componente compatível e preserva adicionar/criar campo", async () => {
    expect(container.textContent).not.toContain("Adicionar componente compatível");
    expect(container.querySelector('[aria-label^="Adicionar componente à seção"]')).toBeNull();
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Adicionar campo à seção Section second"]')).toBeTruthy();
    await click("Criar novo campo");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Criar campo para second");
  });

  it("confirma e exclui campo aplicável sem removê-lo apenas da composição", async () => {
    vi.mocked(ExcluirCampoBpm).mockResolvedValue({ success: true });
    await click("Excluir campo aplicável");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("exclusão é permanente");
    await click("Excluir definitivamente");
    expect(ExcluirCampoBpm).toHaveBeenCalledWith({ campoId: field.id });
    expect(container.querySelector(`option[value="${field.id}"]`)).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Campo “Existing” excluído");
  });

  it("mantém o campo e o modal quando o servidor bloqueia dados associados", async () => {
    vi.mocked(ExcluirCampoBpm).mockResolvedValue({
      success: false,
      error: "Este campo possui dados associados e não pode ser excluído",
    });
    await click("Excluir campo aplicável");
    await click("Excluir definitivamente");
    expect(container.querySelector(`option[value="${field.id}"]`)).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith("Este campo possui dados associados e não pode ser excluído");
  });

  it("troca a etapa sem transplantar seções; preserva rascunho e aba após remontagem", async () => {
    expect(title()).toBe("Section second");
    await addExisting(); version++; await render();
    expect(container.querySelector("output")?.textContent).toBe("fields");
    expect(title()).toBe("Section second");
    expect(container.querySelectorAll('input[aria-label="Rótulo de Existing"]')).toHaveLength(1);
    await click("first"); expect(title()).toBe("Section second");
    await click("Descartar"); await click("first"); expect(title()).toBe("Section first");
  });
  it("mantém versão-base em conflito e avança somente após publicação confirmada", async () => {
    await addExisting(); currentStages[1].formulario.versao = 8; version++; await render();
    vi.mocked(SalvarFormularioEtapaBpm).mockResolvedValueOnce({ success: false, error: "Conflito" });
    await click("Publicar composição");
    expect(SalvarFormularioEtapaBpm).toHaveBeenLastCalledWith(expect.objectContaining({ etapaId: "second", versaoEsperada: 1 }));
    expect(published).not.toHaveBeenCalled();
    const confirmed: FormularioEtapaAdmin = { ...stages[1].formulario, versao: 9 };
    vi.mocked(SalvarFormularioEtapaBpm).mockResolvedValue({ success: true, data: confirmed } as Awaited<ReturnType<typeof SalvarFormularioEtapaBpm>>);
    await click("Publicar composição"); version++; await render(); await addExisting(); await click("Publicar composição");
    expect(SalvarFormularioEtapaBpm).toHaveBeenLastCalledWith(expect.objectContaining({ versaoEsperada: 9 }));
  });
  it.each([true, false])("criar campo suporta refresh antes da resposta: %s", async (refreshFirst) => {
    let resolve!: (value: Awaited<ReturnType<typeof CriarCampoBpm>>) => void;
    vi.mocked(CriarCampoBpm).mockReturnValue(new Promise((done) => { resolve = done; }));
    await click("Criar novo campo");
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Ex.: Número do processo"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Created");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Criar e adicionar");
    expect(CriarCampoBpm).toHaveBeenCalledOnce();
    if (refreshFirst) { version++; await render(); }
    await act(async () => resolve({ success: true, data: { ...field, id: "created", nome: "Created" } } as Awaited<ReturnType<typeof CriarCampoBpm>>));
    if (!refreshFirst) { version++; await render(); }
    expect(title()).toBe("Section second");
    expect(container.querySelector("output")?.textContent).toBe("fields");
    expect(container.querySelectorAll('input[aria-label="Rótulo de Created"]')).toHaveLength(1);
  });
  it("isola pipeline e trata remoção da etapa/lista vazia", async () => {
    await addExisting(); currentStages = [structuredClone(stages[0])]; version++; await render();
    expect(title()).toBe("Section first");
    expect(container.querySelector('input[aria-label="Rótulo de Existing"]')).toBeNull();
    currentStages = []; version++; await render(); expect(container.textContent).toContain("Nenhuma etapa disponível");
    pipeline = "p2"; currentStages = structuredClone(stages); await render();
    expect(container.querySelector("output")?.textContent).toBe("overview");
    await click("Fields"); expect(title()).toBe("Section first");
  });
  it("preserva rascunho após falha de criação e permite tentar novamente", async () => {
    await addExisting();
    await click("Criar novo campo");
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Ex.: Número do processo"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Retry");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    vi.mocked(CriarCampoBpm).mockResolvedValueOnce({ success: false, error: "Falha controlada" });
    await click("Criar e adicionar"); version++; await render();
    expect(toast.error).toHaveBeenCalledWith("Falha controlada");
    expect(title()).toBe("Section second");
    expect(container.querySelector("output")?.textContent).toBe("fields");
    expect(container.querySelectorAll('input[aria-label="Rótulo de Existing"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[aria-label="Rótulo de Retry"]')).toHaveLength(0);
    vi.mocked(CriarCampoBpm).mockResolvedValueOnce({ success: true, data: { ...field, id: "retry", nome: "Retry" } } as Awaited<ReturnType<typeof CriarCampoBpm>>);
    await click("Criar e adicionar"); version++; await render();
    expect(container.querySelectorAll('input[aria-label="Rótulo de Retry"]')).toHaveLength(1);
    expect(CriarCampoBpm).toHaveBeenCalledTimes(2);
  });
  it.each([true, false])("publicação confirma composição com refresh antes da resposta: %s", async (refreshFirst) => {
    await addExisting();
    let resolve!: (value: Awaited<ReturnType<typeof SalvarFormularioEtapaBpm>>) => void;
    vi.mocked(SalvarFormularioEtapaBpm).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await click("Publicar composição");
    const submitted = vi.mocked(SalvarFormularioEtapaBpm).mock.calls[0][0] as { secoes: FormularioEtapaAdmin["secoes"] };
    const confirmed: FormularioEtapaAdmin = { ...stages[1].formulario, secoes: submitted.secoes.map((section) => ({
      ...section, componentes: section.componentes.map((component) => ({ ...component, campo: field })),
    })), versao: 2 };
    currentStages[1].formulario = confirmed as typeof stages[number]["formulario"];
    if (refreshFirst) { version++; await render(); }
    await act(async () => resolve({ success: true, data: confirmed } as Awaited<ReturnType<typeof SalvarFormularioEtapaBpm>>));
    if (!refreshFirst) { version++; await render(); }
    expect(published).toHaveBeenCalledOnce();
    expect(title()).toBe("Section second");
    expect(container.querySelector("output")?.textContent).toBe("fields");
    expect(container.querySelectorAll('input[aria-label="Rótulo de Existing"]')).toHaveLength(1);
    await click("first"); expect(title()).toBe("Section first");
  });
});
