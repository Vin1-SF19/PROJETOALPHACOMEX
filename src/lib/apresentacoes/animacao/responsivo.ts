import type { ElementAnimation } from "./tipos";

/**
 * Convenção de responsividade do Alpha Motion (Fase 09 — Seção 25 do prompt original, "UI de
 * controle"). A lógica de responsividade em si (aplicar essas regras durante o playback) já é
 * respeitada desde a Fase 01 pelo motor — esta fase só formaliza a shape esperada dentro de
 * `ElementAnimation.customProperties.responsivo` e o helper de leitura defensiva, para que a
 * UI (Nova) tenha algo estável para ler/escrever.
 */
export interface ResponsivoConfig {
  /** true = a animação só roda em desktop; em mobile o elemento aparece direto, sem animação. */
  desktopOnly: boolean;
  /** Fator de redução da distância de movimento em mobile (0 a 1 — 1 = sem redução). */
  distanciaMobile: number;
  /** true = desativa Scroll Pinned/Sticky em mobile (telas pequenas não comportam bem "prender" seção). */
  desativarPin: boolean;
  /** true = desativa Parallax em mobile (custo de performance/instabilidade em touch scroll). */
  desativarParallax: boolean;
  /** `AnimationDefinition.id` (catálogo) a usar como fallback em mobile — `null` = usa a mesma animação. */
  fallbackMobile: string | null;
}

export const CONFIG_RESPONSIVA_PADRAO: ResponsivoConfig = {
  desktopOnly: false,
  distanciaMobile: 1,
  desativarPin: false,
  desativarParallax: false,
  fallbackMobile: null,
};

/**
 * Lê `responsivo` de `customProperties` com type-narrowing defensivo, campo a campo — mesmo
 * padrão já usado em `CamposEfeitosEspeciais.tsx` para os efeitos da Fase 07. Nunca lança;
 * qualquer campo ausente ou malformado cai no valor padrão seguro.
 */
export function lerConfigResponsiva(animacao: ElementAnimation): ResponsivoConfig {
  const bruto = animacao.customProperties?.responsivo;
  const props = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};

  const distanciaBruta = props.distanciaMobile;
  const distanciaMobile =
    typeof distanciaBruta === "number" && distanciaBruta >= 0 && distanciaBruta <= 1
      ? distanciaBruta
      : CONFIG_RESPONSIVA_PADRAO.distanciaMobile;

  return {
    desktopOnly: typeof props.desktopOnly === "boolean" ? props.desktopOnly : CONFIG_RESPONSIVA_PADRAO.desktopOnly,
    distanciaMobile,
    desativarPin: typeof props.desativarPin === "boolean" ? props.desativarPin : CONFIG_RESPONSIVA_PADRAO.desativarPin,
    desativarParallax: typeof props.desativarParallax === "boolean" ? props.desativarParallax : CONFIG_RESPONSIVA_PADRAO.desativarParallax,
    fallbackMobile: typeof props.fallbackMobile === "string" ? props.fallbackMobile : CONFIG_RESPONSIVA_PADRAO.fallbackMobile,
  };
}
