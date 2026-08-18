import { z } from "zod";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

export const canvasConfigSchema = z.object({
  width: z.number().int().min(320).max(3840),
  height: z.number().int().min(320).max(3840),
  backgroundColor: z.string().min(1).max(64).default("#0f172a"),
  backgroundImage: z.string().max(4096).optional(),
});

export type CanvasConfig = z.infer<typeof canvasConfigSchema>;

export const CANVAS_PADRAO: CanvasConfig = {
  width: 1280,
  height: 720,
  backgroundColor: "#0f172a",
};

export const FORMATOS_CANVAS = [
  { id: "widescreen", nome: "Apresentação 16:9", descricao: "Tela e projetor", width: 1280, height: 720 },
  { id: "classico", nome: "Apresentação 4:3", descricao: "Projetores clássicos", width: 1024, height: 768 },
  { id: "quadrado", nome: "Quadrado 1:1", descricao: "Feed e cards", width: 1080, height: 1080 },
  { id: "vertical", nome: "Vertical 9:16", descricao: "Stories e reels", width: 1080, height: 1920 },
] as const;

export type FormatoCanvasId = (typeof FORMATOS_CANVAS)[number]["id"];

function escalarDetalhes(componente: ComponenteSlide, escala: number): ComponenteSlide {
  const base = {
    ...componente,
    w: Math.max(1, componente.w * escala),
    h: Math.max(1, componente.h * escala),
  };

  if (base.tipo === "texto") {
    return { ...base, fontSize: base.fontSize ? Math.max(6, base.fontSize * escala) : undefined };
  }
  if (base.tipo === "icone") {
    return { ...base, tamanhoIcone: base.tamanhoIcone ? Math.max(8, base.tamanhoIcone * escala) : undefined };
  }
  if (base.tipo === "divisor") {
    return { ...base, espessura: base.espessura ? Math.max(1, base.espessura * escala) : undefined };
  }
  if (base.tipo === "card") {
    return {
      ...base,
      borderRadius: base.borderRadius ? base.borderRadius * escala : undefined,
      padding: base.padding ? base.padding * escala : undefined,
      filhos: base.filhos.map((filho) => redimensionarComponente(filho, escala, 0, 0)),
    };
  }
  if (base.tipo === "grid" || base.tipo === "container") {
    return {
      ...base,
      gap: base.gap ? base.gap * escala : undefined,
      filhos: base.filhos.map((filho) => redimensionarComponente(filho, escala, 0, 0)),
    };
  }

  return base;
}

function redimensionarComponente(
  componente: ComponenteSlide,
  escala: number,
  offsetX: number,
  offsetY: number,
): ComponenteSlide {
  const escalado = escalarDetalhes(componente, escala);
  return {
    ...escalado,
    x: offsetX + componente.x * escala,
    y: offsetY + componente.y * escala,
  } as ComponenteSlide;
}

/** Mantém proporções e centraliza o conteúdo ao trocar a razão do canvas. */
export function adaptarComponentesAoCanvas(
  componentes: ComponenteSlide[],
  origem: CanvasConfig,
  destino: CanvasConfig,
): ComponenteSlide[] {
  const escala = Math.min(destino.width / origem.width, destino.height / origem.height);
  const offsetX = (destino.width - origem.width * escala) / 2;
  const offsetY = (destino.height - origem.height * escala) / 2;
  return componentes.map((componente) => redimensionarComponente(componente, escala, offsetX, offsetY));
}

export function obterCanvasSeguro(valor: unknown): CanvasConfig {
  const parsed = canvasConfigSchema.safeParse(valor);
  return parsed.success ? parsed.data : CANVAS_PADRAO;
}
