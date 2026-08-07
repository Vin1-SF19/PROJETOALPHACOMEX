import type { Transition } from "framer-motion";
import type { EasingConfig, EasingCurva } from "./tipos";

/**
 * Curvas de velocidade do Alpha Motion (Fase 02 — Seção 13 do prompt original). Traduz
 * `EasingCurva` (12 valores, `slide-animacao-config.ts`) em valores reais de easing do
 * Framer Motion. `custom` usa `cubicBezier`; `spring` usa os 4 parâmetros físicos já
 * modelados em `EasingConfig.spring`.
 */

/** Cubic-bezier equivalente de cada curva nomeada — usado quando não há `spring`. */
const CURVA_PARA_BEZIER: Record<Exclude<EasingCurva, "spring" | "custom">, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  smooth: [0.4, 0, 0.2, 1],
  snappy: [0.2, 0, 0, 1],
  cinematic: [0.16, 1, 0.3, 1],
  bounce: [0.68, -0.55, 0.27, 1.55],
  elastic: [0.68, -0.6, 0.32, 1.6],
};

/**
 * Interface simples (Seção 13, "mostrar apenas Suave/Rápida/Dinâmica/Elástica/
 * Cinematográfica") — mapeia para as curvas técnicas completas. Configurações avançadas
 * (cubic-bezier customizado, parâmetros de Spring) ficam disponíveis à parte, num painel
 * expansível (UI implementada por Nova).
 */
export const CURVA_SIMPLES_PARA_TECNICA = {
  suave: "smooth",
  rapida: "snappy",
  dinamica: "bounce",
  elastica: "elastic",
  cinematografica: "cinematic",
} as const satisfies Record<string, EasingCurva>;
export type CurvaSimples = keyof typeof CURVA_SIMPLES_PARA_TECNICA;

/** Converte `EasingConfig` num `Transition["ease"]`/`type` do Framer Motion. */
export function resolverEasingFramerMotion(config: EasingConfig): Pick<Transition, "ease" | "type"> {
  if (config.curva === "spring") {
    return { type: "spring" };
  }
  if (config.curva === "custom") {
    // `custom` sem `cubicBezier` definido cai no fallback seguro (easeOut) — nunca undefined.
    return { ease: config.cubicBezier ?? CURVA_PARA_BEZIER.easeOut };
  }
  return { ease: CURVA_PARA_BEZIER[config.curva] ?? CURVA_PARA_BEZIER.easeOut };
}

/** Parâmetros de spring do Framer Motion — usa os valores de `EasingConfig.spring` ou defaults do schema. */
export function resolverSpringFramerMotion(config: EasingConfig): Transition {
  const spring = config.spring ?? { stiffness: 100, damping: 10, mass: 1, velocity: 0 };
  return {
    type: "spring",
    stiffness: spring.stiffness,
    damping: spring.damping,
    mass: spring.mass,
    velocity: spring.velocity,
  };
}

/** Monta a `Transition` completa (duração/delay/easing) para uma animação — ponto único usado pelo catálogo. */
export function montarTransition(
  duration: number,
  delay: number,
  easing: EasingConfig,
): Transition {
  if (easing.curva === "spring") {
    return { ...resolverSpringFramerMotion(easing), delay };
  }
  return { duration, delay, ...resolverEasingFramerMotion(easing) };
}
