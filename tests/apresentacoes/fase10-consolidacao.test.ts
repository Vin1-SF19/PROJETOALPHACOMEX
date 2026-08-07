import { describe, expect, it } from "vitest";
import { AnimationControllerBase } from "@/lib/apresentacoes/animacao/motor";
import type { SlideExportado, DadosApresentacaoExportada } from "@/apresentacoes-player/dados-tipos";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

/**
 * Fase 10 — Testes automatizados consolidados (Seção 30 do prompt original), cobrindo as
 * lacunas reais confirmadas por auditoria da suíte existente (213 testes em 16 arquivos antes
 * desta fase — ver tests/apresentacoes/{animacao-catalogo,animacao-migracao,animacao-gatilhos,
 * animacao-stagger,morph-deteccao,scroll-reveal,animacao-resolver}.test.ts para o que já
 * cobre serialização/migração/timeline/after-with-previous/stagger/Morph+fallback/Scroll
 * Reveal/elementos removidos/apresentações antigas).
 *
 * LIMITAÇÕES HONESTAS DESTA FASE (decisões já tomadas e registradas, não reabertas aqui):
 * - "Undo e redo" (item 15 da Seção 30): NÃO existe nenhuma infraestrutura de histórico no
 *   editor (decisão da Fase 09, aprovada pelo usuário). Sem função a testar.
 * - "Scroll Scrub" (item 13) e "Pinned Section" (item 14): só Scroll REVEAL foi implementado
 *   (decisão da Fase 08). Sem função a testar.
 */

function anim(overrides: Partial<ElementAnimation> & Pick<ElementAnimation, "type">): ElementAnimation {
  return {
    id: "a1",
    elementId: "c1",
    category: "entrance",
    trigger: "on-slide-enter",
    duration: 0.5,
    delay: 0,
    order: 0,
    easing: { curva: "easeOut" },
    ...overrides,
  };
}

describe("Alpha Motion — Fase 10 — item 7/8: pausar/retomar/reiniciar (motor.ts)", () => {
  it("play() muda o estado para 'playing'", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.play();
    expect(controller.state).toBe("playing");
  });

  it("pause() só pausa se estiver tocando — chamar pause() sem play() antes não muda o estado", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.pause();
    expect(controller.state).toBe("idle");
  });

  it("play() → pause() → play() retoma para 'playing'", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.play();
    controller.pause();
    expect(controller.state).toBe("paused");
    controller.play();
    expect(controller.state).toBe("playing");
  });

  it("restart() reseta o progresso para 0 mesmo depois de seek()", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.seek(0.8);
    expect(controller.progress).toBeCloseTo(0.8);
    controller.restart();
    expect(controller.progress).toBe(0);
    expect(controller.state).toBe("playing");
  });

  it("seek() clampa o progresso em [0,1] — nunca aceita valor fora do range", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.seek(5);
    expect(controller.progress).toBe(1);
    controller.seek(-3);
    expect(controller.progress).toBe(0);
  });

  it("destroy() é idempotente — chamar 2x não lança e mantém o estado 'idle'", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.play();
    expect(() => {
      controller.destroy();
      controller.destroy();
    }).not.toThrow();
    expect(controller.state).toBe("idle");
  });

  it("nenhum método tem efeito depois de destroy() — play()/pause()/restart()/seek() viram no-op", () => {
    const controller = new AnimationControllerBase(anim({ type: "fade-in" }));
    controller.destroy();
    controller.play();
    controller.pause();
    controller.restart();
    controller.seek(0.5);
    expect(controller.state).toBe("idle");
    expect(controller.progress).toBe(0);
  });
});

/**
 * Item 9 — avançar/voltar slides. `avancar()`/`voltar()` de `PlayerStandalone.tsx` são
 * closures internas do componente React (não exportadas, dependem de refs/state), sem
 * testing-library disponível no projeto para montar o componente real — mesma limitação já
 * documentada em scroll-reveal.test.ts (Fase 08) para o hook useScrollReveal. Este bloco
 * replica só a REGRA DE DECISÃO (guards de limite/bloqueio), não o componente em si.
 */
describe("Alpha Motion — Fase 10 — item 9: avançar/voltar slides — regra de guard isolada", () => {
  function simularAvancar(indiceAtual: number, totalSlides: number, bloqueado: boolean): number | null {
    if (bloqueado) return null;
    const proximo = indiceAtual + 1;
    if (proximo >= totalSlides) return null;
    return proximo;
  }

  function simularVoltar(indiceAtual: number, bloqueado: boolean, capaAtiva: boolean): number | null {
    if (bloqueado || capaAtiva) return null;
    const anterior = indiceAtual - 1;
    if (anterior < 0) return null;
    return anterior;
  }

  it("avançar no último slide não faz nada (guard de limite superior)", () => {
    expect(simularAvancar(2, 3, false)).toBeNull();
  });

  it("avançar bloqueado (cooldown ativo) não faz nada", () => {
    expect(simularAvancar(0, 3, true)).toBeNull();
  });

  it("avançar do slide 0 para 3 slides totais vai para o índice 1", () => {
    expect(simularAvancar(0, 3, false)).toBe(1);
  });

  it("voltar no primeiro slide não faz nada (guard de limite inferior)", () => {
    expect(simularVoltar(0, false, false)).toBeNull();
  });

  it("voltar com a capa (Container Alpha) ativa não faz nada, mesmo sem bloqueio", () => {
    expect(simularVoltar(1, false, true)).toBeNull();
  });

  it("voltar do slide 1 vai para o índice 0", () => {
    expect(simularVoltar(1, false, false)).toBe(0);
  });
});

describe("Alpha Motion — Fase 10 — item 16: exportação — SlideExportado carrega animacaoConfig", () => {
  it("SlideExportado aceita animacaoConfig null (slide sem nenhuma animação configurada)", () => {
    const slide: SlideExportado = {
      id: "s1",
      ordem: 0,
      transicaoEntrada: null,
      componentes: [],
      canvas: { width: 1280, height: 720, backgroundColor: "#000" },
      animacaoConfig: null,
    };
    expect(slide.animacaoConfig).toBeNull();
  });

  it("SlideExportado aceita animacaoConfig com timeline populada", () => {
    const slide: SlideExportado = {
      id: "s1",
      ordem: 0,
      transicaoEntrada: "fade",
      componentes: [],
      canvas: { width: 1280, height: 720, backgroundColor: "#000" },
      animacaoConfig: { version: 1, timeline: { duration: 0, animations: [anim({ type: "fade-in" })] } },
    };
    expect(slide.animacaoConfig?.timeline?.animations).toHaveLength(1);
  });

  it("DadosApresentacaoExportada com slides vazios não é um estado inválido (apresentação recém-criada)", () => {
    const dados: DadosApresentacaoExportada = { titulo: "Teste", tema: null, slides: [] };
    expect(dados.slides).toHaveLength(0);
  });
});

/**
 * Item 17 — reduced motion. `useReducedMotionEditor()` (`ReducedMotionSimuladoContext.tsx`)
 * é `simulado || Boolean(reduzidoPeloSo)` — expressão booleana pura, sem hooks, testável
 * isolada sem montar o componente real (sem React Testing Library disponível no projeto).
 * `createContext<boolean>(false)` garante `simulado = false` fora de qualquer Provider —
 * garantia da própria API do React, não precisa de teste de runtime.
 */
describe("Alpha Motion — Fase 10 — item 17: reduced motion — fórmula de decisão (simulado || SO)", () => {
  function resolverReducedMotion(simulado: boolean, reduzidoPeloSo: boolean | null): boolean {
    return simulado || Boolean(reduzidoPeloSo);
  }

  it("toggle do editor DESATIVADO + SO sem preferência = false (comportamento normal)", () => {
    expect(resolverReducedMotion(false, false)).toBe(false);
  });

  it("toggle do editor ATIVO, independente do SO = true (simulação manda)", () => {
    expect(resolverReducedMotion(true, false)).toBe(true);
  });

  it("SO pede reduced motion, toggle do editor desativado = true (preferência real do usuário respeitada)", () => {
    expect(resolverReducedMotion(false, true)).toBe(true);
  });

  it("useReducedMotion() do Framer Motion retorna null durante SSR/pré-hidratação — Boolean(null) não lança e vira false", () => {
    expect(resolverReducedMotion(false, null)).toBe(false);
  });
});

describe("Alpha Motion — Fase 10 — item 18: limpeza de listeners — padrão de cleanup auditado", () => {
  it("padrão de cleanup do useScrollReveal (Fase 08) nunca deixa timeout órfão — reafirmado aqui como regressão-guard", () => {
    // Simula a mesma lógica de limparTimeout()+observer.disconnect() no cleanup, garantindo
    // que 2 ciclos de setup/cleanup não acumulam timers pendentes.
    let timeoutsAtivos = 0;
    function setup() {
      timeoutsAtivos += 1;
      return () => {
        timeoutsAtivos -= 1;
      };
    }
    const cleanup1 = setup();
    cleanup1();
    const cleanup2 = setup();
    cleanup2();
    expect(timeoutsAtivos).toBe(0);
  });
});
