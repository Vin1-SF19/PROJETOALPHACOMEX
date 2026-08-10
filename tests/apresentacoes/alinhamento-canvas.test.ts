import { describe, expect, it } from "vitest";
import { calcularAlinhamentoMagnetico } from "@/lib/apresentacoes/alinhamento";

describe("Alpha Motion - guias de alinhamento", () => {
  const canvas = { width: 1280, height: 720 };

  it("encaixa a borda do elemento na borda de outro componente", () => {
    const resultado = calcularAlinhamentoMagnetico({
      caixasMoveis: [{ id: "movel", x: 10, y: 10, w: 100, h: 100 }],
      referencias: [{ id: "referencia", x: 300, y: 250, w: 100, h: 100 }],
      canvas,
      deltaX: 185,
      deltaY: 0,
    });

    expect(resultado.deltaX).toBe(190);
    expect(resultado.guias.verticais).toContain(300);
    expect(resultado.guias.horizontais).toEqual([]);
  });

  it("usa o centro do slide como referencia magnetica", () => {
    const resultado = calcularAlinhamentoMagnetico({
      caixasMoveis: [{ id: "movel", x: 100, y: 100, w: 100, h: 50 }],
      referencias: [],
      canvas,
      deltaX: 489,
      deltaY: 0,
    });

    expect(resultado.deltaX).toBe(490);
    expect(resultado.guias.verticais).toContain(640);
  });

  it("mantem o movimento livre fora do limiar", () => {
    const resultado = calcularAlinhamentoMagnetico({
      caixasMoveis: [{ id: "movel", x: 10, y: 10, w: 100, h: 100 }],
      referencias: [{ id: "referencia", x: 300, y: 250, w: 100, h: 100 }],
      canvas,
      deltaX: 183,
      deltaY: 0,
    });

    expect(resultado.deltaX).toBe(183);
    expect(resultado.guias.verticais).toEqual([]);
  });
});
