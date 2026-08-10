import type { CSSProperties } from "react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

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
