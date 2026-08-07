import type { CSSProperties } from "react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

/** Posicionamento canônico compartilhado por editor, player, preview e export. */
export function stylePosicaoAbsoluta(c: Pick<ComponenteSlide, "x" | "y" | "w" | "h" | "zIndex" | "rotacao" | "flipH" | "flipV" | "opacidade">): CSSProperties {
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
