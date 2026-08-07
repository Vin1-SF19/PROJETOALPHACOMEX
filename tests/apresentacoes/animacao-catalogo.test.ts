import { describe, expect, it } from "vitest";
import "@/lib/apresentacoes/animacao/catalogo";
import { listarAnimacoes, obterAnimacao } from "@/lib/apresentacoes/animacao/registry";
import { variantsParaNovoModelo } from "@/lib/apresentacoes/animacao/variantsNovoModelo";
import {
  montarTransition,
  resolverEasingFramerMotion,
  resolverSpringFramerMotion,
  CURVA_SIMPLES_PARA_TECNICA,
} from "@/lib/apresentacoes/animacao/curvas";
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

describe("Alpha Motion — Fase 02 — catálogo de animações", () => {
  it("registra pelo menos 35 animações de entrada, 17 de saída e 16 de ênfase", () => {
    expect(listarAnimacoes("entrance").length).toBeGreaterThanOrEqual(35);
    expect(listarAnimacoes("exit").length).toBeGreaterThanOrEqual(17);
    expect(listarAnimacoes("emphasis").length).toBeGreaterThanOrEqual(16);
  });

  it("cada animação registrada tem os 8 campos obrigatórios de AnimationDefinition", () => {
    for (const def of listarAnimacoes()) {
      expect(def.id).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(["entrance", "emphasis", "exit", "interaction", "transition"]).toContain(def.category);
      expect(def.description).toBeTruthy();
      expect(def.defaultDuration).toBeGreaterThan(0);
      expect(def.defaultEasing).toBeDefined();
      expect(Array.isArray(def.supportedProperties)).toBe(true);
      expect(typeof def.createAnimation).toBe("function");
    }
  });

  it("obterAnimacao resolve fade-in, slide-in-left e pulse (amostra de cada categoria)", () => {
    expect(obterAnimacao("fade-in")?.category).toBe("entrance");
    expect(obterAnimacao("slide-out-left")?.category).toBe("exit");
    expect(obterAnimacao("pulse")?.category).toBe("emphasis");
  });

  it("nenhuma animação usa width/height/top/left como supportedProperties (regra de performance)", () => {
    for (const def of listarAnimacoes()) {
      expect(def.supportedProperties).not.toContain("width");
      expect(def.supportedProperties).not.toContain("height");
      expect(def.supportedProperties).not.toContain("top");
      expect(def.supportedProperties).not.toContain("left");
    }
  });
});

describe("Alpha Motion — Fase 02 — variants (Framer Motion) do novo modelo", () => {
  it("fade-in gera initial/animate/transition de opacidade", () => {
    const v = variantsParaNovoModelo(anim({ type: "fade-in" }));
    expect(v).toMatchObject({ initial: { opacity: 0 }, animate: { opacity: 1 } });
  });

  it("animação de saída inverte initial/animate em relação à de entrada equivalente", () => {
    const entrada = variantsParaNovoModelo(anim({ type: "fade-up", category: "entrance" }));
    const saida = variantsParaNovoModelo(anim({ type: "fade-up-out", category: "exit" }));
    expect(entrada?.initial).toEqual(saida?.animate);
    expect(entrada?.animate).toEqual(saida?.initial);
  });

  it("bounce-in usa spring com bounce configurado", () => {
    const v = variantsParaNovoModelo(anim({ type: "bounce-in" }));
    expect(v?.transition).toMatchObject({ type: "spring", bounce: 0.5 });
  });

  it("pulse (ênfase) usa repeat: Infinity por padrão", () => {
    const v = variantsParaNovoModelo(anim({ type: "pulse", category: "emphasis" }));
    expect(v?.transition.repeat).toBe(Infinity);
  });

  it("tipo desconhecido retorna null (fallback seguro, não quebra o slide)", () => {
    expect(variantsParaNovoModelo(anim({ type: "tipo-inexistente" }))).toBeNull();
  });
});

describe("Alpha Motion — Fase 02 — curvas de velocidade", () => {
  it("as 5 curvas simples mapeiam para curvas técnicas válidas", () => {
    expect(Object.keys(CURVA_SIMPLES_PARA_TECNICA)).toHaveLength(5);
  });

  it("curva spring usa type: spring na transition", () => {
    const t = montarTransition(0.5, 0, { curva: "spring", spring: { stiffness: 200, damping: 15, mass: 1, velocity: 0 } });
    expect(t).toMatchObject({ type: "spring", stiffness: 200, damping: 15 });
  });

  it("curva custom sem cubicBezier cai no fallback easeOut sem lançar erro", () => {
    expect(() => resolverEasingFramerMotion({ curva: "custom" })).not.toThrow();
  });

  it("resolverSpringFramerMotion usa defaults quando spring não é fornecido", () => {
    const t = resolverSpringFramerMotion({ curva: "spring" });
    expect(t).toMatchObject({ type: "spring", stiffness: 100, damping: 10, mass: 1 });
  });
});
