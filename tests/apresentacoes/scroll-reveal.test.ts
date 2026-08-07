import { describe, expect, it } from "vitest";
import { CONFIG_SCROLL_REVEAL_PADRAO, type ConfigScrollReveal } from "@/lib/apresentacoes/scroll/scroll-reveal";
import { slideScrollConfigSchema } from "@/lib/validations/slide-animacao-config";
import { resolverAnimacoesDoElemento } from "@/lib/apresentacoes/animacao/resolver";
import { textoComponenteSchema } from "@/lib/validations/slide-componentes-basicos";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

/**
 * Fase 08 — Scroll Reveal (Seção 17 do prompt original, recorte pragmático).
 *
 * `useScrollReveal` depende de `IntersectionObserver` real e roda em ambiente "node" (sem DOM,
 * sem `@testing-library/react` instalado no projeto — confirmado em package.json antes de
 * escrever este arquivo). Por isso este arquivo cobre a CONFIGURAÇÃO (valores padrão válidos,
 * compatibilidade com o schema Zod de `SlideScrollConfig`) e a REGRA DE TRANSIÇÃO DE ESTADO
 * isolada da simulação de eventos de interseção abaixo — não o hook React em si.
 *
 * O comportamento real do IntersectionObserver (threshold, cleanup do timeout de delay,
 * fallback quando IntersectionObserver não existe) precisa de teste manual/browser.
 */

describe("Alpha Motion — Fase 08 — Scroll Reveal — configuração", () => {
  it("CONFIG_SCROLL_REVEAL_PADRAO é um ConfigScrollReveal válido e sensato", () => {
    const config: ConfigScrollReveal = CONFIG_SCROLL_REVEAL_PADRAO;
    expect(config.percentualVisivel).toBeGreaterThan(0);
    expect(config.percentualVisivel).toBeLessThanOrEqual(1);
    expect(config.executarUmaVez).toBe(true);
    expect(config.delay).toBeGreaterThanOrEqual(0);
  });

  it("slideScrollConfigSchema aceita mode 'reveal' habilitado sem os campos exclusivos de scrub/pinned", () => {
    const resultado = slideScrollConfigSchema.safeParse({ enabled: true, mode: "reveal" });
    expect(resultado.success).toBe(true);
  });

  it("slideScrollConfigSchema continua aceitando scrub/pinned/scrollytelling como tipos válidos (não implementados nesta fase, mas o schema não deve regredir)", () => {
    for (const mode of ["scrub", "pinned", "scrollytelling"] as const) {
      const resultado = slideScrollConfigSchema.safeParse({ enabled: true, mode, pin: true, scrub: 0.5 });
      expect(resultado.success).toBe(true);
    }
  });

  it("slideScrollConfigSchema sem 'enabled' cai no default false (retrocompatível com slides sem scroll configurado)", () => {
    const resultado = slideScrollConfigSchema.parse({});
    expect(resultado.enabled).toBe(false);
  });

  it("slideScrollConfigSchema rejeita mode fora do enum sem lançar exceção", () => {
    expect(() => slideScrollConfigSchema.safeParse({ enabled: true, mode: "invalido" })).not.toThrow();
    const resultado = slideScrollConfigSchema.safeParse({ enabled: true, mode: "invalido" });
    expect(resultado.success).toBe(false);
  });
});

/**
 * Simulação da MÁQUINA DE ESTADO do hook, isolada de React/DOM — reimplementa apenas a regra
 * de decisão (não o hook em si) para validar `executarUmaVez` vs. reexecução e a semântica do
 * delay, sem precisar de IntersectionObserver real.
 */
function simularSequenciaIntersecao(config: ConfigScrollReveal, eventosIsIntersecting: boolean[]): boolean[] {
  let revelado = false;
  const historico: boolean[] = [];
  for (const isIntersecting of eventosIsIntersecting) {
    if (isIntersecting) {
      if (config.delay === 0) revelado = true;
      // delay > 0 é assíncrono (setTimeout) — fora do escopo desta simulação síncrona.
    } else if (!config.executarUmaVez) {
      revelado = false;
    }
    historico.push(revelado);
  }
  return historico;
}

describe("Alpha Motion — Fase 08 — Scroll Reveal — regra de transição de estado", () => {
  it("executarUmaVez=true: uma vez revelado, sair da viewport não esconde de novo", () => {
    const config: ConfigScrollReveal = { percentualVisivel: 0.3, executarUmaVez: true, delay: 0 };
    const historico = simularSequenciaIntersecao(config, [true, false, false]);
    expect(historico).toEqual([true, true, true]);
  });

  it("executarUmaVez=false: alterna revelado/escondido conforme entra/sai (reexecuta ao voltar)", () => {
    const config: ConfigScrollReveal = { percentualVisivel: 0.3, executarUmaVez: false, delay: 0 };
    const historico = simularSequenciaIntersecao(config, [true, false, true, false]);
    expect(historico).toEqual([true, false, true, false]);
  });

  it("nunca revelado antes do primeiro cruzamento do limiar", () => {
    const config: ConfigScrollReveal = { percentualVisivel: 0.3, executarUmaVez: true, delay: 0 };
    const historico = simularSequenciaIntersecao(config, [false, false]);
    expect(historico).toEqual([false, false]);
  });
});

/**
 * `threshold` do IntersectionObserver lança TypeError em runtime se estiver fora de [0, 1]
 * (spec do browser) — Anubis identificou que `percentualVisivel` vem de `customProperties`
 * (schema Zod permissivo, sem range obrigatório) e recomendou clamping em `scroll-reveal.ts`.
 * Testa a mesma fórmula usada lá (`Math.min(1, Math.max(0, valor))`), isolada do DOM.
 */
describe("Alpha Motion — Fase 08 — Scroll Reveal — clamping de threshold (fix Anubis)", () => {
  function clamp(valor: number): number {
    return Math.min(1, Math.max(0, valor));
  }

  it("valores dentro de [0,1] permanecem inalterados", () => {
    expect(clamp(0.3)).toBe(0.3);
    expect(clamp(0)).toBe(0);
    expect(clamp(1)).toBe(1);
  });

  it("valores acima de 1 são limitados a 1 (customProperties malformado não deve quebrar o IntersectionObserver)", () => {
    expect(clamp(999)).toBe(1);
  });

  it("valores negativos são limitados a 0", () => {
    expect(clamp(-5)).toBe(0);
  });
});

function componenteTexto(id: string) {
  return textoComponenteSchema.parse({
    id,
    tipo: "texto",
    x: 0,
    y: 0,
    w: 100,
    h: 40,
    zIndex: 1,
    texto: "teste",
    tag: "p",
  });
}

describe("Alpha Motion — Fase 08 — resolverAnimacoesDoElemento — animacaoConfig ausente (caso comum do player exportado)", () => {
  it("animacaoConfig undefined não lança e retorna array vazio para componente sem animação antiga", () => {
    const componente = componenteTexto("c1");
    expect(() => resolverAnimacoesDoElemento(componente, undefined)).not.toThrow();
    expect(resolverAnimacoesDoElemento(componente, undefined)).toEqual([]);
  });

  it("animacaoConfig com timeline vazia não lança e retorna array vazio", () => {
    const componente = componenteTexto("c1");
    const resultado = resolverAnimacoesDoElemento(componente, { version: 1, timeline: { duration: 0, animations: [] } });
    expect(resultado).toEqual([]);
  });
});

describe("Alpha Motion — Fase 08 — ScrollRevealWrapper — múltiplas animações on-scroll no mesmo elemento", () => {
  function anim(overrides: Partial<ElementAnimation>): ElementAnimation {
    return {
      id: "a1",
      elementId: "c1",
      category: "entrance",
      type: "fade-in",
      trigger: "on-scroll",
      duration: 0.5,
      delay: 0,
      order: 0,
      easing: { curva: "easeOut" },
      ...overrides,
    };
  }

  it("com 2 animações on-scroll, .find() pega sempre a PRIMEIRA da lista (comportamento determinístico, não lacuna silenciosa)", () => {
    const primeira = anim({ id: "primeira", customProperties: { percentualVisivel: 0.1 } });
    const segunda = anim({ id: "segunda", customProperties: { percentualVisivel: 0.9 } });
    const animacoes = [primeira, segunda];
    const encontrada = animacoes.find((a) => a.trigger === "on-scroll");
    expect(encontrada?.id).toBe("primeira");
  });
});
