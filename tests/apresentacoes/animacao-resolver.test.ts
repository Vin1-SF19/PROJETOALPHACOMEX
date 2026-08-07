import { describe, expect, it } from "vitest";
import { resolverAnimacoesDoElemento } from "@/lib/apresentacoes/animacao/resolver";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";

function criarComponenteTexto(overrides: Partial<ComponenteSlide> = {}): ComponenteSlide {
  return {
    id: "c1",
    x: 0,
    y: 0,
    w: 100,
    h: 50,
    zIndex: 0,
    rotacao: 0,
    tipo: "texto",
    texto: "Olá",
    tag: "h1",
    ...overrides,
  } as ComponenteSlide;
}

describe("Alpha Motion — Fase 01 — resolver (leitura → fallback → registry)", () => {
  it("componente sem animacaoConfig e sem componente.animacao resolve array vazio (caso mais comum hoje)", () => {
    const componente = criarComponenteTexto();
    const resolvidas = resolverAnimacoesDoElemento(componente, undefined);
    expect(resolvidas).toEqual([]);
  });

  it("prioriza o novo modelo (animacaoConfig.timeline) quando presente", () => {
    const componente = criarComponenteTexto();
    const animacaoConfig: SlideAnimationConfig = {
      version: 1,
      timeline: {
        duration: 1,
        animations: [
          {
            id: "anim-1",
            elementId: "c1",
            category: "entrance",
            type: "fade",
            trigger: "on-slide-enter",
            duration: 0.5,
            delay: 0,
            order: 0,
            easing: { curva: "easeOut" },
          },
        ],
      },
    };

    const [resolvida] = resolverAnimacoesDoElemento(componente, animacaoConfig);
    expect(resolvida.origem).toBe("novo-modelo");
    expect(resolvida.animacao.type).toBe("fade");
    expect(resolvida.definicao?.id).toBe("fade");
  });

  it("cai no fallback migrado quando animacaoConfig está ausente mas componente.animacao (formato antigo) existe", () => {
    const componente = criarComponenteTexto({
      animacao: { entrada: { tipo: "fade", duracao: 0.5, delay: 0, easing: "easeOut" } },
    });

    const resolvidas = resolverAnimacoesDoElemento(componente, undefined);
    expect(resolvidas).toHaveLength(1);
    expect(resolvidas[0].origem).toBe("migrado-formato-antigo");
    expect(resolvidas[0].animacao.type).toBe("fade");
    expect(resolvidas[0].definicao?.id).toBe("fade");
  });

  it("ignora animações do novo modelo que pertencem a outro elemento", () => {
    const componente = criarComponenteTexto({ id: "c2" });
    const animacaoConfig: SlideAnimationConfig = {
      version: 1,
      timeline: {
        duration: 1,
        animations: [
          {
            id: "anim-1",
            elementId: "c1",
            category: "entrance",
            type: "fade",
            trigger: "on-slide-enter",
            duration: 0.5,
            delay: 0,
            order: 0,
            easing: { curva: "easeOut" },
          },
        ],
      },
    };

    const resolvidas = resolverAnimacoesDoElemento(componente, animacaoConfig);
    expect(resolvidas).toEqual([]);
  });
});
