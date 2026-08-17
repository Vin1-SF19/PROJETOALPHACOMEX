import type { CSSProperties } from "react";
import type { CardComponente, ComponenteSlide } from "@/lib/validations/slide-componentes";

/** Gradiente tem precedência visual sobre cor sólida quando os dois estão presentes —
 * escolha do usuário via `CardProps.tsx` (2 cores + ângulo, sem exigir hex digitado). */
export function cssBackgroundDoCard(componente: Pick<CardComponente, "corFundo" | "gradiente">): string {
  if (componente.gradiente) {
    const { angulo, corInicio, corFim } = componente.gradiente;
    return `linear-gradient(${angulo}deg, ${corInicio}, ${corFim})`;
  }
  return componente.corFundo ?? "transparent";
}

/** CSS `filter` combinando brilho (`brightness()`, escurece/clareia sem revelar o que está
 * atrás — diferente de opacidade) com o blur de efeitos globais do slide (Dim Others/Focus
 * Element) — CSS só aceita 1 `filter` por elemento, nunca compor separadamente. */
export function filtroCss(brilhoPercentual: number | undefined, blurAtivo: boolean | undefined): string | undefined {
  const partes: string[] = [];
  if (brilhoPercentual !== undefined && brilhoPercentual !== 100) partes.push(`brightness(${brilhoPercentual / 100})`);
  if (blurAtivo) partes.push("blur(3px)");
  return partes.length > 0 ? partes.join(" ") : undefined;
}

/** Posicionamento canônico compartilhado por editor, player, preview e export. */
type ComponentePosicionavel = Pick<ComponenteSlide, "x" | "y" | "w" | "h" | "zIndex" | "rotacao" | "flipH" | "flipV" | "opacidade"> & {
  tipo?: ComponenteSlide["tipo"];
};

export function stylePosicaoAbsoluta(c: ComponentePosicionavel): CSSProperties {
  if (c.tipo === "fundoAnimado") {
    return {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      zIndex: c.zIndex,
      opacity: c.opacidade,
      transformOrigin: "center center",
    };
  }
  const transforms = [
    c.rotacao ? `rotate(${c.rotacao}deg)` : "",
    c.flipH || c.flipV ? `scale(${c.flipH ? -1 : 1}, ${c.flipV ? -1 : 1})` : "",
  ].filter(Boolean);
  return {
    position: "absolute",
    left: c.x,
    top: c.y,
    width: c.w,
    height: c.h,
    zIndex: c.zIndex,
    transform: transforms.join(" ") || undefined,
    transformOrigin: "center center",
    opacity: c.opacidade,
  };
}
