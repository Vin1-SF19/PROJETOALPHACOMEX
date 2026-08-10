import { describe, expect, it } from "vitest";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { variantsParaNovoModelo } from "@/lib/apresentacoes/animacao/variantsNovoModelo";

function animacao(type: string, category: ElementAnimation["category"] = "entrance"): ElementAnimation {
  return {
    id: `anim-${type}`,
    elementId: "elemento-1",
    type,
    category,
    trigger: "on-slide-enter",
    duration: 0.6,
    delay: 0,
    order: 0,
    easing: { curva: "easeOut" },
  };
}

describe("variants executadas pelo player Alpha Motion", () => {
  it("produz movimentos distintos para efeitos de entrada distintos", () => {
    const fadeLeft = variantsParaNovoModelo(animacao("fade-left"));
    const zoom = variantsParaNovoModelo(animacao("zoom-in"));

    expect(fadeLeft?.initial).toMatchObject({ opacity: 0, x: 24 });
    expect(zoom?.initial).toMatchObject({ opacity: 0, scale: 0.7 });
    expect(fadeLeft?.initial).not.toEqual(zoom?.initial);
  });

  it("executa mask close e bar grow sem cair no mesmo fallback visual", () => {
    const mask = variantsParaNovoModelo(animacao("mask-close", "exit"));
    const barra = variantsParaNovoModelo(animacao("bar-grow-horizontal-ltr"));

    expect(mask?.animate).toMatchObject({ opacity: 0, clipPath: "inset(50% 50% 50% 50%)" });
    expect(barra?.initial).toMatchObject({ scaleX: 0 });
    expect(barra?.animate).toMatchObject({ scaleX: 1 });
  });
});
