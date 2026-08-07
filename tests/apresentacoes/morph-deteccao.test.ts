import { describe, expect, it } from "vitest";
import { encontrarParesCompartilhados } from "@/lib/apresentacoes/morph/deteccao";
import { elegivelParaMorph, TIPOS_ELEGIVEIS_MORPH } from "@/lib/apresentacoes/morph/elegibilidade";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

function texto(id: string, sharedElementId: string | null = null): ComponenteSlide {
  return { id, x: 0, y: 0, w: 100, h: 40, zIndex: 0, rotacao: 0, tipo: "texto", texto: "t", tag: "h1", sharedElementId } as ComponenteSlide;
}

function imagem(id: string, sharedElementId: string | null = null): ComponenteSlide {
  return { id, x: 0, y: 0, w: 100, h: 100, zIndex: 0, rotacao: 0, tipo: "imagem", url: "x.png", sharedElementId } as ComponenteSlide;
}

function card(id: string, sharedElementId: string | null = null): ComponenteSlide {
  return { id, x: 0, y: 0, w: 200, h: 200, zIndex: 0, rotacao: 0, tipo: "card", filhos: [], sharedElementId } as ComponenteSlide;
}

function video(id: string, sharedElementId: string | null = null): ComponenteSlide {
  return { id, x: 0, y: 0, w: 100, h: 100, zIndex: 0, rotacao: 0, tipo: "video", url: "x.mp4", autoplay: false, loop: false, controles: true, muted: true, sharedElementId } as ComponenteSlide;
}

describe("Alpha Motion — Fase 06 — elegibilidade para Morph", () => {
  it("os 5 tipos elegíveis retornam true", () => {
    expect(TIPOS_ELEGIVEIS_MORPH.size).toBe(5);
    expect(elegivelParaMorph(texto("t1"))).toBe(true);
    expect(elegivelParaMorph(imagem("i1"))).toBe(true);
    expect(elegivelParaMorph(card("c1"))).toBe(true);
  });

  it("vídeo e outros tipos não elegíveis retornam false", () => {
    expect(elegivelParaMorph(video("v1"))).toBe(false);
  });
});

describe("Alpha Motion — Fase 06 — encontrarParesCompartilhados", () => {
  it("detecta um par válido entre origem e destino com o mesmo sharedElementId", () => {
    const atual = [imagem("a", "hero")];
    const proximo = [imagem("b", "hero")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.pares).toHaveLength(1);
    expect(resultado.pares[0].origem.id).toBe("a");
    expect(resultado.pares[0].destino.id).toBe("b");
    expect(resultado.pares[0].necessitaFallback).toBe(false);
    expect(resultado.erros).toEqual([]);
  });

  it("sharedElementId presente só na origem (não no destino) não vira par nem erro", () => {
    const atual = [imagem("a", "hero")];
    const proximo = [imagem("b", "outro-id")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.pares).toEqual([]);
    expect(resultado.erros).toEqual([]);
  });

  it("sharedElementId presente só no destino (não na origem) não vira par nem erro", () => {
    const atual = [imagem("a", null)];
    const proximo = [imagem("b", "hero")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.pares).toEqual([]);
    expect(resultado.erros).toEqual([]);
  });

  it("sharedElementId duplicado no MESMO slide (origem) retorna erro, sem travar e sem formar par", () => {
    const atual = [imagem("a1", "dup"), imagem("a2", "dup")];
    const proximo = [imagem("b", "dup")];
    expect(() => encontrarParesCompartilhados(atual, proximo)).not.toThrow();
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.erros[0].sharedElementId).toBe("dup");
    expect(resultado.pares).toEqual([]);
  });

  it("sharedElementId duplicado no destino também retorna erro", () => {
    const atual = [imagem("a", "dup")];
    const proximo = [imagem("b1", "dup"), imagem("b2", "dup")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.erros).toHaveLength(1);
    expect(resultado.pares).toEqual([]);
  });

  it("par com tipos incompatíveis (imagem -> card) marca necessitaFallback", () => {
    const atual = [imagem("a", "x")];
    const proximo = [card("b", "x")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.pares).toHaveLength(1);
    expect(resultado.pares[0].necessitaFallback).toBe(true);
  });

  it("par com tipo não elegível (vídeo) marca necessitaFallback mesmo com tipos iguais", () => {
    const atual = [video("a", "x")];
    const proximo = [video("b", "x")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.pares).toHaveLength(1);
    expect(resultado.pares[0].necessitaFallback).toBe(true);
  });

  it("encontra pares dentro de filhos de card (recursivo)", () => {
    const atual: ComponenteSlide[] = [
      { id: "c1", x: 0, y: 0, w: 200, h: 200, zIndex: 0, rotacao: 0, tipo: "card", filhos: [texto("filho1", "titulo")], sharedElementId: null } as ComponenteSlide,
    ];
    const proximo = [texto("filho2", "titulo")];
    const resultado = encontrarParesCompartilhados(atual, proximo);
    expect(resultado.pares).toHaveLength(1);
    expect(resultado.pares[0].origem.id).toBe("filho1");
  });

  it("listas vazias não quebram", () => {
    expect(() => encontrarParesCompartilhados([], [])).not.toThrow();
    expect(encontrarParesCompartilhados([], []).pares).toEqual([]);
  });
});
