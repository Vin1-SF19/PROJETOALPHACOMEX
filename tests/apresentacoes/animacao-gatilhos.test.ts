import { describe, expect, it } from "vitest";
import { resolverOrdemExecucao, calcularDelaysEfetivos, resolucaoOrdemEhErro } from "@/lib/apresentacoes/animacao/gatilhos";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

function anim(overrides: Partial<ElementAnimation>): ElementAnimation {
  return {
    id: "a1",
    elementId: "c1",
    category: "entrance",
    type: "fade-in",
    trigger: "on-slide-enter",
    duration: 0.5,
    delay: 0,
    order: 0,
    easing: { curva: "easeOut" },
    ...overrides,
  };
}

describe("Alpha Motion — Fase 03 — resolução de ordem e gatilhos", () => {
  it("ordena por `order` quando não há dependências", () => {
    const a = anim({ id: "a", order: 1 });
    const b = anim({ id: "b", order: 0 });
    const resultado = resolverOrdemExecucao([a, b]);
    expect(resolucaoOrdemEhErro(resultado)).toBe(false);
    if (!resolucaoOrdemEhErro(resultado)) {
      expect(resultado.ordenadas.map((x) => x.id)).toEqual(["b", "a"]);
    }
  });

  it("detecta dependência circular direta (A depende de B, B depende de A) sem travar", () => {
    const a = anim({ id: "a", dependsOnAnimationId: "b" });
    const b = anim({ id: "b", dependsOnAnimationId: "a" });
    const resultado = resolverOrdemExecucao([a, b]);
    expect(resolucaoOrdemEhErro(resultado)).toBe(true);
    if (resolucaoOrdemEhErro(resultado)) {
      expect(resultado.erro).toContain("circular");
    }
  });

  it("detecta dependência circular indireta (A→B→C→A)", () => {
    const a = anim({ id: "a", dependsOnAnimationId: "b" });
    const b = anim({ id: "b", dependsOnAnimationId: "c" });
    const c = anim({ id: "c", dependsOnAnimationId: "a" });
    const resultado = resolverOrdemExecucao([a, b, c]);
    expect(resolucaoOrdemEhErro(resultado)).toBe(true);
  });

  it("retorna erro (não exceção) quando dependsOnAnimationId aponta para id inexistente", () => {
    const a = anim({ id: "a", dependsOnAnimationId: "fantasma" });
    expect(() => resolverOrdemExecucao([a])).not.toThrow();
    const resultado = resolverOrdemExecucao([a]);
    expect(resolucaoOrdemEhErro(resultado)).toBe(true);
  });

  it("array vazio não gera erro nem trava", () => {
    const resultado = resolverOrdemExecucao([]);
    expect(resolucaoOrdemEhErro(resultado)).toBe(false);
  });

  it("reconhece os 10 AnimationTrigger sem lançar erro de tipo desconhecido", () => {
    const triggers = [
      "on-slide-enter", "on-click", "after-previous", "with-previous", "on-hover",
      "on-visible", "on-scroll", "on-timeline", "after-delay", "on-element-click",
    ] as const;
    for (const trigger of triggers) {
      const resultado = resolverOrdemExecucao([anim({ trigger })]);
      expect(resolucaoOrdemEhErro(resultado)).toBe(false);
    }
  });

  it("calcularDelaysEfetivos: after-previous soma duração+delay da anterior", () => {
    const primeira = anim({ id: "p", order: 0, duration: 1, delay: 0, trigger: "on-slide-enter" });
    const segunda = anim({ id: "s", order: 1, duration: 0.5, delay: 0.2, trigger: "after-previous" });
    const delays = calcularDelaysEfetivos([primeira, segunda]);
    expect(delays.get("p")).toBe(0);
    expect(delays.get("s")).toBeCloseTo(1.2);
  });

  it("calcularDelaysEfetivos: with-previous inicia no mesmo instante da anterior", () => {
    const primeira = anim({ id: "p", order: 0, duration: 1, delay: 0.3, trigger: "on-slide-enter" });
    const segunda = anim({ id: "s", order: 1, duration: 0.5, delay: 0, trigger: "with-previous" });
    const delays = calcularDelaysEfetivos([primeira, segunda]);
    expect(delays.get("p")).toBe(0.3);
    expect(delays.get("s")).toBeCloseTo(0.3);
  });
});
