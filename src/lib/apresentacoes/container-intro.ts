import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import { APRESENTACAO_SLIDE_H, APRESENTACAO_SLIDE_W } from "./viewport";

export interface DimensoesComponente {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ContainerIntroEvent {
  componente: ContainerCargaComponente;
  duracao: number;
  abertura?: DimensoesComponente;
  palco?: Pick<DimensoesComponente, "w" | "h">;
}

/** O Container Alpha é uma capa: na apresentação sempre ocupa todo o palco 16:9. */
export const DIMENSOES_CONTAINER_CAPA = {
  x: 0,
  y: 0,
  w: APRESENTACAO_SLIDE_W,
  h: APRESENTACAO_SLIDE_H,
} as const satisfies DimensoesComponente;

/** Expande as portas no eixo horizontal para assumir composição widescreen de capa. */
export const CONTAINER_CAPA_SCALE_X = 2.3;

/** Converte coordenadas medidas no viewport fullscreen para o palco lógico do slide. */
export function converterDimensoesEntrePalcos(
  dimensoes: DimensoesComponente,
  origem: Pick<DimensoesComponente, "w" | "h">,
  destino: Pick<DimensoesComponente, "w" | "h">,
): DimensoesComponente {
  if (origem.w <= 0 || origem.h <= 0) return dimensoes;
  const escalaX = destino.w / origem.w;
  const escalaY = destino.h / origem.h;
  return {
    x: dimensoes.x * escalaX,
    y: dimensoes.y * escalaY,
    w: dimensoes.w * escalaX,
    h: dimensoes.h * escalaY,
  };
}

export function centralizarComponenteNoSlide({ w, h }: Pick<DimensoesComponente, "w" | "h">) {
  return {
    x: (APRESENTACAO_SLIDE_W - w) / 2,
    y: (APRESENTACAO_SLIDE_H - h) / 2,
  };
}

function percentual(valor: number, total: number) {
  return Math.min(100, Math.max(0, (valor / total) * 100));
}

function criarClipRetangulo(
  { x, y, w, h }: DimensoesComponente,
  palco: Pick<DimensoesComponente, "w" | "h"> = DIMENSOES_CONTAINER_CAPA,
) {
  const top = percentual(y, palco.h);
  const right = percentual(palco.w - (x + w), palco.w);
  const bottom = percentual(palco.h - (y + h), palco.h);
  const left = percentual(x, palco.w);
  return `inset(${top}% ${right}% ${bottom}% ${left}% round 18px)`;
}

/** Recorte inicial do próximo slide, alinhado com a abertura interna do container. */
export function criarClipInicialContainer(
  { x, y, w, h }: DimensoesComponente,
  palco?: Pick<DimensoesComponente, "w" | "h">,
) {
  const margemX = w * 0.14;
  const margemY = h * 0.08;
  return criarClipRetangulo({ x: x + margemX, y: y + margemY, w: w - margemX * 2, h: h - margemY * 2 }, palco);
}

/** Usa a projeção exata calculada pela câmera, sem aplicar margem aproximada adicional. */
export function criarClipInicialAbertura(
  abertura: DimensoesComponente,
  palco?: Pick<DimensoesComponente, "w" | "h">,
) {
  return criarClipRetangulo(abertura, palco);
}

export const CLIP_SLIDE_COMPLETO = "inset(0% 0% 0% 0% round 0px)";
