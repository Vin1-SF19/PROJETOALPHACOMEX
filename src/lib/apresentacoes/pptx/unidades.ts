import type { RetanguloExtraido } from "./tipos";

/** EMU (English Metric Units) é a unidade nativa do OOXML — 914400 EMU = 1 polegada. */
export const EMU_POR_POLEGADA = 914400;

/** Tamanho de slide 16:9 padrão do PowerPoint moderno — usado só como fallback se o
 * `.pptx` não tiver `<p:sldSz>` legível em `ppt/presentation.xml` (não deveria acontecer
 * num arquivo válido, mas evita divisão por zero num arquivo corrompido/incomum). */
export const SLIDE_SIZE_FALLBACK_EMU = { cx: 12192000, cy: 6858000 };

export interface EscalaPptx {
  escala: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Escala UNIFORME (sem distorcer proporção) que encaixa o slide PPTX inteiro dentro do canvas
 * de destino — mesma lógica de "contain" de imagem. Quando a proporção do PPTX original não
 * bate exatamente com a do canvas de destino (ex.: PPTX 4:3 importado num canvas 16:9), sobra
 * espaço de um dos lados — `offsetX`/`offsetY` centralizam o conteúdo nesse espaço, evitando
 * cortar ou esticar formas.
 */
export function calcularEscalaPptx(
  slideSizeEmu: { cx: number; cy: number },
  canvas: { width: number; height: number },
): EscalaPptx {
  const escala = Math.min(canvas.width / slideSizeEmu.cx, canvas.height / slideSizeEmu.cy);
  const larguraFinal = slideSizeEmu.cx * escala;
  const alturaFinal = slideSizeEmu.cy * escala;
  return {
    escala,
    offsetX: (canvas.width - larguraFinal) / 2,
    offsetY: (canvas.height - alturaFinal) / 2,
  };
}

/** Converte um retângulo em EMU (posição+tamanho, como aparece em `<a:xfrm>`) pro canvas de destino.
 * Não inclui `rotacao` — quem chama já tem o valor bruto (lido junto do `<a:xfrm>`) e o anexa depois. */
export function converterRetanguloEmu(
  off: { x: number; y: number },
  ext: { cx: number; cy: number },
  escalaInfo: EscalaPptx,
): Omit<RetanguloExtraido, "rotacao"> {
  return {
    x: Math.round(off.x * escalaInfo.escala + escalaInfo.offsetX),
    y: Math.round(off.y * escalaInfo.escala + escalaInfo.offsetY),
    w: Math.max(1, Math.round(ext.cx * escalaInfo.escala)),
    h: Math.max(1, Math.round(ext.cy * escalaInfo.escala)),
  };
}

/** EMU → pontos de fonte (1pt = 12700 EMU) — usado só quando o tamanho vem em EMU; o caso comum
 * (`<a:rPr sz="...">`) já vem em centésimos de ponto, tratado direto onde é lido. */
export function emuParaPt(emu: number): number {
  return emu / 12700;
}
