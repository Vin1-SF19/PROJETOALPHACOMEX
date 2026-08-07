import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

/**
 * Tipos elegíveis para Morph via `layoutId` do Framer Motion (Fase 06 — decisão registrada
 * em `.bibble/memory/decisions.md`, 2026-08-06). Vídeo, 3D (globo/particulas/objeto3d) e
 * containers com filhos complexos (grid) NÃO estão aqui — caem no fallback Crossfade
 * automaticamente, nunca erro (mesmo padrão de recorte pragmático da Fase 05, Push).
 */
export const TIPOS_ELEGIVEIS_MORPH = new Set<ComponenteSlide["tipo"]>(["texto", "imagem", "card", "icone", "botao"]);

export function elegivelParaMorph(componente: ComponenteSlide): boolean {
  return TIPOS_ELEGIVEIS_MORPH.has(componente.tipo);
}
