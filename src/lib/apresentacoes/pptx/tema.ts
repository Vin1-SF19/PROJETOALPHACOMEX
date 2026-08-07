import type JSZip from "jszip";
import {
  acharAlvoPorPrefixo,
  comoArray,
  lerRelacionamentos,
  lerXml,
  resolverBlipPreferido,
  resolverCaminhoRelativo,
  type NoXml,
} from "./xml-utils";
import { resolverCorOoxml, type ColorResolverContext } from "./color-resolver";
import type { PptxResolvedColor } from "./modelo-intermediario";

/**
 * Resolução de cor de tema (`<a:schemeClr>`) e fundo herdado (slide → layout → master) — a
 * maioria dos templates reais do PowerPoint usa cor de tema (não hex direto) pra preencher
 * forma/texto, e fundo de slide costuma vir do master/layout, não do slide em si.
 */

export const SLOTS_ESQUEMA_CORES = [
  "dk1", "lt1", "dk2", "lt2",
  "accent1", "accent2", "accent3", "accent4", "accent5", "accent6",
  "hlink", "folHlink",
] as const;
export type SlotCor = (typeof SLOTS_ESQUEMA_CORES)[number];
export type EsquemaCores = Record<SlotCor, string>;

const ESQUEMA_FALLBACK: EsquemaCores = {
  dk1: "#000000", lt1: "#FFFFFF", dk2: "#44546A", lt2: "#E7E6E6",
  accent1: "#4472C4", accent2: "#ED7D31", accent3: "#A5A5A5",
  accent4: "#FFC000", accent5: "#5B9BD5", accent6: "#70AD47",
  hlink: "#0563C1", folHlink: "#954F72",
};

/** `<p:clrMap bg1="lt1" tx1="dk1" .../>` — mapeia nomes "de uso" (bg1/tx1/bg2/tx2) pros slots reais do tema. */
export type MapaCoresMestre = Record<string, SlotCor>;

const MAPA_FALLBACK: MapaCoresMestre = {
  bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2",
  accent1: "accent1", accent2: "accent2", accent3: "accent3",
  accent4: "accent4", accent5: "accent5", accent6: "accent6",
  hlink: "hlink", folHlink: "folHlink",
  dk1: "dk1", lt1: "lt1", dk2: "dk2", lt2: "lt2",
};

export interface ContextoTema {
  esquemaCores: EsquemaCores;
  mapaCores: MapaCoresMestre;
  /** XML já parseado do master (pra resolver fundo herdado) e do layout (idem). */
  bgMaster: NoXml | null;
  bgLayout: NoXml | null;
  /** Árvore de formas do layout — usada pra herdar posição de placeholders sem `<a:xfrm>` próprio no slide. */
  spTreeLayout: NoXml | null;
  spTreeMaster: NoXml | null;
  layoutXml: NoXml | null;
  masterXml: NoXml | null;
  themeXml: NoXml | null;
  caminhoLayout: string | null;
  caminhoMaster: string | null;
  caminhoTema: string | null;
  relsLayout: Record<string, string>;
  relsMaster: Record<string, string>;
}

function contextoFallback(overrides: Partial<ContextoTema> = {}): ContextoTema {
  return {
    esquemaCores: ESQUEMA_FALLBACK,
    mapaCores: MAPA_FALLBACK,
    bgMaster: null,
    bgLayout: null,
    spTreeLayout: null,
    spTreeMaster: null,
    layoutXml: null,
    masterXml: null,
    themeXml: null,
    caminhoLayout: null,
    caminhoMaster: null,
    caminhoTema: null,
    relsLayout: {},
    relsMaster: {},
    ...overrides,
  };
}

function lerCorSimples(no: NoXml): string | null {
  return resolverCorOoxml(no, { scheme: {}, colorMap: {} })?.hex ?? null;
}

async function lerEsquemaCores(zip: JSZip, caminhoTema: string): Promise<EsquemaCores> {
  const xml = await lerXml(zip, caminhoTema);
  const clrScheme = xml?.["a:theme"]?.["a:themeElements"]?.["a:clrScheme"];
  if (!clrScheme) return ESQUEMA_FALLBACK;

  const esquema = { ...ESQUEMA_FALLBACK };
  for (const slot of SLOTS_ESQUEMA_CORES) {
    const cor = lerCorSimples(clrScheme[`a:${slot}`]);
    if (cor) esquema[slot] = cor;
  }
  return esquema;
}

function lerMapaCores(clrMapNo: NoXml | undefined): MapaCoresMestre {
  if (!clrMapNo) return MAPA_FALLBACK;
  const mapa = { ...MAPA_FALLBACK };
  for (const chave of ["bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"]) {
    const valor = clrMapNo[`@_${chave}`];
    if (typeof valor === "string" && SLOTS_ESQUEMA_CORES.includes(valor as SlotCor)) {
      mapa[chave] = valor as SlotCor;
    }
  }
  return mapa;
}

/**
 * Resolve, a partir de um slide, a cadeia layout→master→tema e devolve tudo que é necessário
 * pra interpretar `<a:schemeClr>` e fundo herdado. Nunca lança — em qualquer falha de leitura,
 * devolve o fallback (esquema de cores padrão do Office), pra um tema não encontrado nunca
 * travar a importação inteira.
 */
export async function resolverContextoTema(zip: JSZip, caminhoSlide: string): Promise<ContextoTema> {
  try {
    const pastaSlide = caminhoSlide.split("/").slice(0, -1).join("/");
    const nomeSlide = caminhoSlide.split("/").pop() ?? "";
    const relsSlide = await lerRelacionamentos(zip, `${pastaSlide}/_rels/${nomeSlide}.rels`);
    const alvoLayout = acharAlvoPorPrefixo(relsSlide, "slideLayouts/");
    if (!alvoLayout) return contextoFallback();

    const caminhoLayout = resolverCaminhoRelativo(caminhoSlide, alvoLayout);
    const layoutXml = await lerXml(zip, caminhoLayout);
    const bgLayout = layoutXml?.["p:sldLayout"]?.["p:cSld"]?.["p:bg"] ?? null;
    const spTreeLayout = layoutXml?.["p:sldLayout"]?.["p:cSld"]?.["p:spTree"] ?? null;

    const pastaLayout = caminhoLayout.split("/").slice(0, -1).join("/");
    const nomeLayout = caminhoLayout.split("/").pop() ?? "";
    const relsLayout = await lerRelacionamentos(zip, `${pastaLayout}/_rels/${nomeLayout}.rels`);
    const alvoMaster = acharAlvoPorPrefixo(relsLayout, "slideMasters/");
    if (!alvoMaster) return contextoFallback({ bgLayout, spTreeLayout, layoutXml, caminhoLayout, relsLayout });

    const caminhoMaster = resolverCaminhoRelativo(caminhoLayout, alvoMaster);
    const masterXml = await lerXml(zip, caminhoMaster);
    const bgMaster = masterXml?.["p:sldMaster"]?.["p:cSld"]?.["p:bg"] ?? null;
    const spTreeMaster = masterXml?.["p:sldMaster"]?.["p:cSld"]?.["p:spTree"] ?? null;
    const mapaCores = lerMapaCores(masterXml?.["p:sldMaster"]?.["p:clrMap"]);

    const pastaMaster = caminhoMaster.split("/").slice(0, -1).join("/");
    const nomeMaster = caminhoMaster.split("/").pop() ?? "";
    const relsMaster = await lerRelacionamentos(zip, `${pastaMaster}/_rels/${nomeMaster}.rels`);
    const alvoTema = acharAlvoPorPrefixo(relsMaster, "theme/");
    if (!alvoTema) return contextoFallback({ mapaCores, bgMaster, bgLayout, spTreeLayout, spTreeMaster, layoutXml, masterXml, caminhoLayout, caminhoMaster, relsLayout, relsMaster });

    const caminhoTema = resolverCaminhoRelativo(caminhoMaster, alvoTema);
    const themeXml = await lerXml(zip, caminhoTema);
    const esquemaCores = await lerEsquemaCores(zip, caminhoTema);
    return contextoFallback({ esquemaCores, mapaCores, bgMaster, bgLayout, spTreeLayout, spTreeMaster, layoutXml, masterXml, themeXml, caminhoLayout, caminhoMaster, caminhoTema, relsLayout, relsMaster });
  } catch (erro) {
    console.error("[pptx/tema] Falha ao resolver tema/layout/master — usando cores padrão do Office", erro);
    return contextoFallback();
  }
}

/**
 * Lê um nó de cor OOXML genérico — `<a:srgbClr val="RRGGBB">` ou `<a:schemeClr val="accent1">`,
 * ambos podendo ter filhos modificadores (`<a:lumMod>`, `<a:shade>` etc.). Devolve `null` se o
 * nó não tiver nenhuma cor reconhecível (`phClr` — cor herdada de um placeholder de estilo — e
 * cores por sistema não mapeadas ficam fora do escopo desta versão).
 */
export function lerCorOoxml(no: NoXml | undefined, contexto: ContextoTema): string | null {
  const colorContext: ColorResolverContext = { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores };
  return resolverCorOoxml(no, colorContext)?.css ?? null;
}

export interface FundoResolvido {
  tipoCor: string | null;
  imagemREmbed: string | null;
  gradientCss?: string;
  gradient?: { angle: number; stops: Array<{ position: number; color: PptxResolvedColor }> };
  sourceLevel?: "slide" | "layout" | "master" | "default";
}

/** Resolve `<p:bg><p:bgPr>` (cor ou imagem) de um nó de fundo já localizado (slide/layout/master). */
export function lerFundo(bgNo: NoXml | null, contexto: ContextoTema, sourceLevel?: FundoResolvido["sourceLevel"]): FundoResolvido | null {
  const bgPr = bgNo?.["p:bgPr"];
  const bgRef = bgNo?.["p:bgRef"];
  if (!bgPr && bgRef) {
    const cor = lerCorOoxml(bgRef, contexto);
    if (cor) return { tipoCor: cor, imagemREmbed: null, sourceLevel };
  }
  if (!bgPr) return null;

  const blip = bgPr["a:blipFill"]?.["a:blip"];
  const rEmbed = resolverBlipPreferido(blip);
  if (typeof rEmbed === "string") return { tipoCor: null, imagemREmbed: rEmbed, sourceLevel };

  const solid = bgPr["a:solidFill"];
  if (solid) {
    const cor = lerCorOoxml(solid, contexto);
    if (cor) return { tipoCor: cor, imagemREmbed: null, sourceLevel };
  }

  const gradStops = comoArray(bgPr["a:gradFill"]?.["a:gsLst"]?.["a:gs"]);
  if (gradStops.length > 0) {
    const stops = gradStops.map((stop) => ({
      position: Math.max(0, Math.min(100, (Number(stop?.["@_pos"]) || 0) / 1000)),
      color: resolverCorOoxml(stop, { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores }),
    })).filter((stop): stop is { position: number; color: PptxResolvedColor } => Boolean(stop.color));
    if (stops.length) {
      const angle = ((Number(bgPr["a:gradFill"]?.["a:lin"]?.["@_ang"]) || 0) / 60000 + 90) % 360;
      return {
        tipoCor: stops[0].color.css,
        imagemREmbed: null,
        gradientCss: `linear-gradient(${angle}deg, ${stops.map((stop) => `${stop.color.css} ${stop.position}%`).join(", ")})`,
        gradient: { angle, stops },
        sourceLevel,
      };
    }
  }

  return null;
}

export interface ReferenciasEstiloResolvidas {
  fill: NoXml | null;
  line: NoXml | null;
  effects: NoXml | null;
  fontFamily: string | null;
  placeholderColor: string | null;
}

function itemPorIndice(value: NoXml | NoXml[] | undefined, index: number): NoXml | null {
  return comoArray<NoXml>(value)[index] ?? null;
}

/** Resolve `p:style` (`fillRef/lnRef/effectRef/fontRef`) no `fmtScheme/fontScheme` do Theme. */
export function resolverReferenciasEstilo(style: NoXml | undefined, contexto: ContextoTema): ReferenciasEstiloResolvidas {
  const themeElements = contexto.themeXml?.["a:theme"]?.["a:themeElements"];
  const fmtScheme = themeElements?.["a:fmtScheme"];
  const fillIndex = Number(style?.["a:fillRef"]?.["@_idx"]);
  const lineIndex = Number(style?.["a:lnRef"]?.["@_idx"]);
  const effectIndex = Number(style?.["a:effectRef"]?.["@_idx"]);
  let fill: NoXml | null = null;
  if (Number.isFinite(fillIndex) && fillIndex > 0) {
    const list = fillIndex >= 1001 ? fmtScheme?.["a:bgFillStyleLst"] : fmtScheme?.["a:fillStyleLst"];
    const index = fillIndex >= 1001 ? fillIndex - 1001 : fillIndex - 1;
    const values = [
      ...comoArray<NoXml>(list?.["a:solidFill"]),
      ...comoArray<NoXml>(list?.["a:gradFill"]),
      ...comoArray<NoXml>(list?.["a:blipFill"]),
      ...comoArray<NoXml>(list?.["a:pattFill"]),
      ...comoArray<NoXml>(list?.["a:noFill"]),
    ];
    fill = values[index] ?? null;
  }
  const line = Number.isFinite(lineIndex) && lineIndex > 0
    ? itemPorIndice(fmtScheme?.["a:lnStyleLst"]?.["a:ln"], lineIndex - 1)
    : null;
  const effects = Number.isFinite(effectIndex) && effectIndex > 0
    ? itemPorIndice(fmtScheme?.["a:effectStyleLst"]?.["a:effectStyle"], effectIndex - 1)
    : null;
  const fontRef = style?.["a:fontRef"];
  const fontCollection = fontRef?.["@_idx"] === "minor"
    ? themeElements?.["a:fontScheme"]?.["a:minorFont"]
    : themeElements?.["a:fontScheme"]?.["a:majorFont"];
  const placeholderColor = lerCorOoxml(fontRef, contexto);
  return {
    fill,
    line,
    effects,
    fontFamily: typeof fontCollection?.["a:latin"]?.["@_typeface"] === "string" ? fontCollection["a:latin"]["@_typeface"] : null,
    placeholderColor,
  };
}

interface RetanguloEmuBruto {
  off: { x: number; y: number };
  ext: { cx: number; cy: number };
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

function lerFlagBooleana(valor: unknown): boolean {
  return valor === "1" || valor === 1 || valor === "true" || valor === true;
}

function lerXfrmBruto(spPr: NoXml | undefined): RetanguloEmuBruto | null {
  const xfrm = spPr?.["a:xfrm"];
  const off = xfrm?.["a:off"];
  const ext = xfrm?.["a:ext"];
  const x = Number(off?.["@_x"]);
  const y = Number(off?.["@_y"]);
  const cx = Number(ext?.["@_cx"]);
  const cy = Number(ext?.["@_cy"]);
  if (![x, y, cx, cy].every(Number.isFinite)) return null;
  const rot = Number(xfrm?.["@_rot"]);
  return {
    off: { x, y }, ext: { cx, cy }, rot: Number.isFinite(rot) ? rot : 0,
    flipH: lerFlagBooleana(xfrm?.["@_flipH"]), flipV: lerFlagBooleana(xfrm?.["@_flipV"]),
  };
}

/**
 * Quando uma forma do slide não tem `<a:xfrm>` próprio (posição/tamanho herdados do layout —
 * comum em placeholders de título/corpo que o usuário nunca moveu manualmente), procura a forma
 * correspondente no layout pelo tipo+índice do placeholder (`<p:ph type="..." idx="...">`).
 * Casa por type+idx primeiro (mais específico); se não achar, cai pra primeira forma do mesmo
 * type no layout (placeholders de título costumam ter idx implícito/ausente).
 */
export function buscarPosicaoNoLayout(
  spTreeLayout: NoXml | null,
  tipoPlaceholder: string | undefined,
  idxPlaceholder: string | undefined,
): RetanguloEmuBruto | null {
  if (!spTreeLayout || !tipoPlaceholder) return null;
  const formasLayout = comoArray<NoXml>(spTreeLayout["p:sp"]);

  let candidataPorTipo: NoXml | null = null;
  for (const sp of formasLayout) {
    const ph = sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"];
    if (!ph) continue;
    const tipoLayout = ph["@_type"] ?? "body";
    if (tipoLayout !== tipoPlaceholder) continue;
    if (!candidataPorTipo) candidataPorTipo = sp;
    if (idxPlaceholder !== undefined && ph["@_idx"] === idxPlaceholder) {
      return lerXfrmBruto(sp["p:spPr"]);
    }
  }
  return candidataPorTipo ? lerXfrmBruto(candidataPorTipo["p:spPr"]) : null;
}
