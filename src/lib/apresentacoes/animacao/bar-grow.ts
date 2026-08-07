import type { Variants } from "framer-motion";

/**
 * Fase 07 (Alpha Motion) - Bar Grow (Secao 8 do prompt original). SEMPRE usa
 * scaleX/scaleY (nunca width/height diretos - regra de performance obrigatoria,
 * "00-contexto-geral.md").
 */
export const TIPO_BAR_GROW = [
  "bar-grow-horizontal-ltr",
  "bar-grow-horizontal-rtl",
  "bar-grow-vertical-btt",
  "bar-grow-vertical-ttb",
  "bar-grow-center",
] as const;
export type TipoBarGrow = (typeof TIPO_BAR_GROW)[number];

export interface ResultadoBarGrow {
  variants: Variants;
  transformOrigin: string;
}

/**
 * Retorna as variants Framer Motion + o transformOrigin CSS correspondente - Variants
 * sozinhas nao definem transformOrigin, entao o chamador precisa aplicar o valor retornado
 * no estilo do elemento.
 */
export function variantsBarGrow(tipo: TipoBarGrow): ResultadoBarGrow {
  switch (tipo) {
    case "bar-grow-horizontal-ltr":
      return {
        variants: { initial: { scaleX: 0 }, animate: { scaleX: 1 } },
        transformOrigin: "left center",
      };
    case "bar-grow-horizontal-rtl":
      return {
        variants: { initial: { scaleX: 0 }, animate: { scaleX: 1 } },
        transformOrigin: "right center",
      };
    case "bar-grow-vertical-btt":
      return {
        variants: { initial: { scaleY: 0 }, animate: { scaleY: 1 } },
        transformOrigin: "center bottom",
      };
    case "bar-grow-vertical-ttb":
      return {
        variants: { initial: { scaleY: 0 }, animate: { scaleY: 1 } },
        transformOrigin: "center top",
      };
    case "bar-grow-center":
      return {
        variants: { initial: { scaleX: 0 }, animate: { scaleX: 1 } },
        transformOrigin: "center center",
      };
    default:
      // Fallback seguro (Secao 29) - nunca deve ser alcancado dado o union exaustivo, mas
      // protege contra dado corrompido vindo do banco (tipo desconhecido em runtime).
      return {
        variants: { initial: { scaleX: 0 }, animate: { scaleX: 1 } },
        transformOrigin: "left center",
      };
  }
}
