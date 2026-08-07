import { describe, expect, it } from "vitest";
import { formatarValorCounter } from "@/lib/apresentacoes/animacao/counter";
import { variantsBarGrow, TIPO_BAR_GROW } from "@/lib/apresentacoes/animacao/bar-grow";
import { clipPathParaColorFill, TIPO_COLOR_FILL } from "@/lib/apresentacoes/animacao/color-fill";
import { conicGradientBorderDraw, CONFIG_BORDER_DRAW_PADRAO } from "@/lib/apresentacoes/animacao/border-draw";
import { listarAnimacoes, obterAnimacao } from "@/lib/apresentacoes/animacao/registry";
import "@/lib/apresentacoes/animacao/catalogo";

describe("Alpha Motion — Fase 07 — Counter (4 exemplos do prompt original)", () => {
  it("0 até 900 (count-up)", () => {
    expect(formatarValorCounter(900, "count-up", { valorInicial: 0, valorFinal: 900 })).toBe("900");
  });

  it("0 até R$ 1.800.000 (currency-counter)", () => {
    expect(formatarValorCounter(1800000, "currency-counter", { valorInicial: 0, valorFinal: 1800000 })).toBe("R$ 1.800.000,00");
  });

  it("0% até 87% (percent-counter)", () => {
    expect(formatarValorCounter(87, "percent-counter", { valorInicial: 0, valorFinal: 87 })).toBe("87%");
  });

  it("100 até 0 (count-down)", () => {
    expect(formatarValorCounter(0, "count-down", { valorInicial: 100, valorFinal: 0 })).toBe("0");
  });

  it("decimal-counter respeita casasDecimais", () => {
    expect(formatarValorCounter(3.14159, "decimal-counter", { valorInicial: 0, valorFinal: 3.14159, casasDecimais: 2 })).toBe("3,14");
  });

  it("compact-number-counter formata em notação compacta", () => {
    const resultado = formatarValorCounter(1800000, "compact-number-counter", { valorInicial: 0, valorFinal: 1800000 });
    expect(resultado).toMatch(/mi|M/i);
  });

  it("prefixo e sufixo customizados são aplicados", () => {
    expect(formatarValorCounter(50, "count-up", { valorInicial: 0, valorFinal: 50, prefixo: "+", sufixo: " pts" })).toBe("+50 pts");
  });

  it("valor não finito cai em fallback seguro (0), nunca lança exceção", () => {
    expect(() => formatarValorCounter(NaN, "count-up", { valorInicial: 0, valorFinal: 10 })).not.toThrow();
    expect(formatarValorCounter(NaN, "count-up", { valorInicial: 0, valorFinal: 10 })).toBe("0");
  });
});

describe("Alpha Motion — Fase 07 — Bar Grow (SEMPRE scaleX/scaleY, nunca width/height)", () => {
  it("as 5 direções usam scaleX ou scaleY, nunca width/height", () => {
    for (const tipo of TIPO_BAR_GROW) {
      const { variants } = variantsBarGrow(tipo);
      const initial = variants.initial as Record<string, unknown>;
      const animate = variants.animate as Record<string, unknown>;
      const chaves = [...Object.keys(initial), ...Object.keys(animate)];
      expect(chaves.some((k) => k === "scaleX" || k === "scaleY")).toBe(true);
      expect(chaves).not.toContain("width");
      expect(chaves).not.toContain("height");
    }
  });

  it("horizontal usa scaleX com transformOrigin lateral, vertical usa scaleY com transformOrigin vertical", () => {
    expect(variantsBarGrow("bar-grow-horizontal-ltr").transformOrigin).toContain("left");
    expect(variantsBarGrow("bar-grow-horizontal-rtl").transformOrigin).toContain("right");
    expect(variantsBarGrow("bar-grow-vertical-btt").transformOrigin).toContain("bottom");
    expect(variantsBarGrow("bar-grow-vertical-ttb").transformOrigin).toContain("top");
    expect(variantsBarGrow("bar-grow-center").transformOrigin).toContain("center");
  });
});

describe("Alpha Motion — Fase 07 — Color Fill (7 direções)", () => {
  it("as 7 direções retornam clip-path válido, sem deformar (nunca scale/skew)", () => {
    for (const tipo of TIPO_COLOR_FILL) {
      const resultado = clipPathParaColorFill(tipo, 0.5);
      expect(typeof resultado).toBe("string");
      expect(resultado).not.toMatch(/scale|skew/);
    }
  });

  it("progresso 0 e 1 produzem clip-paths diferentes", () => {
    for (const tipo of TIPO_COLOR_FILL) {
      expect(clipPathParaColorFill(tipo, 0)).not.toBe(clipPathParaColorFill(tipo, 1));
    }
  });

  it("progresso fora de [0,1] é clampado, nunca quebra", () => {
    expect(() => clipPathParaColorFill("radial", -5)).not.toThrow();
    expect(() => clipPathParaColorFill("radial", 99)).not.toThrow();
  });
});

describe("Alpha Motion — Fase 07 — Border Draw completo", () => {
  it("gera conic-gradient válido com a config padrão", () => {
    const resultado = conicGradientBorderDraw(CONFIG_BORDER_DRAW_PADRAO, 0.5);
    expect(resultado).toContain("conic-gradient");
    expect(resultado).toContain(CONFIG_BORDER_DRAW_PADRAO.cor);
  });

  it("sentido anti-horário produz gradiente diferente do horário", () => {
    const horario = conicGradientBorderDraw({ ...CONFIG_BORDER_DRAW_PADRAO, sentido: "horario" }, 0.5);
    const antiHorario = conicGradientBorderDraw({ ...CONFIG_BORDER_DRAW_PADRAO, sentido: "anti-horario" }, 0.5);
    expect(horario).not.toBe(antiHorario);
  });

  it("progresso 0 e 1 produzem resultados diferentes", () => {
    const inicio = conicGradientBorderDraw(CONFIG_BORDER_DRAW_PADRAO, 0);
    const fim = conicGradientBorderDraw(CONFIG_BORDER_DRAW_PADRAO, 1);
    expect(inicio).not.toBe(fim);
  });
});

describe("Alpha Motion — Fase 07 — catálogo (entradas novas + border-draw único)", () => {
  it("border-draw continua com exatamente 1 entrada no registry (não duplicada)", () => {
    const entradas = listarAnimacoes().filter((d) => d.id === "border-draw");
    expect(entradas).toHaveLength(1);
  });

  it("border-draw agora tem customProperties com a config rica", () => {
    const def = obterAnimacao("border-draw");
    expect(def?.description).not.toContain("versão simples");
  });

  it("registra card-expand, expand-to-focus, color-fill, dim-others, focus-element", () => {
    for (const id of ["card-expand", "expand-to-focus", "color-fill", "dim-others", "focus-element"]) {
      expect(obterAnimacao(id), `${id} deveria estar registrado`).toBeDefined();
    }
  });

  it("registra os 6 tipos de counter e os 5 de bar-grow", () => {
    for (const id of ["count-up", "count-down", "percent-counter", "currency-counter", "decimal-counter", "compact-number-counter"]) {
      expect(obterAnimacao(id), `${id} deveria estar registrado`).toBeDefined();
    }
    for (const id of ["bar-grow-horizontal-ltr", "bar-grow-horizontal-rtl", "bar-grow-vertical-btt", "bar-grow-vertical-ttb", "bar-grow-center"]) {
      expect(obterAnimacao(id), `${id} deveria estar registrado`).toBeDefined();
    }
  });
});
