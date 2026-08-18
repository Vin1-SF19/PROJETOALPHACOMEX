import type { FormaVarianteTipo } from "@/lib/validations/slide-componentes-basicos";

/** Catálogo de 40 formas decorativas — cada entrada é um `path`/`polygon`/`ellipse` SVG num
 * viewBox 0-100x100 (escala junto com w/h do componente via `viewBox` + preserveAspectRatio
 * "none"), mesma técnica de SVG on-the-fly já usada em `RenderDivisor`/`geometria.ts`. Rótulos
 * em português para a sidebar; `desenho` é o elemento SVG interno completo (sem cor — cor vem
 * de `fill`/`stroke` aplicados pelo renderer). */
export interface FormaCatalogoEntry {
  label: string;
  /** JSX-like: elemento SVG interno como string de path/pontos, consumido por `RenderForma`. */
  tipoElemento: "path" | "polygon" | "ellipse" | "rect";
  d?: string;
  points?: string;
}

function estrela(pontas: number, raioInterno: number): string {
  const passos = pontas * 2;
  const pontos: string[] = [];
  for (let i = 0; i < passos; i += 1) {
    const raio = i % 2 === 0 ? 50 : raioInterno;
    const angulo = (Math.PI * i) / passos * 2 - Math.PI / 2;
    const x = 50 + raio * Math.cos(angulo);
    const y = 50 + raio * Math.sin(angulo);
    pontos.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pontos.join(" ");
}

function poligonoRegular(lados: number, rotacaoGraus = -90): string {
  const pontos: string[] = [];
  for (let i = 0; i < lados; i += 1) {
    const angulo = (rotacaoGraus + (360 / lados) * i) * (Math.PI / 180);
    const x = 50 + 48 * Math.cos(angulo);
    const y = 50 + 48 * Math.sin(angulo);
    pontos.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return pontos.join(" ");
}

export const FORMAS_CATALOGO: Record<FormaVarianteTipo, FormaCatalogoEntry> = {
  retangulo: { label: "Retângulo", tipoElemento: "rect", d: undefined },
  retanguloArredondado: { label: "Retângulo arredondado", tipoElemento: "rect" },
  circulo: { label: "Círculo", tipoElemento: "ellipse" },
  elipse: { label: "Elipse", tipoElemento: "ellipse" },
  triangulo: { label: "Triângulo", tipoElemento: "polygon", points: "50,2 98,98 2,98" },
  trianguloInvertido: { label: "Triângulo invertido", tipoElemento: "polygon", points: "2,2 98,2 50,98" },
  losango: { label: "Losango", tipoElemento: "polygon", points: "50,2 98,50 50,98 2,50" },
  pentagono: { label: "Pentágono", tipoElemento: "polygon", points: poligonoRegular(5) },
  hexagono: { label: "Hexágono", tipoElemento: "polygon", points: poligonoRegular(6, -90) },
  heptagono: { label: "Heptágono", tipoElemento: "polygon", points: poligonoRegular(7) },
  octogono: { label: "Octógono", tipoElemento: "polygon", points: poligonoRegular(8, -90 + 22.5) },
  estrela4: { label: "Estrela 4 pontas", tipoElemento: "polygon", points: estrela(4, 20) },
  estrela5: { label: "Estrela 5 pontas", tipoElemento: "polygon", points: estrela(5, 22) },
  estrela6: { label: "Estrela 6 pontas", tipoElemento: "polygon", points: estrela(6, 26) },
  estrela8: { label: "Estrela 8 pontas", tipoElemento: "polygon", points: estrela(8, 30) },
  "seta-direita": { label: "Seta para direita", tipoElemento: "polygon", points: "2,35 60,35 60,15 98,50 60,85 60,65 2,65" },
  "seta-esquerda": { label: "Seta para esquerda", tipoElemento: "polygon", points: "98,35 40,35 40,15 2,50 40,85 40,65 98,65" },
  "seta-cima": { label: "Seta para cima", tipoElemento: "polygon", points: "35,98 35,40 15,40 50,2 85,40 65,40 65,98" },
  "seta-baixo": { label: "Seta para baixo", tipoElemento: "polygon", points: "35,2 35,60 15,60 50,98 85,60 65,60 65,2" },
  "setaDupla-horizontal": { label: "Seta dupla horizontal", tipoElemento: "polygon", points: "2,50 22,30 22,42 78,42 78,30 98,50 78,70 78,58 22,58 22,70" },
  "setaDupla-vertical": { label: "Seta dupla vertical", tipoElemento: "polygon", points: "50,2 70,22 58,22 58,78 70,78 50,98 30,78 42,78 42,22 30,22" },
  coracao: { label: "Coração", tipoElemento: "path", d: "M50,88 C20,65 2,45 2,26 C2,10 15,2 27,2 C38,2 46,9 50,18 C54,9 62,2 73,2 C85,2 98,10 98,26 C98,45 80,65 50,88 Z" },
  balaoFala: { label: "Balão de fala", tipoElemento: "path", d: "M4,10 h92 a4,4 0 0 1 4,4 v56 a4,4 0 0 1 -4,4 h-58 l-16,20 v-20 h-18 a4,4 0 0 1 -4,-4 v-56 a4,4 0 0 1 4,-4 Z" },
  balaoPensamento: { label: "Balão de pensamento", tipoElemento: "path", d: "M50,8 C25,8 6,24 6,44 C6,60 18,72 35,76 C33,80 28,84 22,86 C30,88 40,86 46,80 C47,80 49,80 50,80 C75,80 94,64 94,44 C94,24 75,8 50,8 Z" },
  cruz: { label: "Cruz", tipoElemento: "polygon", points: "35,2 65,2 65,35 98,35 98,65 65,65 65,98 35,98 35,65 2,65 2,35 35,35" },
  meiaLua: { label: "Meia-lua", tipoElemento: "path", d: "M60,4 A46,46 0 1 0 60,96 A36,36 0 1 1 60,4 Z" },
  raio: { label: "Raio", tipoElemento: "polygon", points: "58,2 20,55 45,55 38,98 82,42 55,42" },
  nuvem: { label: "Nuvem", tipoElemento: "path", d: "M25,75 A18,18 0 0 1 22,40 A22,22 0 0 1 63,25 A20,20 0 0 1 90,45 A16,16 0 0 1 86,75 Z" },
  gota: { label: "Gota", tipoElemento: "path", d: "M50,2 C70,30 90,50 90,68 A40,40 0 1 1 10,68 C10,50 30,30 50,2 Z" },
  escudo: { label: "Escudo", tipoElemento: "path", d: "M50,2 L92,16 V50 C92,74 74,90 50,98 C26,90 8,74 8,50 V16 Z" },
  hexagonoAlongado: { label: "Hexágono alongado", tipoElemento: "polygon", points: "20,2 80,2 98,50 80,98 20,98 2,50" },
  paralelogramo: { label: "Paralelogramo", tipoElemento: "polygon", points: "25,2 98,2 75,98 2,98" },
  trapezio: { label: "Trapézio", tipoElemento: "polygon", points: "25,2 75,2 98,98 2,98" },
  pentagonoSeta: { label: "Pentágono seta", tipoElemento: "polygon", points: "2,2 70,2 98,50 70,98 2,98" },
  engrenagem: { label: "Engrenagem", tipoElemento: "path", d: "M42,2 h16 l3,14 a36,36 0 0 1 12,7 l13,-7 l11,11 l-7,13 a36,36 0 0 1 7,12 l14,3 v16 l-14,3 a36,36 0 0 1 -7,12 l7,13 l-11,11 l-13,-7 a36,36 0 0 1 -12,7 l-3,14 h-16 l-3,-14 a36,36 0 0 1 -12,-7 l-13,7 l-11,-11 l7,-13 a36,36 0 0 1 -7,-12 l-14,-3 v-16 l14,-3 a36,36 0 0 1 7,-12 l-7,-13 l11,-11 l13,7 a36,36 0 0 1 12,-7 Z M50,36 a14,14 0 1 0 0,28 a14,14 0 1 0 0,-28 Z" },
  explosao: { label: "Explosão", tipoElemento: "polygon", points: estrela(12, 38) },
  fitaHorizontal: { label: "Fita horizontal", tipoElemento: "polygon", points: "2,20 98,20 98,80 70,60 30,60 2,80" },
  placaSuspensa: { label: "Placa suspensa", tipoElemento: "path", d: "M35,2 h6 v10 h-6 Z M59,2 h6 v10 h-6 Z M10,16 h80 a6,6 0 0 1 6,6 v60 a6,6 0 0 1 -6,6 h-80 a6,6 0 0 1 -6,-6 v-60 a6,6 0 0 1 6,-6 Z" },
  octogonoStop: { label: "Octógono (placa)", tipoElemento: "polygon", points: poligonoRegular(8, -90 + 22.5) },
  arco: { label: "Arco", tipoElemento: "path", d: "M2,98 A48,48 0 0 1 98,98 Z" },
  anel: { label: "Anel", tipoElemento: "path", d: "M50,2 A48,48 0 1 1 49.99,2 Z M50,22 A28,28 0 1 0 50.01,22 Z" },
};
