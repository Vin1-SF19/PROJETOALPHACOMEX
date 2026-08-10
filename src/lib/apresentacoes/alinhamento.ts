export interface CaixaAlinhamento {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotacao?: number;
}

export interface GuiasAlinhamento {
  verticais: number[];
  horizontais: number[];
}

export interface ResultadoAlinhamento {
  deltaX: number;
  deltaY: number;
  guias: GuiasAlinhamento;
}

const LIMIAR_PADRAO = 6;

interface Limites {
  esquerda: number;
  topo: number;
  direita: number;
  base: number;
}

function limitesDaCaixa(caixa: CaixaAlinhamento): Limites {
  const angulo = ((caixa.rotacao ?? 0) * Math.PI) / 180;
  const larguraVisual = Math.abs(caixa.w * Math.cos(angulo)) + Math.abs(caixa.h * Math.sin(angulo));
  const alturaVisual = Math.abs(caixa.w * Math.sin(angulo)) + Math.abs(caixa.h * Math.cos(angulo));
  const centroX = caixa.x + caixa.w / 2;
  const centroY = caixa.y + caixa.h / 2;
  return {
    esquerda: centroX - larguraVisual / 2,
    topo: centroY - alturaVisual / 2,
    direita: centroX + larguraVisual / 2,
    base: centroY + alturaVisual / 2,
  };
}

function unirLimites(caixas: CaixaAlinhamento[]): Limites | null {
  if (caixas.length === 0) return null;
  const limites = caixas.map(limitesDaCaixa);
  return {
    esquerda: Math.min(...limites.map((item) => item.esquerda)),
    topo: Math.min(...limites.map((item) => item.topo)),
    direita: Math.max(...limites.map((item) => item.direita)),
    base: Math.max(...limites.map((item) => item.base)),
  };
}

function ancorasX(limites: Limites): number[] {
  return [limites.esquerda, (limites.esquerda + limites.direita) / 2, limites.direita];
}

function ancorasY(limites: Limites): number[] {
  return [limites.topo, (limites.topo + limites.base) / 2, limites.base];
}

function encontrarAjuste(origens: number[], destinos: number[], limiar: number): { ajuste: number; guias: number[] } | null {
  let melhor: { ajuste: number; guia: number } | null = null;
  for (const origem of origens) {
    for (const destino of destinos) {
      const ajuste = destino - origem;
      if (Math.abs(ajuste) > limiar) continue;
      if (!melhor || Math.abs(ajuste) < Math.abs(melhor.ajuste)) melhor = { ajuste, guia: destino };
    }
  }
  if (!melhor) return null;
  const guias = destinos.filter((destino) => origens.some((origem) => Math.abs(destino - origem - melhor!.ajuste) < 0.01));
  return { ajuste: melhor.ajuste, guias: [...new Set(guias)] };
}

/**
 * Calcula magnetismo entre as bordas/centros da selecao em movimento, outros elementos
 * e o proprio slide. As coordenadas retornadas sao logicas, antes do zoom do editor.
 */
export function calcularAlinhamentoMagnetico({
  caixasMoveis,
  referencias,
  canvas,
  deltaX,
  deltaY,
  limiar = LIMIAR_PADRAO,
}: {
  caixasMoveis: CaixaAlinhamento[];
  referencias: CaixaAlinhamento[];
  canvas: { width: number; height: number };
  deltaX: number;
  deltaY: number;
  limiar?: number;
}): ResultadoAlinhamento {
  const grupo = unirLimites(caixasMoveis);
  if (!grupo) return { deltaX, deltaY, guias: { verticais: [], horizontais: [] } };

  const referenciasComSlide = [
    ...referencias,
    { id: "__slide__", x: 0, y: 0, w: canvas.width, h: canvas.height },
  ];
  const limitesReferencias = referenciasComSlide.map(limitesDaCaixa);
  const movido: Limites = {
    esquerda: grupo.esquerda + deltaX,
    direita: grupo.direita + deltaX,
    topo: grupo.topo + deltaY,
    base: grupo.base + deltaY,
  };
  const ajusteX = encontrarAjuste(ancorasX(movido), limitesReferencias.flatMap(ancorasX), limiar);
  const ajusteY = encontrarAjuste(ancorasY(movido), limitesReferencias.flatMap(ancorasY), limiar);

  return {
    deltaX: deltaX + (ajusteX?.ajuste ?? 0),
    deltaY: deltaY + (ajusteY?.ajuste ?? 0),
    guias: {
      verticais: ajusteX?.guias ?? [],
      horizontais: ajusteY?.guias ?? [],
    },
  };
}
