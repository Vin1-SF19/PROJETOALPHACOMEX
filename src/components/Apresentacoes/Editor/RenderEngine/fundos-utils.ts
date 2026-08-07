/** Converte "#RRGGBB"/"#RGB" em "R, G, B" — convenção usada pelos fundos originais (`rgba(${accentRgb}, x)`). */
export function hexParaRgb(hex: string, fallback = "79, 70, 229"): string {
  const limpo = hex.replace("#", "").trim();
  const expandido = limpo.length === 3 ? limpo.split("").map((c) => c + c).join("") : limpo;
  const bigint = Number.parseInt(expandido, 16);
  if (expandido.length !== 6 || Number.isNaN(bigint)) return fallback;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

/**
 * Hash simples de string → inteiro positivo, usado como semente determinística.
 * O Container Alpha (animação de entrada) monta uma PRÉVIA do slide dentro da porta
 * (`SlidePortalPreview`) ao mesmo tempo que o slide real já está montado por baixo —
 * são 2 instâncias React independentes do MESMO componente. Sem uma seed fixa por
 * `componente.id`, cada instância sorteia posições diferentes com `Math.random()`, e o
 * campo de estrelas/blips/âncoras "pula" de lugar no instante em que a prévia dá lugar
 * ao slide real. Mesma seed nas duas instâncias = mesmo layout, sem pulo visual.
 */
export function hashStringParaSeed(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

/** Mesmo gerador congruente linear usado em CosmosIAlphaFundo.tsx, extraído para reuso. */
export function criarGeradorSeed(seed: number) {
  let atual = seed;
  return () => {
    atual = (atual * 1664525 + 1013904223) % 4294967296;
    return atual / 4294967296;
  };
}
