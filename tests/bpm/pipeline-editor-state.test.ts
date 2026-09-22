import { describe, expect, it } from "vitest";
import { criarEstadoEditor } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/pipeline-editor-store";

describe("estado do editor acima da fronteira versionada", () => {
  it.each([true, false])("preserva rascunho se revalidação chega antes da resposta: %s", async (refreshFirst) => {
    const store = criarEstadoEditor();
    store.initialize("tab", "overview");
    store.write("tab", "overview", "fields");
    store.write("etapa", "primeira", "segunda");
    store.initialize("segunda:versao", 3);
    store.initialize<string[]>("segunda:campos", ["existente"]);
    let finish!: (id: string) => void;
    const action = new Promise<string>((resolve) => { finish = resolve; }).then((id) => {
      store.write<string[]>("segunda:campos", [], (fields) => [...new Set([...fields, id])]);
    });
    const remount = () => {
      expect(store.initialize("tab", "overview")).toBe("fields");
      expect(store.initialize("etapa", "primeira")).toBe("segunda");
      expect(store.initialize("segunda:versao", 4)).toBe(3);
    };
    if (refreshFirst) remount();
    finish("novo");
    await action;
    if (!refreshFirst) remount();
    expect(store.read("segunda:campos", [])).toEqual(["existente", "novo"]);
  });

  it("mantém versão-base no conflito e só a avança após confirmação", () => {
    const store = criarEstadoEditor();
    store.initialize("versao", 2);
    store.write("sujo", false, true);
    expect(store.initialize("versao", 3)).toBe(2);
    expect(store.read("sujo", false)).toBe(true);
    store.write("versao", 2, 4);
    store.write("sujo", true, false);
    expect(store.initialize("versao", 3)).toBe(4);
    expect(store.read("sujo", true)).toBe(false);
  });

  it("isola pipelines, etapas e modo card", () => {
    const first = criarEstadoEditor();
    const second = criarEstadoEditor();
    first.write("pipeline:formulario:segunda", "", "rascunho");
    expect(second.read("pipeline:formulario:segunda", "")).toBe("");
    expect(first.read("pipeline:card:segunda", "")).toBe("");
    expect(first.read("pipeline:formulario:primeira", "")).toBe("");
  });

  it("notifica o novo consumidor após desmontagem durante uma action", () => {
    const store = criarEstadoEditor();
    let old = 0;
    let current = 0;
    const unsubscribe = store.subscribe(() => { old += 1; });
    const complete = () => store.write("campo", "", "criado");
    unsubscribe();
    store.subscribe(() => { current += 1; });
    complete();
    expect(old).toBe(0);
    expect(current).toBe(1);
    expect(store.read("campo", "")).toBe("criado");
  });
});
