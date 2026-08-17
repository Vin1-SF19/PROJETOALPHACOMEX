import type { MolduraImagemTipo } from "@/lib/validations/slide-componentes-basicos";

/** Catálogo de 20 molduras (frames) para imagem — cada uma é um clip-path SVG (viewBox
 * 0-100x100, mesma técnica de `formas-catalogo.ts`) aplicado à imagem inteira via
 * `<clipPath>` + `RenderImagem`. "nenhuma" = sem moldura (retângulo padrão, comportamento
 * anterior). A lista de tipos vive no schema Zod (`slide-componentes-basicos.ts`) — este
 * catálogo só desenha, nunca redeclara os tipos, para as duas fontes nunca divergirem. */

export interface MolduraCatalogoEntry {
  label: string;
  /** `undefined` = sem clip (moldura "nenhuma"). Path em viewBox 0-100x100. */
  clipPathD?: string;
}

export const MOLDURAS_CATALOGO: Record<MolduraImagemTipo, MolduraCatalogoEntry> = {
  nenhuma: { label: "Nenhuma (retângulo)" },
  circulo: { label: "Círculo", clipPathD: "M50,2 A48,48 0 1 1 49.99,2 Z" },
  retanguloArredondado: { label: "Cantos arredondados", clipPathD: "M14,2 H86 A12,12 0 0 1 98,14 V86 A12,12 0 0 1 86,98 H14 A12,12 0 0 1 2,86 V14 A12,12 0 0 1 14,2 Z" },
  retanguloArredondadoGrande: { label: "Cantos bem arredondados", clipPathD: "M28,2 H72 A26,26 0 0 1 98,28 V72 A26,26 0 0 1 72,98 H28 A26,26 0 0 1 2,72 V28 A26,26 0 0 1 28,2 Z" },
  elipse: { label: "Elipse", clipPathD: "M50,4 C78,4 96,24 96,50 C96,76 78,96 50,96 C22,96 4,76 4,50 C4,24 22,4 50,4 Z" },
  triangulo: { label: "Triângulo", clipPathD: "M50,2 98,98 2,98 Z" },
  losango: { label: "Losango", clipPathD: "M50,2 98,50 50,98 2,50 Z" },
  pentagono: { label: "Pentágono", clipPathD: "M50,2 97.5,36.5 79.6,90.5 20.4,90.5 2.5,36.5 Z" },
  hexagono: { label: "Hexágono", clipPathD: "M25,6 75,6 98,50 75,94 25,94 2,50 Z" },
  octogono: { label: "Octógono", clipPathD: "M30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30 Z" },
  estrela5: { label: "Estrela 5 pontas", clipPathD: "M50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38 Z" },
  estrela6: { label: "Estrela 6 pontas", clipPathD: "M50,2 61,26 87,13 78,40 98,50 78,60 87,87 61,74 50,98 39,74 13,87 22,60 2,50 22,40 13,13 39,26 Z" },
  coracao: { label: "Coração", clipPathD: "M50,88 C20,65 2,45 2,26 C2,10 15,2 27,2 C38,2 46,9 50,18 C54,9 62,2 73,2 C85,2 98,10 98,26 C98,45 80,65 50,88 Z" },
  escudo: { label: "Escudo", clipPathD: "M50,2 92,16 92,50 C92,74 74,90 50,98 26,90 8,74 8,50 8,16 Z" },
  gota: { label: "Gota", clipPathD: "M50,2 C70,30 90,50 90,68 A40,40 0 1 1 10,68 C10,50 30,30 50,2 Z" },
  nuvem: { label: "Nuvem", clipPathD: "M25,75 A18,18 0 0 1 22,40 A22,22 0 0 1 63,25 A20,20 0 0 1 90,45 A16,16 0 0 1 86,75 Z" },
  hexagonoAlongado: { label: "Hexágono alongado", clipPathD: "M20,2 80,2 98,50 80,98 20,98 2,50 Z" },
  arco: { label: "Arco", clipPathD: "M2,98 A48,48 0 0 1 98,98 Z" },
  anel: { label: "Anel (moldura vazada)", clipPathD: "M50,2 A48,48 0 1 1 49.99,2 Z M50,22 A28,28 0 1 0 50.01,22 Z" },
  explosao: { label: "Explosão", clipPathD: "M50,2 58,20 76,8 76,28 96,24 88,42 100,50 88,58 96,76 76,72 76,92 58,80 50,98 42,80 24,92 24,72 4,76 12,58 0,50 12,42 4,24 24,28 24,8 42,20 Z" },
  cruz: { label: "Cruz", clipPathD: "M35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35 Z" },
};
