import type { PptxMatrix, PptxPointEmu, PptxSizeEmu } from "./modelo-intermediario";

export const MATRIZ_IDENTIDADE: PptxMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function multiplicarMatrizes(externa: PptxMatrix, interna: PptxMatrix): PptxMatrix {
  return {
    a: externa.a * interna.a + externa.c * interna.b,
    b: externa.b * interna.a + externa.d * interna.b,
    c: externa.a * interna.c + externa.c * interna.d,
    d: externa.b * interna.c + externa.d * interna.d,
    e: externa.a * interna.e + externa.c * interna.f + externa.e,
    f: externa.b * interna.e + externa.d * interna.f + externa.f,
  };
}

export function matrizTranslacao(x: number, y: number): PptxMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

export function matrizEscala(x: number, y: number): PptxMatrix {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
}

export function matrizRotacao(graus: number): PptxMatrix {
  const rad = (graus * Math.PI) / 180;
  return { a: Math.cos(rad), b: Math.sin(rad), c: -Math.sin(rad), d: Math.cos(rad), e: 0, f: 0 };
}

function aoRedorDoCentro(transform: PptxMatrix, centro: PptxPointEmu): PptxMatrix {
  return multiplicarMatrizes(
    matrizTranslacao(centro.x, centro.y),
    multiplicarMatrizes(transform, matrizTranslacao(-centro.x, -centro.y)),
  );
}

/** Mapeia o espaço dos filhos (`chOff/chExt`) para o espaço do grupo, incluindo rotate/flip. */
export function matrizDoGrupo(args: {
  off: PptxPointEmu;
  ext: PptxSizeEmu;
  chOff: PptxPointEmu;
  chExt: PptxSizeEmu;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}): PptxMatrix {
  const scaleX = args.chExt.cx === 0 ? 1 : args.ext.cx / args.chExt.cx;
  const scaleY = args.chExt.cy === 0 ? 1 : args.ext.cy / args.chExt.cy;
  let base = multiplicarMatrizes(
    matrizTranslacao(args.off.x, args.off.y),
    multiplicarMatrizes(matrizEscala(scaleX, scaleY), matrizTranslacao(-args.chOff.x, -args.chOff.y)),
  );
  const centro = { x: args.off.x + args.ext.cx / 2, y: args.off.y + args.ext.cy / 2 };
  if (args.flipH || args.flipV) {
    base = multiplicarMatrizes(aoRedorDoCentro(matrizEscala(args.flipH ? -1 : 1, args.flipV ? -1 : 1), centro), base);
  }
  if (args.rotation) base = multiplicarMatrizes(aoRedorDoCentro(matrizRotacao(args.rotation), centro), base);
  return base;
}

export function aplicarMatriz(matriz: PptxMatrix, ponto: PptxPointEmu): PptxPointEmu {
  return {
    x: matriz.a * ponto.x + matriz.c * ponto.y + matriz.e,
    y: matriz.b * ponto.x + matriz.d * ponto.y + matriz.f,
  };
}

export interface RetanguloTransformado {
  off: PptxPointEmu;
  ext: PptxSizeEmu;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
}

/**
 * Decompõe a transformação mundial sem achatar rotação/flip. `off/ext` representam a caixa
 * pré-rotação no espaço do slide; rotation/flip são mantidos para o renderizador CSS.
 */
export function transformarRetangulo(
  matrizPai: PptxMatrix,
  off: PptxPointEmu,
  ext: PptxSizeEmu,
  rotation = 0,
  flipH = false,
  flipV = false,
): RetanguloTransformado {
  const origem = aplicarMatriz(matrizPai, off);
  const eixoX = aplicarMatriz(matrizPai, { x: off.x + ext.cx, y: off.y });
  const eixoY = aplicarMatriz(matrizPai, { x: off.x, y: off.y + ext.cy });
  const centro = aplicarMatriz(matrizPai, { x: off.x + ext.cx / 2, y: off.y + ext.cy / 2 });
  const vx = { x: eixoX.x - origem.x, y: eixoX.y - origem.y };
  const vy = { x: eixoY.x - origem.x, y: eixoY.y - origem.y };
  const scaleX = Math.hypot(vx.x, vx.y);
  const scaleY = Math.hypot(vy.x, vy.y);
  const rotacaoPai = (Math.atan2(vx.y, vx.x) * 180) / Math.PI;
  const determinante = matrizPai.a * matrizPai.d - matrizPai.b * matrizPai.c;
  const reflexaoPai = determinante < 0;
  return {
    // CSS rotaciona/espelha pelo centro do elemento. Usar a origem transformada como top-left
    // desloca filhos de grupos rotacionados; reconstruir a caixa a partir do centro preserva
    // exatamente o pivô OOXML.
    off: { x: centro.x - scaleX / 2, y: centro.y - scaleY / 2 },
    ext: { cx: Math.max(1, scaleX), cy: Math.max(1, scaleY) },
    // Com a decomposição R × S, uma reflexão do pai inverte o sentido da rotação local.
    rotation: rotacaoPai + (reflexaoPai ? -rotation : rotation),
    flipH,
    flipV: reflexaoPai ? !flipV : flipV,
  };
}
