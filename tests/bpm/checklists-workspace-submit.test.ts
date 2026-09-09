import { Children, isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ChecklistsWorkspace } from "@/components/bpm/checklists/ChecklistsWorkspace";
import { EtapasMultiSelect } from "@/components/bpm/checklists/EtapasMultiSelect";

const harness = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0,
  create: vi.fn().mockResolvedValue({ success: true }),
  save: vi.fn(), error: vi.fn(), transition: vi.fn(),
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.states)) harness.states[index] = typeof initial === "function" ? initial() : initial;
    return [harness.states[index], (value: unknown) => {
      harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value;
    }];
  },
  useMemo: (factory: () => unknown) => factory(),
  useTransition: () => [false, harness.transition],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: harness.error, message: vi.fn(), success: vi.fn() } }));
vi.mock("@/actions/bpm/Checklists", () => ({
  CriarTemplateChecklistBpm: harness.create, SalvarTemplateChecklistBpm: harness.save,
  AlternarTemplateChecklistBpm: vi.fn(), ListarWorkspaceChecklistsBpm: vi.fn(),
}));

type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): Array<import("react").ReactElement<Props>> {
  if (!isValidElement<Props>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elements)];
}
function invoke(value: unknown, ...args: unknown[]) {
  if (typeof value !== "function") throw new Error("Handler ausente");
  return value(...args);
}
function render() {
  harness.cursor = 0;
  return elements(ChecklistsWorkspace({
    workspace: { templates: [], cards: [], pipelines: [{ id: "p", nome: "Pipeline", etapas: [{ id: "a", nome: "Entrada" }] }] },
    erro: null, accent: "0,120,255",
  }));
}
beforeEach(() => { harness.states = []; harness.cursor = 0; vi.clearAllMocks(); });

it("bloqueia submissão específica vazia antes da action e libera após seleção explícita", () => {
  let tree = render();
  const novo = tree.find((element) => Children.toArray(element.props.children).includes("Novo template"));
  invoke(novo?.props.onClick);
  tree = render();
  invoke(tree.find((element) => element.props.id === "checklist-nome")?.props.onChange, { target: { value: "Checklist" } });
  const pipeline = tree.find((element) => element.type === "select" && !element.props["aria-label"]);
  invoke(pipeline?.props.onChange, { target: { value: "p" } });
  tree = render();
  invoke(tree.find((element) => element.type === EtapasMultiSelect)?.props.onEscopoChange, "SELECIONADAS");
  tree = render();
  const salvar = tree.find((element) => element.props.children === "Salvar template");
  expect(salvar?.props.disabled).toBe(true);
  // Exercita também a guarda do handler, independentemente do atributo disabled.
  invoke(salvar?.props.onClick);
  expect(harness.error).toHaveBeenCalledWith("Selecione ao menos uma etapa.");
  expect(harness.transition).not.toHaveBeenCalled();
  expect(harness.create).not.toHaveBeenCalled();
  expect(harness.save).not.toHaveBeenCalled();
  invoke(tree.find((element) => element.type === EtapasMultiSelect)?.props.onSelecionadasChange, ["a"]);
  tree = render();
  expect(tree.find((element) => element.props.children === "Salvar template")?.props.disabled).toBe(false);
});


it.each(["resposta", "exceção"])("envia contrato canônico e preserva seleção após erro de %s", async (falha) => {
  let tree = render();
  invoke(tree.find((element) => Children.toArray(element.props.children).includes("Novo template"))?.props.onClick);
  tree = render();
  invoke(tree.find((element) => element.props.id === "checklist-nome")?.props.onChange, { target: { value: " Checklist " } });
  invoke(tree.find((element) => element.type === "select" && !element.props["aria-label"])?.props.onChange, { target: { value: "p" } });
  tree = render();
  const multiselect = tree.find((element) => element.type === EtapasMultiSelect);
  invoke(multiselect?.props.onEscopoChange, "SELECIONADAS");
  invoke(multiselect?.props.onSelecionadasChange, ["a"]);
  if (falha === "resposta") harness.create.mockResolvedValueOnce({ success: false, error: "Conflito ao salvar" });
  else harness.create.mockRejectedValueOnce(new Error("Indisponível"));
  tree = render();
  invoke(tree.find((element) => element.props.children === "Salvar template")?.props.onClick);
  await invoke(harness.transition.mock.calls[0][0]);
  expect(harness.create).toHaveBeenCalledWith({
    nome: "Checklist", descricao: null, ativo: true, pipelineId: "p", etapaIds: ["a"], cardId: null, itens: [],
  });
  tree = render();
  expect(tree.find((element) => element.type === EtapasMultiSelect)?.props.selecionadas).toEqual(["a"]);
  expect(tree.find((element) => element.props.id === "checklist-nome")?.props.value).toBe(" Checklist ");
  expect(tree.some((element) => element.props.role === "alert" && Children.toArray(element.props.children).some((child) => typeof child === "string" && child.includes("seleção atual foi preservada")))).toBe(true);
  expect(tree.find((element) => element.props.children === "Salvar template")?.props.disabled).toBe(false);
});
