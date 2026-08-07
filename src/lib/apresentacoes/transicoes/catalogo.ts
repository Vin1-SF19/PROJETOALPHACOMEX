import { z } from "zod";
import type { Variants } from "framer-motion";
import type { SlideTransition } from "@/lib/apresentacoes/animacao/tipos";
import { clipPathParaWipe, WIPE_TIPOS, type WipeTipo } from "./wipe";

/**
 * Catálogo de transições entre slides (Fase 05 — Seção 4 do prompt original, SEM Morph —
 * isso é Fase 06). Dividido em duas famílias:
 * - Básicas: strings simples, compatíveis com `Slide.transicaoEntrada` (coluna Prisma
 *   existente, sem parâmetros extras).
 * - Ricas: precisam de `SlideTransition` completo (`direction`/`intensity`/`backgroundMode`),
 *   vivem em `Slide.animacaoConfig.transition` (Fase 01).
 */

export const TRANSICAO_BASICA_TIPOS = [
  "none",
  "fade",
  "crossfade",
  "dissolve",
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",
  "zoom-in",
  "zoom-out",
] as const;
export type TransicaoBasicaTipo = (typeof TRANSICAO_BASICA_TIPOS)[number];

/** Validação do payload de transição básica (coluna Prisma `Slide.transicaoEntrada`) — usado por `src/actions/slides.ts` (Server Action, só pode exportar `async function`, por isso o schema vive aqui). */
export const transicaoEntradaSchema = z.enum(TRANSICAO_BASICA_TIPOS).nullable().optional();

export const PUSH_TIPOS = ["push-left", "push-right", "push-up", "push-down"] as const;
export type PushTipo = (typeof PUSH_TIPOS)[number];

/** Morph / "Elemento compartilhado" (Fase 06) — aceita os dois nomes do prompt original como aliases. */
export const MORPH_TIPOS = ["morph", "elemento-compartilhado"] as const;
export type MorphTipo = (typeof MORPH_TIPOS)[number];

export const ZOOM_CINEMATOGRAFICO_TIPOS = [
  "zoom-fade",
  "zoom-through",
  "depth-zoom",
  "camera-push-in",
  "camera-pull-out",
] as const;
export type ZoomCinematograficoTipo = (typeof ZOOM_CINEMATOGRAFICO_TIPOS)[number];

export const BACKGROUND_TRANSICAO_TIPOS = [
  "background-crossfade",
  "background-zoom",
  "background-blur-transition",
  "background-parallax",
] as const;
export type BackgroundTransicaoTipo = (typeof BACKGROUND_TRANSICAO_TIPOS)[number];

export { WIPE_TIPOS, clipPathParaWipe };
export type { WipeTipo };

export type TransicaoRicaTipo = PushTipo | WipeTipo | ZoomCinematograficoTipo | BackgroundTransicaoTipo | MorphTipo;

/** Variants Básicas — mesmo formato de `VARIANTS_POR_TIPO` já usado em `TransicaoSlide.tsx`. */
export const VARIANTS_BASICAS: Record<TransicaoBasicaTipo, Variants> = {
  none: { initial: {}, animate: {}, exit: {} },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  crossfade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  dissolve: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  "slide-left": { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -60 } },
  "slide-right": { initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 60 } },
  "slide-up": { initial: { opacity: 0, y: 60 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -60 } },
  "slide-down": { initial: { opacity: 0, y: -60 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 60 } },
  "zoom-in": { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.1 } },
  "zoom-out": { initial: { opacity: 0, scale: 1.15 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9 } },
};

/**
 * Push — diferente de Slide: os DOIS slides se movem simultaneamente (o antigo é
 * empurrado para fora enquanto o novo entra), não só o entrante. Retorna um PAR de
 * variants (saindo/entrando) para uso em uma estrutura com os dois montados ao mesmo
 * tempo — nunca `AnimatePresence mode="wait"` puro, que só anima 1 elemento por vez.
 */
export function variantsPush(tipo: PushTipo): { entrando: Variants; saindo: Variants } {
  const distancia = 100; // porcentagem — desloca a largura/altura inteira do slide
  switch (tipo) {
    case "push-left":
      return {
        entrando: { initial: { x: `${distancia}%` }, animate: { x: 0 } },
        saindo: { initial: { x: 0 }, animate: { x: `-${distancia}%` } },
      };
    case "push-right":
      return {
        entrando: { initial: { x: `-${distancia}%` }, animate: { x: 0 } },
        saindo: { initial: { x: 0 }, animate: { x: `${distancia}%` } },
      };
    case "push-up":
      return {
        entrando: { initial: { y: `${distancia}%` }, animate: { y: 0 } },
        saindo: { initial: { y: 0 }, animate: { y: `-${distancia}%` } },
      };
    case "push-down":
      return {
        entrando: { initial: { y: `-${distancia}%` }, animate: { y: 0 } },
        saindo: { initial: { y: 0 }, animate: { y: `${distancia}%` } },
      };
  }
}

/** Zoom cinematográfico — escala + profundidade + opacidade + desfoque leve combinados. */
export function variantsZoomCinematografico(tipo: ZoomCinematograficoTipo, intensidade = 1): Variants {
  const blur = `blur(${4 * intensidade}px)`;
  switch (tipo) {
    case "zoom-fade":
      return { initial: { opacity: 0, scale: 1.15, filter: blur }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, scale: 0.9, filter: blur } };
    case "zoom-through":
      return { initial: { opacity: 0, scale: 0.6, filter: blur }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, scale: 1.4, filter: blur } };
    case "depth-zoom":
      return { initial: { opacity: 0, scale: 1.3, filter: blur }, animate: { opacity: 1, scale: 1, filter: "blur(0px)" }, exit: { opacity: 0, scale: 0.7, filter: blur } };
    case "camera-push-in":
      return { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.1, filter: blur } };
    case "camera-pull-out":
      return { initial: { opacity: 0, scale: 1.1 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.9, filter: blur } };
  }
}

/**
 * Resolve a definição de uma transição RICA a partir de `SlideTransition` — usada por
 * `TransicaoSlide.tsx` quando `transicaoRica` está presente. Retorna `null` para tipos não
 * reconhecidos (fallback seguro em fade fica a cargo do chamador, Seção 29).
 */
export function resolverTransicaoRica(config: SlideTransition):
  | { familia: "push"; variants: ReturnType<typeof variantsPush> }
  | { familia: "wipe"; tipo: WipeTipo }
  | { familia: "zoom-cinematografico"; variants: Variants }
  | { familia: "background"; tipo: BackgroundTransicaoTipo }
  | { familia: "morph" }
  | null {
  const tipo = config.type as TransicaoRicaTipo;

  if ((PUSH_TIPOS as readonly string[]).includes(tipo)) {
    return { familia: "push", variants: variantsPush(tipo as PushTipo) };
  }
  if ((WIPE_TIPOS as readonly string[]).includes(tipo)) {
    return { familia: "wipe", tipo: tipo as WipeTipo };
  }
  if ((ZOOM_CINEMATOGRAFICO_TIPOS as readonly string[]).includes(tipo)) {
    return { familia: "zoom-cinematografico", variants: variantsZoomCinematografico(tipo as ZoomCinematograficoTipo, config.intensity) };
  }
  if ((BACKGROUND_TRANSICAO_TIPOS as readonly string[]).includes(tipo)) {
    return { familia: "background", tipo: tipo as BackgroundTransicaoTipo };
  }
  if ((MORPH_TIPOS as readonly string[]).includes(tipo)) {
    // Morph não tem `variants` prontas aqui de propósito — precisa dos DOIS conjuntos de
    // componentes (origem/destino), que este resolver (por design, herdado da Fase 05) não
    // recebe. `MorphLayer.tsx` é quem consome essa família de fato (ver decisão registrada
    // em `.bibble/memory/decisions.md`, 2026-08-06).
    return { familia: "morph" };
  }
  return null;
}
