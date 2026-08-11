import type { TextoComponente } from "@/lib/validations/slide-componentes";

const FONTE_MINIMA = 6;
const FONTE_MAXIMA = 300;

function limitarFonte(valor: number): number {
  return Math.round(Math.max(FONTE_MINIMA, Math.min(FONTE_MAXIMA, valor)) * 100) / 100;
}

export function calcularEscalaDaCaixa(
  origem: { w: number; h: number },
  destino: { w: number; h: number },
): number {
  const diagonalOrigem = Math.hypot(origem.w, origem.h);
  const diagonalDestino = Math.hypot(destino.w, destino.h);
  return diagonalOrigem > 0 ? diagonalDestino / diagonalOrigem : 1;
}

/** Escala a fonte base e os runs explícitos junto com a caixa de texto. */
export function tipografiaAoRedimensionar(
  componente: TextoComponente,
  novoW: number,
  novoH: number,
): Pick<TextoComponente, "fontSize" | "richText"> {
  const escala = calcularEscalaDaCaixa(componente, { w: novoW, h: novoH });
  return {
    fontSize: limitarFonte((componente.fontSize ?? 16) * escala),
    richText: componente.richText
      ? {
          paragraphs: componente.richText.paragraphs.map((paragrafo) => ({
            ...paragrafo,
            runs: paragrafo.runs.map((run) => ({
              ...run,
              ...(run.fontSize !== undefined ? { fontSize: limitarFonte(run.fontSize * escala) } : {}),
            })),
          })),
        }
      : undefined,
  };
}
