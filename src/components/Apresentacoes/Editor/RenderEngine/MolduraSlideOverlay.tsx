import { MOLDURAS_CATALOGO } from "@/lib/apresentacoes/molduras-catalogo";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";
import { estiloBordaMoldura } from "@/lib/apresentacoes/moldura-estilo";

/** Moldura decorativa REAL (ilustração vetorial, mesmo catálogo do elemento "moldura" — ver
 * `RenderMoldura`) ao redor do SLIDE inteiro, via CSS `border-image` (ver `moldura-estilo.ts`):
 * a arte se estica ao longo de cada lado do slide, não é distorcida para caber no centro.
 * Compartilhado entre o Editor (`CanvasArea.tsx`), o player standalone e o modo apresentação. */
export function MolduraSlideOverlay({ canvas }: { canvas: Pick<CanvasConfig, "moldura" | "width" | "height"> }) {
  if (!canvas.moldura || canvas.moldura === "nenhuma") return null;
  const entrada = MOLDURAS_CATALOGO[canvas.moldura];
  if (!entrada.src) return null;

  return <div className="pointer-events-none absolute inset-0" style={estiloBordaMoldura(entrada.src, canvas.width, canvas.height)} />;
}
