// @vitest-environment happy-dom
import React, { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ListaCamposFormulario } from "@/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/ListaCamposFormulario";
import { itensFormulario, moverItemFormulario } from "@/lib/bpm/ordem-formulario";
import { resolverFormularioEtapa } from "@/lib/bpm/formulario-renderer";
const campo = (id: string) => ({ id, chave: id, tipo: "CAMPO", campoId: id, capability: null, configJson: null });
const secoes = [{ id: "s1", chave: "s1", titulo: "Seção um", componentes: [campo("a")] }, { id: "s2", chave: "s2", titulo: "Seção dois", componentes: [campo("b"), campo("c")] }];
it("move entre seções preservando IDs, seções vazias e ordem consumida", () => {
  const resultado = moverItemFormulario(secoes, "a", "c").secoes;
  expect(itensFormulario(resultado).map((item) => item.id)).toEqual(["b", "c", "a"]);
  expect(resultado[0].componentes).toEqual([]);
  expect(secoes[0].componentes[0].id).toBe("a");
  const formulario = resolverFormularioEtapa({ formulario: { id: "f", ativo: true, versao: 1, secoes: resultado.map((s, ordem) => ({ ...s, id: s.id!, ordem, componentes: s.componentes.map((c, ordem) => ({ ...c, id: c.id!, ordem })) })) }, camposCanonicos: ["a", "b", "c"].map((id) => ({ id, nome: id, tipo: "texto" })) });
  expect(formulario.secoes.flatMap((secao) => secao.componentes).filter((item) => item.tipo === "CAMPO").map((item) => item.campoId)).toEqual(["b", "c", "a"]);
});
it("rejeita colisões, limite 100 e IDs inválidos sem mutar o snapshot", () => {
  const colisao = [{ ...secoes[0], componentes: [{ ...campo("a"), chave: "b" }] }, secoes[1]];
  expect(moverItemFormulario(colisao, "a", "b").erro).toContain("chave");
  const cheio = [secoes[0], { ...secoes[1], componentes: Array.from({ length: 100 }, (_, i) => campo(`b${i}`)) }];
  expect(moverItemFormulario(cheio, "a", "b0").secoes).toBe(cheio);
  expect(moverItemFormulario(secoes, "invalido", "a").secoes).toBe(secoes);
});
const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;
afterEach(async () => { if (root) await act(async () => root.unmount()); container.remove(); });
async function montar(bloqueado = false) {
  Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
  document.body.append(container); root = createRoot(container);
  const onMover = vi.fn(() => true);
  await act(async () => root.render(h(ListaCamposFormulario, { secoes, bloqueado, metadados: (c) => ({ nome: c.chave, tipo: "Texto curto", obrigatorio: c.id === "a", rotulo: "" }), onMover, onRotulo: vi.fn(), onRemover: vi.fn() })));
  return onMover;
}
it("renderiza lista plana, metadados, alça e movimento alternativo anunciado", async () => {
  const mover = await montar();
  expect(container.querySelectorAll('ul[aria-label="Campos do formulário"] > li')).toHaveLength(3);
  expect(container.textContent).not.toContain("Seção um");
  expect(container.textContent).toContain("Obrigatório");
  expect(container.textContent).toContain("Opcional");
  expect(container.textContent).toContain("Texto curto");
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Mover a para baixo"]')!.click());
  expect(mover).toHaveBeenCalledWith("a", "b");
  expect(container.querySelector('[role="status"]')?.textContent).toContain("posição 2 de 3");
});
it("somente leitura bloqueia todos os controles", async () => {
  const mover = await montar(true);
  expect([...container.querySelectorAll("button, input")].every((item) => (item as HTMLButtonElement).disabled)).toBe(true);
  expect(mover).not.toHaveBeenCalled();
});
it("teclado inicia e cancela mantendo foco e sem modificar a ordem", async () => {
  const mover = await montar();
  const alca = container.querySelector<HTMLButtonElement>('[aria-label="Arrastar a"]')!;
  alca.focus();
  await act(async () => alca.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true })));
  expect(mover).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(alca);
});
async function geometria() {
  const itens = [...container.querySelectorAll("li")];
  for (const [i, item] of itens.entries()) {
    vi.spyOn(item, "getBoundingClientRect").mockReturnValue({ x: 0, y: i * 100, top: i * 100, bottom: i * 100 + 80, left: 0, right: 300, width: 300, height: 80, toJSON: () => ({}) });
  }
}
it("ponteiro arrasta e confirma uma única movimentação", async () => {
  const mover = await montar(); await geometria();
  const alca = container.querySelector<HTMLButtonElement>('[aria-label="Arrastar a"]')!;
  await act(async () => alca.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true, clientX: 20, clientY: 20 })));
  await act(async () => document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20, clientY: 30 })));
  await act(async () => document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20, clientY: 130 })));
  await act(async () => document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));
  expect(mover).toHaveBeenCalledExactlyOnceWith("a", "b");
});
it("teclado reordena com seta e confirma com espaço", async () => {
  const mover = await montar(); await geometria();
  const alca = container.querySelector<HTMLButtonElement>('[aria-label="Arrastar a"]')!;
  alca.focus();
  await act(async () => alca.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown", bubbles: true })));
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })));
  expect(mover).toHaveBeenCalledExactlyOnceWith("a", "b");
});
