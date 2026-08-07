import { z } from "zod";

/**
 * Fundação do sistema Alpha Motion (Fase 01 — prompt-phases/01-fundacao.md).
 * Modelo de dados versionado, paralelo ao `componente.animacao` (Onda 3, 14 tipos,
 * ver `./animacao.ts`) — este arquivo cobre o nível SLIDE (transição/timeline/scroll),
 * não o nível componente individual. Nunca salvar funções: só dados serializáveis.
 */

export const ANIMATION_TRIGGER_TIPOS = [
  "on-slide-enter",
  "on-click",
  "after-previous",
  "with-previous",
  "on-hover",
  "on-visible",
  "on-scroll",
  "on-timeline",
  "after-delay",
  "on-element-click",
] as const;
export type AnimationTrigger = (typeof ANIMATION_TRIGGER_TIPOS)[number];

export const ANIMATION_CATEGORIA_TIPOS = ["entrance", "emphasis", "exit", "interaction"] as const;
export type AnimationCategoria = (typeof ANIMATION_CATEGORIA_TIPOS)[number];

export const EASING_CURVA_TIPOS = [
  "linear",
  "ease",
  "easeIn",
  "easeOut",
  "easeInOut",
  "smooth",
  "snappy",
  "cinematic",
  "bounce",
  "elastic",
  "spring",
  "custom",
] as const;
export type EasingCurva = (typeof EASING_CURVA_TIPOS)[number];

/** Curva de velocidade — Seção 13 do prompt original. `custom` usa cubicBezier, `spring` usa os 4 parâmetros físicos. */
export const easingConfigSchema = z.object({
  curva: z.enum(EASING_CURVA_TIPOS).default("easeOut"),
  cubicBezier: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  spring: z
    .object({
      stiffness: z.number().min(0).default(100),
      damping: z.number().min(0).default(10),
      mass: z.number().min(0.01).default(1),
      velocity: z.number().default(0),
    })
    .optional(),
});
export type EasingConfig = z.infer<typeof easingConfigSchema>;

export const STAGGER_ORDEM_TIPOS = [
  "first-to-last",
  "last-to-first",
  "center-out",
  "edges-in",
  "random",
  "manual",
] as const;
export type StaggerOrdem = (typeof STAGGER_ORDEM_TIPOS)[number];

/** Seção 10 do prompt original — implementação completa fica para a Fase 03. */
export const staggerConfigSchema = z.object({
  ordem: z.enum(STAGGER_ORDEM_TIPOS).default("first-to-last"),
  intervalo: z.number().min(0).default(0.1),
  duracaoIndividual: z.number().min(0).optional(),
  itensSimultaneos: z.number().int().min(1).optional(),
  repeticao: z.number().int().min(0).optional(),
  ordemManual: z.array(z.string()).optional(),
});
export type StaggerConfig = z.infer<typeof staggerConfigSchema>;

/**
 * Animação de UM elemento dentro do slide. `elementId` referencia `componente.id`
 * (`slide-componentes-base.ts`). `dependsOnAnimationId`/`triggerElementId` habilitam
 * dependências entre animações — resolvidas de fato pelo motor na Fase 03.
 */
export const elementAnimationSchema = z.object({
  id: z.string().min(1),
  elementId: z.string().min(1),
  category: z.enum(ANIMATION_CATEGORIA_TIPOS),
  type: z.string().min(1),
  trigger: z.enum(ANIMATION_TRIGGER_TIPOS).default("on-slide-enter"),
  duration: z.number().min(0).default(0.5),
  delay: z.number().min(0).default(0),
  order: z.number().int().default(0),
  easing: easingConfigSchema,
  direction: z.string().optional(),
  distance: z.number().optional(),
  intensity: z.number().optional(),
  repeat: z.number().int().min(0).optional(),
  stagger: staggerConfigSchema.optional(),
  dependsOnAnimationId: z.string().optional(),
  triggerElementId: z.string().optional(),
  /**
   * Schema propositalmente permissivo — cada efeito (Fase 07) e convenção (Fase 09) define
   * sua própria shape e faz type-narrowing defensivo na leitura, sem exigir migração de
   * schema Zod a cada campo novo. Convenções conhecidas hoje: `borderDraw`/`direcao`/`cor`
   * (Border Draw/Color Fill), `nivelEscurecimento`/`aplicarBlur` (Dim Others), `escala`/
   * `brilho`/`sombra` (Focus Element) — todas em `CamposEfeitosEspeciais.tsx`. Fase 09
   * acrescenta `responsivo?: ResponsivoConfig` (ver `animacao/responsivo.ts`,
   * `lerConfigResponsiva()` — mesmo padrão de leitura defensiva).
   */
  customProperties: z.record(z.string(), z.unknown()).optional(),
});
export type ElementAnimation = z.infer<typeof elementAnimationSchema>;

export const animationGroupSchema = z.object({
  id: z.string().min(1),
  nome: z.string().optional(),
  animationIds: z.array(z.string()),
});
export type AnimationGroup = z.infer<typeof animationGroupSchema>;

export const animationTimelineSchema = z.object({
  duration: z.number().min(0).default(0),
  animations: z.array(elementAnimationSchema).default([]),
  groups: z.array(animationGroupSchema).optional(),
});
export type AnimationTimeline = z.infer<typeof animationTimelineSchema>;

/** Transição ENTRE slides — Seção 4 do prompt original. Catálogo completo é a Fase 05. */
export const slideTransitionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  duration: z.number().min(0).default(0.6),
  delay: z.number().min(0).optional(),
  easing: easingConfigSchema,
  direction: z.string().optional(),
  intensity: z.number().optional(),
  backgroundMode: z.string().optional(),
});
export type SlideTransition = z.infer<typeof slideTransitionSchema>;

export const SCROLL_MODO_TIPOS = ["reveal", "scrub", "pinned", "scrollytelling"] as const;
export type ScrollModo = (typeof SCROLL_MODO_TIPOS)[number];

/** Seção 17 do prompt original — implementação completa é a Fase 08. */
export const slideScrollConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(SCROLL_MODO_TIPOS).optional(),
  snap: z.boolean().optional(),
  pin: z.boolean().optional(),
  start: z.union([z.string(), z.number()]).optional(),
  end: z.union([z.string(), z.number()]).optional(),
  scrub: z.number().optional(),
});
export type SlideScrollConfig = z.infer<typeof slideScrollConfigSchema>;

/** Versão atual do formato — usada pela migração/compatibilidade (`./migracao.ts` no motor). */
export const SLIDE_ANIMATION_CONFIG_VERSION = 1;

/**
 * Raiz do modelo de dados da Fundação (Seção 19 do prompt original). Vive como campo
 * opcional em `dadosSlideSchema` (`slide-componentes.ts`), irmão de `componentes`/`canvas`.
 * Ausente = apresentação sem configuração de animação nova (comportamento anterior a esta
 * fila, preservado sem exigir migração).
 */
export const slideAnimationConfigSchema = z.object({
  version: z.number().int().min(1).default(SLIDE_ANIMATION_CONFIG_VERSION),
  transition: slideTransitionSchema.optional(),
  timeline: animationTimelineSchema.optional(),
  scroll: slideScrollConfigSchema.optional(),
});
export type SlideAnimationConfig = z.infer<typeof slideAnimationConfigSchema>;

/**
 * `sharedElementId` — reservado nesta fase para a Fase 06 (Morph/Elemento Compartilhado).
 * Elementos de slides consecutivos com o mesmo id participam da transição Morph.
 */
export const sharedElementIdSchema = z.string().min(1).nullable().optional();
