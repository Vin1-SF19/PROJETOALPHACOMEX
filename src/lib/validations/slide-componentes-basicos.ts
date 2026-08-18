import { z } from "zod";
import { baseComponenteSchema } from "./slide-componentes-base";

export const textoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("texto"),
  texto: z.string(),
  tag: z.enum(["h1", "h2", "p", "span"]),
  corTexto: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  alinhamento: z.enum(["left", "center", "right", "justify"]).optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textDecoration: z.string().optional(),
  lineHeight: z.number().positive().optional(),
  letterSpacing: z.number().optional(),
  padding: z.object({ left: z.number(), right: z.number(), top: z.number(), bottom: z.number() }).optional(),
  verticalAlign: z.enum(["top", "middle", "bottom"]).optional(),
  wrap: z.boolean().optional(),
  autofit: z.enum(["none", "normal", "shape"]).optional(),
  richText: z.object({
    paragraphs: z.array(z.object({
      alignment: z.enum(["left", "center", "right", "justify"]).optional(),
      level: z.number().int().nonnegative().optional(),
      marginLeft: z.number().optional(),
      indent: z.number().optional(),
      lineSpacing: z.number().optional(),
      spaceBefore: z.number().optional(),
      spaceAfter: z.number().optional(),
      bullet: z.string().optional(),
      numbering: z.object({ type: z.string(), startAt: z.number().int().optional() }).optional(),
      tabs: z.array(z.number()).optional(),
      runs: z.array(z.object({
        text: z.string(),
        fontFamily: z.string().optional(),
        fontSize: z.number().positive().optional(),
        bold: z.boolean().optional(),
        italic: z.boolean().optional(),
        underline: z.string().optional(),
        strike: z.string().optional(),
        color: z.string().optional(),
        baseline: z.number().optional(),
        tracking: z.number().optional(),
        caps: z.string().optional(),
        hyperlink: z.string().optional(),
      })),
    })),
  }).optional(),
});

/** 82 variantes de moldura decorativa REAL (ilustração vetorial CC0/domínio público, catálogo
 * em `molduras-catalogo.ts` → arquivo SVG em `public/molduras/`) — usadas tanto pelo elemento
 * independente "moldura" (arrastável, desenha a arte por cima de qualquer coisa) quanto pela
 * moldura do SLIDE inteiro (`canvasConfigSchema`). Uma única lista para as duas nunca divergirem. */
export const MOLDURA_TIPOS = [
  "nenhuma", "borda-classica", "borda-clean", "borda-elegante", "borda-simples",
  "circulo-decorado", "decorativa-classica", "decorativa-simples", "espiral-decorativa",
  "floral-classica", "floral-decorativa", "floral-fluorescencia", "floral-narciso",
  "floral-vintage-prismatica", "floral-vintage-silhueta", "geometrica-fina",
  "ornamental-classica", "ornamental-quadrada", "ornamental-renovada",
  "ornamental-silhueta-2", "quadro-colorido",
  "borda-retrato", "circulo-arame-farpado", "elipse-arame-farpado", "triangulo-arame-farpado",
  "moldura-preta", "moldura-azul", "borda-fina-118", "borda-fina-53", "borda-fina-54",
  "borda-fina-55", "borda-fina-57", "borda-fina-60", "borda-fina-62", "borda-fina-63",
  "borda-fina-64", "borda-fina-66", "borda-fina-69", "borda-fina-70", "borda-fina-71",
  "borda-fina-74", "borda-fina-75", "borda-fina-77", "borda-fina-80",
  "moldura-quadro-simples", "circulo-ornamental-colorido", "circulo-quadrado-duplo",
  "borda-cidade", "ornamental-decorativa-2", "ornamental-renovada-2", "ornamental-renovada-3",
  "ornamental-renovada-4", "borda-fogo", "borda-floral-2", "floral-flourish",
  "floral-vintage-10", "floral-vintage-2", "floral-vintage-4", "floral-vintage-7",
  "moldura-classica-2", "moldura-contorno-2", "ornamental-renovada-5", "floco-neve-dourado",
  "grega-grande-2", "grega-grande", "moldura-verde", "moldura-espelho", "moldura-filme",
  "vintage-linha-arte", "moldura-foto", "foto-cantos-antigos", "moldura-quadro",
  "redonda-vintage", "moldura-tripla", "caligrafia-vintage", "vintage-estendida",
  "vintage-estendida-10", "vintage-estendida-14", "vintage-estendida-18",
  "vintage-estendida-2", "vintage-estendida-7", "vintage-folhas-uva", "borda-vime",
] as const;
export type MolduraTipo = (typeof MOLDURA_TIPOS)[number];

/** As 20 variantes REAIS de desenho (exclui "nenhuma", que só faz sentido como opção "sem
 * moldura" do SLIDE — um elemento "moldura" real no canvas sempre tem um desenho concreto). */
export const MOLDURA_VARIANTE_TIPOS = MOLDURA_TIPOS.filter((tipo): tipo is Exclude<MolduraTipo, "nenhuma"> => tipo !== "nenhuma");
export type MolduraVarianteTipo = (typeof MOLDURA_VARIANTE_TIPOS)[number];

export const imagemComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("imagem"),
  url: z.string(),
  alt: z.string().optional(),
  objectFit: z.enum(["cover", "contain", "fill"]).optional(),
  crop: z.object({
    left: z.number().min(0).max(0.999),
    top: z.number().min(0).max(0.999),
    right: z.number().min(0).max(0.999),
    bottom: z.number().min(0).max(0.999),
  }).optional(),
  tile: z.boolean().optional(),
});

/** Moldura decorativa REAL (ilustração vetorial pronta — floral, ornamental, vintage — não
 * geometria matemática). Cada `variante` referencia um arquivo SVG de arte em
 * `public/molduras/` (catálogo em `molduras-catalogo.ts`). A cor original vem desenhada no
 * arquivo; `corFiltro` (opcional) recolore via overlay `mix-blend-mode: color` + CSS mask
 * (ver `RenderMoldura` em `RenderBasicos.tsx`) sem reescrever o SVG — "nenhuma"/ausente
 * preserva a cor original do arquivo. */
export const molduraComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("moldura"),
  variante: z.enum(MOLDURA_VARIANTE_TIPOS),
  corFiltro: z.string().optional(),
});

/** Vídeo HTML5 nativo — mesmo padrão de imagem (URL, sem upload próprio nesta onda). */
export const videoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("video"),
  url: z.string(),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  controles: z.boolean().default(true),
  muted: z.boolean().default(true),
});

export const audioComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("audio"),
  url: z.string(),
  titulo: z.string().default("Áudio"),
  autoplay: z.boolean().default(false),
  loop: z.boolean().default(false),
  controles: z.boolean().default(true),
});

export const botaoComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("botao"),
  texto: z.string(),
  corFundo: z.string().optional(),
  corTexto: z.string().optional(),
  borderRadius: z.number().optional(),
  href: z.string().optional(),
});

export const iconeComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("icone"),
  nomeIcone: z.string(),
  cor: z.string().optional(),
  tamanhoIcone: z.number().optional(),
});

export const divisorComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("divisor"),
  cor: z.string().optional(),
  espessura: z.number().optional(),
  estilo: z.enum(["solid", "dash", "dot", "dashDot"]).optional(),
  cap: z.enum(["butt", "round", "square"]).optional(),
  beginArrow: z.string().optional(),
  endArrow: z.string().optional(),
});

/** 40 variantes de forma decorativa estilo Canva — um único tipo `"forma"` parametrizado por
 * `variante` (catálogo completo em `src/lib/apresentacoes/formas-catalogo.ts`), em vez de 40
 * tipos Zod/case distintos: mesma técnica de SVG on-the-fly já usada em `RenderDivisor`. */
export const FORMA_VARIANTE_TIPOS = [
  "retangulo", "retanguloArredondado", "circulo", "elipse", "triangulo", "trianguloInvertido",
  "losango", "pentagono", "hexagono", "heptagono", "octogono", "estrela4", "estrela5", "estrela6",
  "estrela8", "seta-direita", "seta-esquerda", "seta-cima", "seta-baixo", "setaDupla-horizontal",
  "setaDupla-vertical", "coracao", "balaoFala", "balaoPensamento", "cruz", "meiaLua", "raio",
  "nuvem", "gota", "escudo", "hexagonoAlongado", "paralelogramo", "trapezio", "pentagonoSeta",
  "engrenagem", "explosao", "fitaHorizontal", "placaSuspensa", "octogonoStop", "arco", "anel",
] as const;
export type FormaVarianteTipo = (typeof FORMA_VARIANTE_TIPOS)[number];

export const formaComponenteSchema = baseComponenteSchema.extend({
  tipo: z.literal("forma"),
  variante: z.enum(FORMA_VARIANTE_TIPOS),
  corPreenchimento: z.string().optional(),
  corBorda: z.string().optional(),
  larguraBorda: z.number().nonnegative().optional(),
});
