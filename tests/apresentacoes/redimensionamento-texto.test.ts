import { describe, expect, it } from "vitest";
import { calcularEscalaDaCaixa, tipografiaAoRedimensionar } from "@/lib/apresentacoes/redimensionamento-texto";
import type { TextoComponente } from "@/lib/validations/slide-componentes";

const texto: TextoComponente = {
  id: "texto",
  tipo: "texto",
  texto: "Alpha Motion",
  tag: "p",
  x: 0,
  y: 0,
  w: 300,
  h: 100,
  zIndex: 1,
  rotacao: 0,
  fontSize: 20,
  richText: {
    paragraphs: [{ runs: [{ text: "Alpha ", fontSize: 20 }, { text: "Motion", fontSize: 30 }] }],
  },
};

describe("redimensionamento de texto do Alpha Motion", () => {
  it("dobra a fonte base e os runs quando a caixa dobra", () => {
    const patch = tipografiaAoRedimensionar(texto, 600, 200);
    expect(patch.fontSize).toBe(40);
    expect(patch.richText?.paragraphs[0].runs.map((run) => run.fontSize)).toEqual([40, 60]);
  });

  it("considera o crescimento total da caixa mesmo quando apenas um eixo aumenta", () => {
    expect(calcularEscalaDaCaixa({ w: 300, h: 100 }, { w: 450, h: 100 })).toBeGreaterThan(1);
  });

  it("respeita os limites de fonte do editor", () => {
    expect(tipografiaAoRedimensionar(texto, 3, 1).fontSize).toBe(6);
    expect(tipografiaAoRedimensionar(texto, 9000, 3000).fontSize).toBe(300);
  });
});
