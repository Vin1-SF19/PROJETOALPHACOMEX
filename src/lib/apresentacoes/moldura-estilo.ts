import type { CSSProperties } from "react";

/** Fração de cada lado do SVG original tratada como "espessura da borda" no slice do
 * `border-image` — o resto (miolo) fica sem imagem, deixando o conteúdo por trás aparecer.
 * 0.22 funciona bem na maioria das molduras do catálogo (nem corta ornamentos finos, nem
 * invade demais o miolo de molduras grossas). */
const FATIA_BORDA = 0.22;

/**
 * Estilo de moldura via CSS `border-image`: a arte é fatiada em 9 partes e cada lado
 * estica/repete só ao longo do seu próprio lado — ao contrário de uma `<img>` com
 * `objectFit: "fill"` (que distorce o desenho inteiro para caber no retângulo do slide, não
 * "envolve" as bordas), o miolo nunca é coberto e as bordas acompanham o perímetro real,
 * independente da proporção do slide.
 *
 * `border-width` do CSS não aceita `%` (a spec exige comprimento absoluto) — por isso recebe
 * `larguraPx`/`alturaPx` do elemento real e calcula a espessura em `px` a partir do menor lado.
 * Sem cor customizada por ora: recolorir um `border-image` de forma consistente entre
 * navegadores (via `mask-border`) não tem suporte confiável no Firefox — decisão consciente de
 * manter a cor original do SVG aqui até existir uma técnica validada visualmente.
 */
export function estiloBordaMoldura(src: string, larguraPx: number, alturaPx: number): CSSProperties {
  const espessura = Math.round(Math.min(larguraPx, alturaPx) * FATIA_BORDA);
  return {
    borderStyle: "solid",
    borderWidth: `${espessura}px`,
    borderImageSource: `url(${JSON.stringify(src)})`,
    borderImageSlice: `${Math.round(FATIA_BORDA * 100)} fill`,
    borderImageRepeat: "stretch",
    boxSizing: "border-box",
  };
}
