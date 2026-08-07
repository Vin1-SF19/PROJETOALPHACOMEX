/**
 * Types TypeScript do sistema Alpha Motion (Fase 01 — Fundação). Reexporta os tipos
 * inferidos do Zod (`slide-animacao-config.ts`, fonte de verdade) e adiciona os tipos
 * que não fazem parte do modelo persistido (motor de execução, registry).
 */
export type {
  AnimationTrigger,
  AnimationCategoria,
  EasingCurva,
  EasingConfig,
  StaggerOrdem,
  StaggerConfig,
  ElementAnimation,
  AnimationGroup,
  AnimationTimeline,
  SlideTransition,
  ScrollModo,
  SlideScrollConfig,
  SlideAnimationConfig,
} from "@/lib/validations/slide-animacao-config";

export {
  ANIMATION_TRIGGER_TIPOS,
  ANIMATION_CATEGORIA_TIPOS,
  EASING_CURVA_TIPOS,
  STAGGER_ORDEM_TIPOS,
  SCROLL_MODO_TIPOS,
  SLIDE_ANIMATION_CONFIG_VERSION,
} from "@/lib/validations/slide-animacao-config";

/**
 * Elemento compartilhado entre slides consecutivos — modelo reservado nesta fase,
 * consumido de fato pela Fase 06 (Morph).
 */
export interface SharedElementConfig {
  sharedElementId: string;
  morphProperties?: string[];
}
