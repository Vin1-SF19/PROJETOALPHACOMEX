import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { EtapasMultiSelect } from "@/components/bpm/checklists/EtapasMultiSelect";
import {
  etapaIdsParaPayload,
  resolverSelecaoEtapasTemplate,
  trocarPipelineChecklist,
} from "@/components/bpm/checklists/checklist-editor-state";

interface PropsElemento extends Record<string, unknown> {
  children?: ReactNode;
}

type Elemento = ReactElement<PropsElemento>;

function elementos(node: ReactNode): Elemento[] {
  if (!isValidElement<PropsElemento>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(elementos)];
}

function ehFuncao(valor: unknown): valor is (...args: unknown[]) => unknown {
  return typeof valor === "function";
}

function funcao(elemento: Elemento, prop: string): (...args: unknown[]) => unknown {
  const valor = elemento.props[prop];
  if (!ehFuncao(valor)) throw new Error(`Prop ${prop} não é uma função`);
  return valor;
}

function textoFilhos(elemento: Elemento): string {
  return Children.toArray(elemento.props.children).join("");
}

const etapas = [
  { id: "etapa-a", nome: "Entrada" },
  { id: "etapa-b", nome: "Diagnóstico" },
  { id: "etapa-c", nome: "Proposta" },
  { id: "etapa-d", nome: "Fechamento" },
];

describe("RM-2026-457A31 — interação do multiselect de etapas", () => {
  it("torna o modo global exclusivo e limpa todas as etapas específicas", () => {
    const onEscopoChange = vi.fn();
    const onSelecionadasChange = vi.fn();
    const arvore = EtapasMultiSelect({
      pipelineSelecionado: true,
      etapas,
      escopo: "SELECIONADAS",
      selecionadas: ["etapa-a", "etapa-b"],
      onEscopoChange,
      onSelecionadasChange,
    });
    const radioTodas = elementos(arvore).find((elemento) => elemento.type === "input" && elemento.props.checked === false);

    expect(radioTodas?.props.type).toBe("radio");
    funcao(radioTodas!, "onChange")();
    expect(onSelecionadasChange).toHaveBeenCalledWith([]);
    expect(onEscopoChange).toHaveBeenCalledWith("TODAS");
  });

  it("seleciona uma e várias etapas, remove individualmente e resume quatro seleções", () => {
    const onSelecionadasChange = vi.fn();
    const semSelecao = elementos(EtapasMultiSelect({
      pipelineSelecionado: true,
      etapas,
      escopo: "SELECIONADAS",
      selecionadas: [],
      onEscopoChange: vi.fn(),
      onSelecionadasChange,
    }));
    const checkboxEntrada = semSelecao.find((elemento) => typeof elemento.props.onCheckedChange === "function");
    funcao(checkboxEntrada!, "onCheckedChange")(true);
    expect(onSelecionadasChange).toHaveBeenLastCalledWith(["etapa-a"]);

    const umaSelecao = elementos(EtapasMultiSelect({
      pipelineSelecionado: true,
      etapas,
      escopo: "SELECIONADAS",
      selecionadas: ["etapa-a"],
      onEscopoChange: vi.fn(),
      onSelecionadasChange,
    }));
    const checkboxDiagnostico = umaSelecao.filter((elemento) => typeof elemento.props.onCheckedChange === "function")[1];
    funcao(checkboxDiagnostico, "onCheckedChange")(true);
    expect(onSelecionadasChange).toHaveBeenLastCalledWith(["etapa-a", "etapa-b"]);

    const arvore = EtapasMultiSelect({
      pipelineSelecionado: true,
      etapas,
      escopo: "SELECIONADAS",
      selecionadas: ["etapa-a", "etapa-b", "etapa-c", "etapa-d"],
      onEscopoChange: vi.fn(),
      onSelecionadasChange,
    });
    const arvoreElementos = elementos(arvore);
    const checkboxes = arvoreElementos.filter((elemento) => typeof elemento.props.onCheckedChange === "function");
    const removerEntrada = arvoreElementos.find((elemento) => elemento.props["aria-label"] === "Remover etapa Entrada");

    expect(checkboxes).toHaveLength(4);
    funcao(checkboxes[0], "onCheckedChange")(false);
    expect(onSelecionadasChange).toHaveBeenCalledWith(["etapa-b", "etapa-c", "etapa-d"]);
    funcao(removerEntrada!, "onClick")();
    expect(onSelecionadasChange).toHaveBeenLastCalledWith(["etapa-b", "etapa-c", "etapa-d"]);
    expect(arvoreElementos.some((elemento) => textoFilhos(elemento) === "+2 etapas")).toBe(true);
  });

  it("usa controles operáveis por teclado e expõe loading, vazio e erro com retry", () => {
    const onRetry = vi.fn();
    const base = {
      pipelineSelecionado: true,
      etapas: [],
      escopo: "SELECIONADAS" as const,
      selecionadas: [],
      onEscopoChange: vi.fn(),
      onSelecionadasChange: vi.fn(),
    };
    const vazio = elementos(EtapasMultiSelect(base));
    const loading = elementos(EtapasMultiSelect({ ...base, isLoading: true }));
    const erro = elementos(EtapasMultiSelect({ ...base, error: "falha", onRetry }));
    const retry = erro.find((elemento) => elemento.props.children === "Tentar novamente");

    expect(vazio.filter((elemento) => elemento.type === "input" && elemento.props.type === "radio")).toHaveLength(2);
    expect(vazio.some((elemento) => elemento.props.children === "Este pipeline não possui etapas ativas.")).toBe(true);
    expect(loading.some((elemento) => elemento.props.children === "Carregando etapas…")).toBe(true);
    expect(erro.some((elemento) => elemento.props.role === "alert")).toBe(true);
    funcao(retry!, "onClick")();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("restaura global, múltiplas e legado e limpa vínculos ao trocar pipeline", () => {
    expect(resolverSelecaoEtapasTemplate({ etapaId: null, etapas: [] })).toEqual({ escopoEtapa: "TODAS", etapaIds: [] });
    expect(resolverSelecaoEtapasTemplate({ etapaId: "legada", etapas: [] })).toEqual({ escopoEtapa: "SELECIONADAS", etapaIds: ["legada"] });
    expect(resolverSelecaoEtapasTemplate({ etapaId: "shadow", etapas: [{ etapaId: "a" }, { etapaId: "b" }] })).toEqual({ escopoEtapa: "SELECIONADAS", etapaIds: ["a", "b"] });

    const trocado = trocarPipelineChecklist({ pipelineId: "antigo", escopoEtapa: "SELECIONADAS", etapaIds: ["a", "b"], cardId: "card-1" }, "novo");
    expect(trocado).toEqual({ pipelineId: "novo", escopoEtapa: "SELECIONADAS", etapaIds: [], cardId: "" });
  });

  it("envia somente etapaIds no contrato canônico para os modos global e múltiplo", () => {
    expect(etapaIdsParaPayload({ escopoEtapa: "TODAS", etapaIds: ["id-obsoleto"] })).toEqual([]);
    expect(etapaIdsParaPayload({ escopoEtapa: "SELECIONADAS", etapaIds: ["a", "b"] })).toEqual(["a", "b"]);
  });
});
