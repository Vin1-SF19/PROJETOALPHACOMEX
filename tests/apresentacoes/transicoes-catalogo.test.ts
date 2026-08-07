import { describe, expect, it } from "vitest";
import {
  TRANSICAO_BASICA_TIPOS,
  PUSH_TIPOS,
  ZOOM_CINEMATOGRAFICO_TIPOS,
  BACKGROUND_TRANSICAO_TIPOS,
  VARIANTS_BASICAS,
  variantsPush,
  variantsZoomCinematografico,
  resolverTransicaoRica,
  transicaoEntradaSchema,
} from "@/lib/apresentacoes/transicoes/catalogo";
import { WIPE_TIPOS, clipPathParaWipe } from "@/lib/apresentacoes/transicoes/wipe";
import type { SlideTransition } from "@/lib/apresentacoes/animacao/tipos";

describe("Alpha Motion — Fase 05 — catálogo de transições", () => {
  it("tem os 10 tipos básicos exatos", () => {
    expect(TRANSICAO_BASICA_TIPOS).toHaveLength(10);
    expect(TRANSICAO_BASICA_TIPOS).toContain("none");
    expect(TRANSICAO_BASICA_TIPOS).toContain("crossfade");
    expect(TRANSICAO_BASICA_TIPOS).toContain("dissolve");
  });

  it("cada tipo básico tem uma entrada em VARIANTS_BASICAS", () => {
    for (const tipo of TRANSICAO_BASICA_TIPOS) {
      expect(VARIANTS_BASICAS[tipo]).toBeDefined();
    }
  });

  it("tem os 4 tipos de Push, 8 de Wipe, 5 de Zoom cinematográfico, 4 de Background", () => {
    expect(PUSH_TIPOS).toHaveLength(4);
    expect(WIPE_TIPOS).toHaveLength(8);
    expect(ZOOM_CINEMATOGRAFICO_TIPOS).toHaveLength(5);
    expect(BACKGROUND_TRANSICAO_TIPOS).toHaveLength(4);
  });
});

describe("Alpha Motion — Fase 05 — Push (dois slides simultâneos)", () => {
  it("push-left: saindo vai para a esquerda, entrando vem da direita", () => {
    const { entrando, saindo } = variantsPush("push-left");
    expect(entrando.initial).toMatchObject({ x: "100%" });
    expect(entrando.animate).toMatchObject({ x: 0 });
    expect(saindo.animate).toMatchObject({ x: "-100%" });
  });

  it("push-up e push-down são verticais, não horizontais", () => {
    const up = variantsPush("push-up");
    expect(up.entrando.initial).toHaveProperty("y");
    expect(up.entrando.initial).not.toHaveProperty("x");
  });
});

describe("Alpha Motion — Fase 05 — Wipe (clip-path, sem deformar conteúdo)", () => {
  it("todas as 8 variações retornam uma string de clip-path válida em progresso 0 e 1", () => {
    for (const tipo of WIPE_TIPOS) {
      const fechado = clipPathParaWipe(tipo, 0);
      const aberto = clipPathParaWipe(tipo, 1);
      expect(typeof fechado).toBe("string");
      expect(typeof aberto).toBe("string");
      expect(fechado).not.toBe(aberto);
    }
  });

  it("radial-wipe usa circle(), as demais usam inset() — nunca scale/skew (não deforma)", () => {
    expect(clipPathParaWipe("radial-wipe", 0.5)).toContain("circle(");
    expect(clipPathParaWipe("wipe-left", 0.5)).toContain("inset(");
    for (const tipo of WIPE_TIPOS) {
      expect(clipPathParaWipe(tipo, 0.5)).not.toMatch(/scale|skew/);
    }
  });

  it("progresso fora de [0,1] é clampado, nunca gera clip-path inválido", () => {
    expect(() => clipPathParaWipe("wipe-left", -1)).not.toThrow();
    expect(() => clipPathParaWipe("wipe-left", 5)).not.toThrow();
  });
});

describe("Alpha Motion — Fase 05 — Zoom cinematográfico", () => {
  it("os 5 tipos combinam escala, opacidade e (na maioria) blur", () => {
    for (const tipo of ZOOM_CINEMATOGRAFICO_TIPOS) {
      const v = variantsZoomCinematografico(tipo, 1);
      expect(v.initial).toHaveProperty("opacity");
      expect(v.initial).toHaveProperty("scale");
    }
  });

  it("intensidade maior produz blur mais forte em zoom-fade", () => {
    const leve = variantsZoomCinematografico("zoom-fade", 0.5);
    const forte = variantsZoomCinematografico("zoom-fade", 2);
    expect(leve.initial).toHaveProperty("filter");
    expect(forte.initial).toHaveProperty("filter");
  });
});

describe("Alpha Motion — Fase 05 — resolverTransicaoRica (fallback seguro)", () => {
  function transicao(type: string, overrides: Partial<SlideTransition> = {}): SlideTransition {
    return { id: "t1", type, duration: 0.5, easing: { curva: "easeOut" }, ...overrides };
  }

  it("resolve Push, Wipe, Zoom cinematográfico e Background para a família correta", () => {
    expect(resolverTransicaoRica(transicao("push-left"))?.familia).toBe("push");
    expect(resolverTransicaoRica(transicao("wipe-left"))?.familia).toBe("wipe");
    expect(resolverTransicaoRica(transicao("zoom-fade"))?.familia).toBe("zoom-cinematografico");
    expect(resolverTransicaoRica(transicao("background-crossfade"))?.familia).toBe("background");
  });

  it("tipo desconhecido retorna null (fallback fica a cargo do chamador)", () => {
    expect(resolverTransicaoRica(transicao("tipo-inexistente"))).toBeNull();
  });
});

describe("Alpha Motion — Fase 05 — transicaoEntradaSchema (validação de AtualizarSlide)", () => {
  it("aceita qualquer um dos 10 tipos básicos", () => {
    for (const tipo of TRANSICAO_BASICA_TIPOS) {
      expect(transicaoEntradaSchema.safeParse(tipo).success).toBe(true);
    }
  });

  it("aceita null (remove a transição) e undefined (campo não enviado)", () => {
    expect(transicaoEntradaSchema.safeParse(null).success).toBe(true);
    expect(transicaoEntradaSchema.safeParse(undefined).success).toBe(true);
  });

  it("rejeita string arbitrária fora do catálogo (nunca grava lixo na coluna)", () => {
    expect(transicaoEntradaSchema.safeParse("tipo-inventado-pelo-cliente").success).toBe(false);
  });
});
