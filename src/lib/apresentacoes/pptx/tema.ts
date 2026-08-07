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
}

function lerCorSimples(no: NoXml): string | null {
  const srgb = no?.["a:srgbClr"]?.["@_val"];
  if (typeof srgb === "string") return `#${srgb}`;
  const sys = no?.["a:sysClr"]?.["@_lastClr"];
  if (typeof sys === "string") return `#${sys}`;
  return null;
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
    if (!alvoLayout) return { esquemaCores: ESQUEMA_FALLBACK, mapaCores: MAPA_FALLBACK, bgMaster: null, bgLayout: null, spTreeLayout: null };

    const caminhoLayout = resolverCaminhoRelativo(caminhoSlide, alvoLayout);
    const layoutXml = await lerXml(zip, caminhoLayout);
    const bgLayout = layoutXml?.["p:sldLayout"]?.["p:cSld"]?.["p:bg"] ?? null;
    const spTreeLayout = layoutXml?.["p:sldLayout"]?.["p:cSld"]?.["p:spTree"] ?? null;

    const pastaLayout = caminhoLayout.split("/").slice(0, -1).join("/");
    const nomeLayout = caminhoLayout.split("/").pop() ?? "";
    const relsLayout = await lerRelacionamentos(zip, `${pastaLayout}/_rels/${nomeLayout}.rels`);
    const alvoMaster = acharAlvoPorPrefixo(relsLayout, "slideMasters/");
    if (!alvoMaster) return { esquemaCores: ESQUEMA_FALLBACK, mapaCores: MAPA_FALLBACK, bgMaster: null, bgLayout, spTreeLayout };

    const caminhoMaster = resolverCaminhoRelativo(caminhoLayout, alvoMaster);
    const masterXml = await lerXml(zip, caminhoMaster);
    const bgMaster = masterXml?.["p:sldMaster"]?.["p:cSld"]?.["p:bg"] ?? null;
    const mapaCores = lerMapaCores(masterXml?.["p:sldMaster"]?.["p:clrMap"]);

    const pastaMaster = caminhoMaster.split("/").slice(0, -1).join("/");
    const nomeMaster = caminhoMaster.split("/").pop() ?? "";
    const relsMaster = await lerRelacionamentos(zip, `${pastaMaster}/_rels/${nomeMaster}.rels`);
    const alvoTema = acharAlvoPorPrefixo(relsMaster, "theme/");
    if (!alvoTema) return { esquemaCores: ESQUEMA_FALLBACK, mapaCores, bgMaster, bgLayout, spTreeLayout };

    const caminhoTema = resolverCaminhoRelativo(caminhoMaster, alvoTema);
    const esquemaCores = await lerEsquemaCores(zip, caminhoTema);
    return { esquemaCores, mapaCores, bgMaster, bgLayout, spTreeLayout };
  } catch (erro) {
    console.error("[pptx/tema] Falha ao resolver tema/layout/master — usando cores padrão do Office", erro);
    return { esquemaCores: ESQUEMA_FALLBACK, mapaCores: MAPA_FALLBACK, bgMaster: null, bgLayout: null, spTreeLayout: null };
  }
}

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace("#", "");
  return [parseInt(limpo.slice(0, 2), 16), parseInt(limpo.slice(2, 4), 16), parseInt(limpo.slice(4, 6), 16)];
}

function rgbParaHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Aproximação padrão (usada por várias implementações OOXML não-Microsoft) de shade/tint —
 * não é bit-exata ao algoritmo do PowerPoint, mas fica visualmente muito próxima. */
function aplicarModificadores(hex: string, mods: { lumMod?: number; lumOff?: number; shade?: number; tint?: number }): string {
  let [r, g, b] = hexParaRgb(hex);

  if (mods.shade !== undefined) {
    const f = mods.shade / 100000;
    r *= f; g *= f; b *= f;
  }
  if (mods.tint !== undefined) {
    const f = mods.tint / 100000;
    r = r * f + 255 * (1 - f);
    g = g * f + 255 * (1 - f);
    b = b * f + 255 * (1 - f);
  }
  if (mods.lumMod !== undefined || mods.lumOff !== undefined) {
    // Aproximação simples: aplica o mesmo fator/offset de luminância proporcionalmente aos 3 canais.
    const lumMod = (mods.lumMod ?? 100000) / 100000;
    const lumOff = (mods.lumOff ?? 0) / 100000;
    r = r * lumMod + 255 * lumOff;
    g = g * lumMod + 255 * lumOff;
    b = b * lumMod + 255 * lumOff;
  }

  return rgbParaHex(r, g, b);
}

/**
 * Lê um nó de cor OOXML genérico — `<a:srgbClr val="RRGGBB">` ou `<a:schemeClr val="accent1">`,
 * ambos podendo ter filhos modificadores (`<a:lumMod>`, `<a:shade>` etc.). Devolve `null` se o
 * nó não tiver nenhuma cor reconhecível (`phClr` — cor herdada de um placeholder de estilo — e
 * cores por sistema não mapeadas ficam fora do escopo desta versão).
 */
export function lerCorOoxml(no: NoXml | undefined, contexto: ContextoTema): string | null {
  if (!no) return null;

  const lerMods = (fonte: NoXml) => ({
    lumMod: fonte?.["a:lumMod"]?.["@_val"] !== undefined ? Number(fonte["a:lumMod"]["@_val"]) : undefined,
    lumOff: fonte?.["a:lumOff"]?.["@_val"] !== undefined ? Number(fonte["a:lumOff"]["@_val"]) : undefined,
    shade: fonte?.["a:shade"]?.["@_val"] !== undefined ? Number(fonte["a:shade"]["@_val"]) : undefined,
    tint: fonte?.["a:tint"]?.["@_val"] !== undefined ? Number(fonte["a:tint"]["@_val"]) : undefined,
  });

  const srgb = no["a:srgbClr"];
  if (srgb?.["@_val"]) {
    const base = `#${srgb["@_val"]}`;
    return aplicarModificadores(base, lerMods(srgb));
  }

  const scheme = no["a:schemeClr"];
  if (scheme?.["@_val"]) {
    const nomeEsquema = scheme["@_val"] as string;
    const slot = contexto.mapaCores[nomeEsquema] ?? (SLOTS_ESQUEMA_CORES.includes(nomeEsquema as SlotCor) ? (nomeEsquema as SlotCor) : null);
    if (!slot) return null;
    const base = contexto.esquemaCores[slot];
    return aplicarModificadores(base, lerMods(scheme));
  }

  return null;
}

export interface FundoResolvido {
  tipoCor: string | null;
  imagemREmbed: string | null;
}

/** Resolve `<p:bg><p:bgPr>` (cor ou imagem) de um nó de fundo já localizado (slide/layout/master). */
export function lerFundo(bgNo: NoXml | null, contexto: ContextoTema): FundoResolvido | null {
  const bgPr = bgNo?.["p:bgPr"];
  if (!bgPr) return null;

  const blip = bgPr["a:blipFill"]?.["a:blip"];
  const rEmbed = resolverBlipPreferido(blip);
  if (typeof rEmbed === "string") return { tipoCor: null, imagemREmbed: rEmbed };

  const solid = bgPr["a:solidFill"];
  if (solid) {
    const cor = lerCorOoxml(solid, contexto);
    if (cor) return { tipoCor: cor, imagemREmbed: null };
  }

  // Gradiente: aproxima pela cor do primeiro stop — sem suporte a gradiente real no schema
  // de fundo do Alpha Motion, uma cor sólida representativa é a melhor aproximação disponível.
  const gradStops = comoArray(bgPr["a:gradFill"]?.["a:gsLst"]?.["a:gs"]);
  if (gradStops.length > 0) {
    const cor = lerCorOoxml(gradStops[0], contexto);
    if (cor) return { tipoCor: cor, imagemREmbed: null };
  }

  return null;
}

interface RetanguloEmuBruto {
  off: { x: number; y: number };
  ext: { cx: number; cy: number };
  rot: number;
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
  return { off: { x, y }, ext: { cx, cy }, rot: Number.isFinite(rot) ? rot : 0 };
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
