/**
 * Fase 07 (Alpha Motion) - Color Fill (Secao 8 do prompt original). Conceitualmente e um
 * Wipe de cor de fundo - reaproveita a MESMA tecnica de clip-path de
 * src/lib/apresentacoes/transicoes/wipe.ts (Fase 05), adaptada para as 7 direcoes pedidas
 * (a diagonal e nova, sem equivalente direto no catalogo de Wipe de slides).
 */
export const TIPO_COLOR_FILL = [
  "left-to-right",
  "right-to-left",
  "top-to-bottom",
  "bottom-to-top",
  "center-out",
  "radial",
  "diagonal",
] as const;
export type TipoColorFill = (typeof TIPO_COLOR_FILL)[number];

/** `progresso` vai de 0 (sem preenchimento) a 1 (totalmente preenchido) - interpolavel pelo Framer Motion como clipPath. */
export function clipPathParaColorFill(tipo: TipoColorFill, progresso: number): string {
  const p = Math.min(1, Math.max(0, progresso));
  const pct = p * 100;

  switch (tipo) {
    case "left-to-right":
      return `inset(0 ${100 - pct}% 0 0)`;
    case "right-to-left":
      return `inset(0 0 0 ${100 - pct}%)`;
    case "top-to-bottom":
      return `inset(0 0 ${100 - pct}% 0)`;
    case "bottom-to-top":
      return `inset(${100 - pct}% 0 0 0)`;
    case "center-out": {
      const metade = (100 - pct) / 2;
      return `inset(${metade}% ${metade}% ${metade}% ${metade}%)`;
    }
    case "radial":
      return `circle(${pct}% at 50% 50%)`;
    case "diagonal":
      return `polygon(0 0, ${pct}% 0, 0 ${pct}%)`;
    default:
      // Fallback seguro (Secao 29) - nunca deforma, apenas nao preenche ate o fim.
      return `inset(0 ${100 - pct}% 0 0)`;
  }
}
