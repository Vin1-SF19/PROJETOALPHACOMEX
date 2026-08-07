import type { StaggerConfig } from "./tipos";

/**
 * Presets de stagger prontos (Fase 03 — Seção 10 do prompt original, "Criar presets").
 * Cada função retorna um `StaggerConfig` válido — continua 100% editável depois de
 * aplicado (nunca é um valor "travado").
 */

export function sequentialReveal(): StaggerConfig {
  return { ordem: "first-to-last", intervalo: 0.08 };
}

export function cardCascade(): StaggerConfig {
  return { ordem: "first-to-last", intervalo: 0.15 };
}

export function textCascade(): StaggerConfig {
  return { ordem: "first-to-last", intervalo: 0.03 };
}

export function gridReveal(): StaggerConfig {
  return { ordem: "center-out", intervalo: 0.1 };
}

export function metricsCascade(): StaggerConfig {
  return { ordem: "first-to-last", intervalo: 0.12 };
}

export function centerOut(): StaggerConfig {
  return { ordem: "center-out", intervalo: 0.18 };
}

export function waveReveal(): StaggerConfig {
  return { ordem: "edges-in", intervalo: 0.1 };
}

export const PRESETS_STAGGER = {
  "sequential-reveal": { nome: "Sequential Reveal", criar: sequentialReveal },
  "card-cascade": { nome: "Card Cascade", criar: cardCascade },
  "text-cascade": { nome: "Text Cascade", criar: textCascade },
  "grid-reveal": { nome: "Grid Reveal", criar: gridReveal },
  "metrics-cascade": { nome: "Metrics Cascade", criar: metricsCascade },
  "center-out": { nome: "Center Out", criar: centerOut },
  "wave-reveal": { nome: "Wave Reveal", criar: waveReveal },
} as const;

export type PresetStaggerId = keyof typeof PRESETS_STAGGER;
