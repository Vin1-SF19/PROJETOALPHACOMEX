import type { ElementAnimation } from "./tipos";
import { CURVA_SIMPLES_PARA_TECNICA } from "./curvas";
import { cardCascade, metricsCascade } from "./presets-stagger";

/**
 * Presets de TIMELINE COMPLETA do Alpha Motion (Fase 09 — Seção 16 do prompt original, "criar
 * todos os 8"). Diferente de `PRESETS_STAGGER` (1 campo, `StaggerConfig`), cada preset aqui
 * retorna uma lista de `ElementAnimation` PARCIAIS — sem `id`/`elementId`, porque um preset se
 * aplica a N elementos de uma vez; quem aplica (Nova, painel de UI) preenche esses dois campos
 * por elemento alvo via `crypto.randomUUID()`/`componente.id`. Continuam 100% editáveis depois
 * de aplicados — presets não são valores "travados", só o ponto de partida.
 */
export type AnimacaoPreset = Omit<ElementAnimation, "id" | "elementId">;

function anim(overrides: Partial<AnimacaoPreset> & Pick<AnimacaoPreset, "type" | "category">): AnimacaoPreset {
  return {
    trigger: "on-slide-enter",
    duration: 0.5,
    delay: 0,
    order: 0,
    easing: { curva: "easeOut" },
    ...overrides,
  };
}

function minimalista(): AnimacaoPreset[] {
  return [
    anim({ type: "fade-in", category: "entrance", duration: 0.9, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.suave }, distance: 8 }),
  ];
}

function corporativo(): AnimacaoPreset[] {
  return [
    anim({
      type: "fade-up",
      category: "entrance",
      duration: 0.4,
      easing: { curva: CURVA_SIMPLES_PARA_TECNICA.rapida },
      distance: 16,
      stagger: { ordem: "first-to-last", intervalo: 0.06 },
    }),
  ];
}

function cinematografico(): AnimacaoPreset[] {
  return [
    anim({ type: "blur-in", category: "entrance", duration: 1.1, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.cinematografica } }),
    anim({ type: "zoom-in", category: "entrance", duration: 1.4, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.cinematografica }, intensity: 0.06 }),
  ];
}

function dinamico(): AnimacaoPreset[] {
  return [
    anim({
      type: "pop-in",
      category: "entrance",
      duration: 0.35,
      easing: { curva: CURVA_SIMPLES_PARA_TECNICA.dinamica },
      stagger: { ordem: "first-to-last", intervalo: 0.05 },
    }),
    anim({ type: "slide-in-up", category: "entrance", duration: 0.35, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.dinamica }, distance: 24 }),
  ];
}

function storytelling(): AnimacaoPreset[] {
  return [
    anim({ type: "fade-up", category: "entrance", trigger: "on-scroll", duration: 0.8, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.suave }, distance: 24 }),
    anim({ type: "dissolve-in", category: "entrance", duration: 1, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.cinematografica } }),
  ];
}

function cardsEmSequencia(): AnimacaoPreset[] {
  return [
    anim({ type: "fade-up", category: "entrance", duration: 0.5, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.suave }, distance: 20, stagger: cardCascade() }),
    anim({ type: "scale-in", category: "entrance", duration: 0.5, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.suave }, stagger: cardCascade() }),
    anim({ type: "focus-element", category: "emphasis", trigger: "on-hover", duration: 0.3 }),
  ];
}

function apresentacaoDeMetricas(): AnimacaoPreset[] {
  return [
    anim({ type: "fade-up", category: "entrance", duration: 0.45, easing: { curva: CURVA_SIMPLES_PARA_TECNICA.suave }, distance: 16, stagger: metricsCascade() }),
    anim({ type: "count-up", category: "entrance", duration: 1.5, stagger: metricsCascade() }),
    anim({ type: "bar-grow-horizontal-ltr", category: "entrance", duration: 0.8, stagger: metricsCascade() }),
  ];
}

function cardFocus(): AnimacaoPreset[] {
  return [
    anim({ type: "dim-others", category: "emphasis", trigger: "on-click", duration: 0.4 }),
    anim({ type: "card-expand", category: "emphasis", trigger: "on-click", duration: 0.6 }),
  ];
}

export const PRESETS_ANIMACAO_COMPLETOS = {
  minimalista: {
    nome: "Minimalista",
    descricao: "Fade suave, movimentos pequenos, sem bounce, sem rotações exageradas.",
    criar: minimalista,
  },
  corporativo: {
    nome: "Corporativo",
    descricao: "Fade up, stagger leve, slide discreto, transições rápidas.",
    criar: corporativo,
  },
  cinematografico: {
    nome: "Cinematográfico",
    descricao: "Blur, depth zoom, crossfade, movimento de câmera suave.",
    criar: cinematografico,
  },
  dinamico: {
    nome: "Dinâmico",
    descricao: "Scale/pop, slide, stagger mais rápido.",
    criar: dinamico,
  },
  storytelling: {
    nome: "Storytelling",
    descricao: "Scroll reveal, crossfade — narrativa que se revela ao rolar.",
    criar: storytelling,
  },
  "cards-em-sequencia": {
    nome: "Cards em sequência",
    descricao: "Fade up, scale in, stagger, highlight no card em foco.",
    criar: cardsEmSequencia,
  },
  "apresentacao-de-metricas": {
    nome: "Apresentação de métricas",
    descricao: "Count up, bar grow, fade up, cascata de métricas.",
    criar: apresentacaoDeMetricas,
  },
  "card-focus": {
    nome: "Card Focus",
    descricao: "Dim others + card expand — destaca um card por vez.",
    criar: cardFocus,
  },
} as const;

export type PresetAnimacaoCompletoId = keyof typeof PRESETS_ANIMACAO_COMPLETOS;
