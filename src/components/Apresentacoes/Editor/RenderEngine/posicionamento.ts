import type { CSSProperties } from "react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

/** Style de posicionamento absoluto padrão para renderizar 1 componente no slide (x/y/w/h/zIndex). */
export function stylePosicaoAbsoluta(c: Pick<ComponenteSlide, "x" | "y" | "w" | "h" | "zIndex">): CSSProperties {
  return { position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, zIndex: c.zIndex };
}
