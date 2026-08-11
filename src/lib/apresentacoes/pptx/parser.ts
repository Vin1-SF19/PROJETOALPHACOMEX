import JSZip from "jszip";
import type { ApresentacaoPptxExtraida, DiagnosticoElemento, FormaExtraida, FormaImagemExtraida, FormaLinhaExtraida, FormaTabelaExtraida, FormaTextoExtraida, SlideExtraido } from "./tipos";
import { SLIDE_SIZE_FALLBACK_EMU, calcularEscalaPptx, converterRetanguloEmu, type EscalaPptx } from "./unidades";
import {
  comoArray, extrairNumero, lerRelacionamentos, lerXml, lerXmlComTexto,
  resolverBlipPreferido, resolverCaminhoRelativo, type MapaRelacionamentos, type NoXml,
} from "./xml-utils";
import { buscarPosicaoNoLayout, lerCorOoxml, lerFundo, resolverContextoTema, resolverReferenciasEstilo, type ContextoTema } from "./tema";
import { ConsumidorPorTipo, construirArvoreOrdem, xmlDoNo, type NoOrdem } from "./ordem-xml";
import { construirSvgFormaColorida, construirSvgFormaGradiente, construirSvgImagemRecortada, extrairGeometriaCustGeom, type GeometriaCustGeom } from "./geometria";
import { MATRIZ_IDENTIDADE, matrizDoGrupo, matrizEscala, matrizRotacao, matrizTranslacao, multiplicarMatrizes, transformarRetangulo } from "./matriz-transformacao";
import type { PptxCrop, PptxEffects, PptxElement, PptxFill, PptxIntermediateSlide, PptxLine, PptxMatrix, PptxSourceRef } from "./modelo-intermediario";
import { PPTX_IMPORTER_VERSION } from "./modelo-intermediario";
import type { PptxDiagnosticEntry } from "./diagnostico";
import { validarPacotePptx } from "./seguranca";
import { extrairTextBody, textoTemConteudoVisual } from "./texto";
import { montarCadeiaPlaceholder, resolverNaCadeia, shapeEhPlaceholder, textoEhInstrucaoDeMaster } from "./heranca";
import { resolverCorOoxml } from "./color-resolver";

/**
 * Parser de `.pptx` (OOXML) — extrai texto, imagens (inclusive imagem-como-preenchimento de
 * forma via `<a:blipFill>` dentro de `<p:sp>`, com `<asvg:svgBlip>` preferido sobre o raster),
 * tabelas, formas básicas/`<a:custGeom>` e FUNDO (com herança slide→layout→master) de cada
 * slide, na ORDEM REAL do documento (`ordem-xml.ts` corrige o agrupamento por tag do
 * `fast-xml-parser`, que senão intercalaria grupos/formas/imagens fora de ordem — quebrando
 * z-index de verdade), resolvendo cor de tema (`<a:schemeClr>`) e transformação de grupo
 * (`chOff`/`chExt`, recursiva/composta) corretamente.
 *
 * `<a:custGeom>` é interpretado via `geometria.ts`: retângulo simples (comum em exports de
 * ferramentas de design que nunca usam `prstGeom`) vira `rect` nativo; path real não-retangular
 * vira SVG — recortando (`clipPath`) a imagem quando a forma tem `blipFill`, ou desenhando o
 * path preenchido quando usa `solidFill` ou `gradFill`. Nenhuma forma reconhecida (imagem/texto/cor) é
 * descartada em silêncio: toda forma que não vira componente ganha um motivo ESPECÍFICO em
 * `ignorados` (nunca uma mensagem genérica única) e uma entrada em `diagnostico`.
 *
 * O parser também preserva crop/tile, rich text por run, linhas, sombras principais, flip,
 * gradientes e referências de estilo. Objetos sem representação nativa (chart, SmartArt, OLE,
 * EMF/WMF e alguns pattern fills) são isolados no diagnóstico; nunca derrubam o slide inteiro.
 * A referência independente do PowerPoint é responsabilidade de `reference-renderer.ts`.
 */

// ---------- Transformação de coordenadas EMU (composição pra grupos aninhados) ----------

type TransformoEmu = PptxMatrix;

const TRANSFORMO_IDENTIDADE: TransformoEmu = MATRIZ_IDENTIDADE;

/** Transform local de 1 grupo: mapeia coordenadas do espaço-filho (`chOff`/`chExt`) pro mesmo espaço do `off`/`ext` do próprio grupo. */
function transformoDoGrupo(
  off: { x: number; y: number },
  ext: { cx: number; cy: number },
  chOff: { x: number; y: number },
  chExt: { cx: number; cy: number },
  rotacao = 0,
  flipH = false,
  flipV = false,
): TransformoEmu {
  return matrizDoGrupo({ off, ext, chOff, chExt, rotation: rotacao, flipH, flipV });
}

/** Compõe 2 transforms — `interno` se aplica PRIMEIRO (grupo mais profundo), `externo` DEPOIS. */
function compor(externo: TransformoEmu, interno: TransformoEmu): TransformoEmu {
  return multiplicarMatrizes(externo, interno);
}

// ---------- Leitura de retângulo/rotação bruta (EMU, sem transform/escala aplicados) ----------

interface RetanguloBruto {
  off: { x: number; y: number };
  ext: { cx: number; cy: number };
  rot: number;
  flipH: boolean;
  flipV: boolean;
}

function lerFlagBooleana(valor: unknown): boolean {
  return valor === "1" || valor === 1 || valor === "true" || valor === true;
}

function lerXfrmBruto(spPr: NoXml | undefined): RetanguloBruto | null {
  const xfrm = spPr?.["a:xfrm"];
  const off = xfrm?.["a:off"];
  const ext = xfrm?.["a:ext"];
  const x = extrairNumero(off?.["@_x"]);
  const y = extrairNumero(off?.["@_y"]);
  const cx = extrairNumero(ext?.["@_cx"]);
  const cy = extrairNumero(ext?.["@_cy"]);
  if (x === null || y === null || cx === null || cy === null) return null;
  const rotBruto = extrairNumero(xfrm?.["@_rot"]);
  return {
    off: { x, y }, ext: { cx, cy }, rot: rotBruto !== null ? rotBruto / 60000 : 0,
    flipH: lerFlagBooleana(xfrm?.["@_flipH"]), flipV: lerFlagBooleana(xfrm?.["@_flipV"]),
  };
}

/** Lê o `<a:xfrm>` da forma; se ausente, tenta herdar posição/tamanho do placeholder correspondente no layout. */
function lerRetanguloComHeranca(sp: NoXml, spTreeLayout: NoXml | null, spTreeMaster: NoXml | null = null): RetanguloBruto | null {
  const direto = lerXfrmBruto(sp?.["p:spPr"]);
  if (direto) return direto;

  const ph = sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"] ?? sp?.["p:nvPicPr"]?.["p:nvPr"]?.["p:ph"];
  if (!ph) return null;
  return buscarPosicaoNoLayout(spTreeLayout, ph["@_type"] ?? "body", ph["@_idx"])
    ?? buscarPosicaoNoLayout(spTreeMaster, ph["@_type"] ?? "body", ph["@_idx"]);
}

function converterComTransform(bruto: RetanguloBruto, transform: TransformoEmu, escalaInfo: EscalaPptx) {
  const mapeado = transformarRetangulo(transform, bruto.off, bruto.ext, bruto.rot, bruto.flipH, bruto.flipV);
  return {
    ...converterRetanguloEmu(mapeado.off, mapeado.ext, escalaInfo),
    rotacao: mapeado.rotation,
    flipH: mapeado.flipH,
    flipV: mapeado.flipV,
  };
}

/** Nome/id do elemento pra diagnóstico — `<p:cNvPr>` vive num filho diferente conforme o tipo (`p:nvSpPr`/`p:nvPicPr`/`p:nvGrpSpPr`/`p:nvGraphicFramePr`/`p:nvCxnSpPr`). */
function lerCNvPr(no: NoXml): { id: string | null; nome: string } {
  const cNvPr =
    no?.["p:nvSpPr"]?.["p:cNvPr"] ?? no?.["p:nvPicPr"]?.["p:cNvPr"] ?? no?.["p:nvGrpSpPr"]?.["p:cNvPr"]
    ?? no?.["p:nvGraphicFramePr"]?.["p:cNvPr"] ?? no?.["p:nvCxnSpPr"]?.["p:cNvPr"];
  return {
    id: cNvPr?.["@_id"] !== undefined ? String(cNvPr["@_id"]) : null,
    nome: typeof cNvPr?.["@_name"] === "string" ? cNvPr["@_name"] : "(sem nome)",
  };
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

// ---------- Texto ----------

function extrairTextoDeBody(txBody: NoXml, contexto: ContextoTema, fontesDetectadas: Set<string>, escalaInfo: EscalaPptx, inheritedTextBodies: NoXml[] = [], rawXml?: string): {
  paragrafos: string[];
  corTexto: string | null;
  negrito: boolean;
  tamanhoFonte: number | null;
  alinhamento: "left" | "center" | "right" | "justify" | null;
  richText: NonNullable<FormaTextoExtraida["richText"]>;
  fontFamily: string | null;
  italic: boolean;
  underline: string | null;
  padding: NonNullable<FormaTextoExtraida["padding"]>;
  verticalAlign: NonNullable<FormaTextoExtraida["verticalAlign"]>;
  wrap: boolean;
  autofit: NonNullable<FormaTextoExtraida["autofit"]>;
} {
  const richText = extrairTextBody(txBody, { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores }, inheritedTextBodies, rawXml)
    ?? { paragraphs: [], margins: { leftEmu: 0, rightEmu: 0, topEmu: 0, bottomEmu: 0 }, columns: 1, autofit: "none" as const };
  const paragrafos = richText.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join(""));
  const firstStyledRun = richText.paragraphs.flatMap((paragraph) => paragraph.runs).find((run) => Object.keys(run.style).length > 0);
  for (const paragraph of richText.paragraphs) {
    for (const run of paragraph.runs) if (run.style.fontFamily) fontesDetectadas.add(run.style.fontFamily);
  }
  const alignment = richText.paragraphs.find((paragraph) => paragraph.alignment)?.alignment;
  const verticalAlign = richText.anchor === "ctr" ? "middle" : richText.anchor === "b" ? "bottom" : "top";
  const emuToCanvas = escalaInfo.escala;
  return {
    paragrafos,
    corTexto: firstStyledRun?.style.color?.css ?? null,
    negrito: firstStyledRun?.style.bold ?? false,
    tamanhoFonte: firstStyledRun?.style.fontSizePt !== undefined
      ? firstStyledRun.style.fontSizePt * 12700 * escalaInfo.escala
      : null,
    alinhamento: alignment ?? null,
    richText,
    fontFamily: firstStyledRun?.style.fontFamily ?? null,
    italic: firstStyledRun?.style.italic ?? false,
    underline: firstStyledRun?.style.underline ?? null,
    padding: {
      left: richText.margins.leftEmu * emuToCanvas,
      right: richText.margins.rightEmu * emuToCanvas,
      top: richText.margins.topEmu * emuToCanvas,
      bottom: richText.margins.bottomEmu * emuToCanvas,
    },
    verticalAlign,
    wrap: richText.wrap !== "none",
    autofit: richText.autofit,
  };
}

const PREFIXOS_TITULO = new Set(["title", "ctrTitle"]);

function processarFormaTexto(
  sp: NoXml,
  bruto: RetanguloBruto,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  contexto: ContextoTema,
  fontesDetectadas: Set<string>,
  inheritedTextBodies: NoXml[] = [],
  rawXml?: string,
): FormaTextoExtraida | null {
  const txBody = sp?.["p:txBody"];
  if (!txBody) return null;
  const text = extrairTextoDeBody(txBody, contexto, fontesDetectadas, escalaInfo, inheritedTextBodies, rawXml);
  const { paragrafos, corTexto, negrito, tamanhoFonte, alinhamento } = text;
  if (paragrafos.every((p) => !p.trim())) return null;

  const tipoPlaceholder = sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]?.["@_type"];
  const ehTitulo = typeof tipoPlaceholder === "string" && PREFIXOS_TITULO.has(tipoPlaceholder);

  const { x, y, w, h, rotacao, flipH, flipV } = converterComTransform(bruto, transform, escalaInfo);
  return {
    tipo: "texto", x, y, w, h, rotacao, flipH, flipV, paragrafos, corTexto, negrito, tamanhoFonte, alinhamento, ehTitulo,
    richText: text.richText,
    fontFamily: text.fontFamily,
    italic: text.italic,
    underline: text.underline,
    padding: text.padding,
    verticalAlign: text.verticalAlign,
    wrap: text.wrap,
    autofit: text.autofit,
    fontScale: 12700 * escalaInfo.escala,
  };
}

// ---------- Resolução de asset de imagem (compartilhada por p:pic, blipFill-em-p:sp e fundo) ----------

const MIME_POR_EXTENSAO: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml", emf: "image/emf", wmf: "image/wmf",
};

interface AssetImagemResolvido {
  bytes: Uint8Array;
  mimeType: string;
  caminhoMedia: string;
}

async function resolverAssetImagem(
  rEmbed: string | undefined,
  relsSlide: MapaRelacionamentos,
  caminhoSlide: string,
  zip: JSZip,
): Promise<{ asset: AssetImagemResolvido | null; motivo: string | null }> {
  if (typeof rEmbed !== "string") return { asset: null, motivo: "sem r:embed resolvível (nem raster nem svgBlip)" };

  const alvoRelativo = relsSlide[rEmbed];
  if (!alvoRelativo) return { asset: null, motivo: `relacionamento "${rEmbed}" ausente no .rels do slide` };

  const caminhoMedia = resolverCaminhoRelativo(caminhoSlide, alvoRelativo);
  const arquivoMedia = zip.file(caminhoMedia);
  if (!arquivoMedia) return { asset: null, motivo: `asset "${caminhoMedia}" não encontrado dentro do pacote .pptx` };

  const bytes = await arquivoMedia.async("uint8array");
  const extensao = caminhoMedia.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_POR_EXTENSAO[extensao];
  if (!mimeType) return { asset: null, motivo: `extensão "${extensao}" sem mimeType conhecido` };
  // Formatos vetoriais legados do Office (emf/wmf) não renderizam em navegador — sem conversor
  // disponível no servidor, melhor reportar do que criar uma imagem quebrada no slide.
  if (mimeType === "image/emf" || mimeType === "image/wmf") {
    return { asset: null, motivo: `formato vetorial legado do Office (.${extensao}) sem conversor disponível no servidor` };
  }

  return { asset: { bytes, mimeType, caminhoMedia }, motivo: null };
}

// ---------- Processamento de formas (p:sp) ----------

const GEOMETRIAS_SUPORTADAS = new Set(["rect", "roundRect", "ellipse"]);

/** Resultado uniforme de processar 1 elemento — alimenta tanto `ignorados` (motivo) quanto `diagnostico` (rastro completo). */
interface ResultadoProcessamento {
  forma: FormaExtraida | null;
  motivo: string | null;
  fillEncontrado: string;
  relationshipId: string | null;
  assetResolvido: string | null;
  geometria: string | null;
  silencioso?: boolean;
}

function lerCrop(blipFill: NoXml | undefined): PptxCrop | undefined {
  const srcRect = blipFill?.["a:srcRect"];
  if (!srcRect) return undefined;
  const percent = (name: string) => Math.max(0, Math.min(0.999, (Number(srcRect[`@_${name}`]) || 0) / 100000));
  const crop = { left: percent("l"), top: percent("t"), right: percent("r"), bottom: percent("b") };
  return Object.values(crop).some((value) => value > 0) ? crop : undefined;
}

function lerOpacidadeBlip(blip: NoXml | undefined): number | undefined {
  const value = Number(blip?.["a:alphaModFix"]?.["@_amt"] ?? blip?.["a:alphaModFix"]?.["@_val"]);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100000)) : undefined;
}

function lerLinhaOoxml(lineNode: NoXml | undefined, contexto: ContextoTema): PptxLine | undefined {
  if (!lineNode || lineNode["a:noFill"] !== undefined) return undefined;
  const color = resolverCorOoxml(lineNode["a:solidFill"], { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores }) ?? undefined;
  const width = Number(lineNode["@_w"]);
  return {
    widthEmu: Number.isFinite(width) ? width : 12700,
    color,
    dash: lineNode["a:prstDash"]?.["@_val"],
    cap: lineNode["@_cap"],
    join: lineNode["a:round"] !== undefined ? "round" : lineNode["a:bevel"] !== undefined ? "bevel" : lineNode["a:miter"] !== undefined ? "miter" : undefined,
    beginArrow: lineNode["a:headEnd"]?.["@_type"],
    endArrow: lineNode["a:tailEnd"]?.["@_type"],
  };
}

function lerEfeitosOoxml(effectRoot: NoXml | undefined, contexto: ContextoTema, escalaInfo: EscalaPptx): {
  effects?: PptxEffects;
  shadow?: NonNullable<Extract<FormaExtraida, { tipo: "caixa" }>["sombra"]>;
} {
  const effectList = effectRoot?.["a:effectLst"] ?? effectRoot;
  if (!effectList) return {};
  const shadows: PptxEffects["shadows"] = [];
  let cssShadow: NonNullable<Extract<FormaExtraida, { tipo: "caixa" }>["sombra"]> | undefined;
  for (const [key, type] of [["a:outerShdw", "outer"], ["a:innerShdw", "inner"]] as const) {
    const node = effectList[key];
    if (!node) continue;
    const color = resolverCorOoxml(node, { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores });
    if (!color) continue;
    const blurEmu = Number(node["@_blurRad"]) || 0;
    const distanceEmu = Number(node["@_dist"]) || 0;
    const direction = (Number(node["@_dir"]) || 0) / 60000;
    shadows.push({ type, blurEmu, distanceEmu, direction, color });
    if (!cssShadow) {
      const radians = (direction * Math.PI) / 180;
      cssShadow = {
        x: Math.cos(radians) * distanceEmu * escalaInfo.escala,
        y: Math.sin(radians) * distanceEmu * escalaInfo.escala,
        blur: blurEmu * escalaInfo.escala,
        spread: 0,
        color: color.css,
        inset: type === "inner",
      };
    }
  }
  const glowNode = effectList["a:glow"];
  const glowColor = resolverCorOoxml(glowNode, { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores });
  const softEdgeEmu = Number(effectList["a:softEdge"]?.["@_rad"]);
  const effects: PptxEffects = {
    shadows,
    ...(glowNode && glowColor ? { glow: { radiusEmu: Number(glowNode["@_rad"]) || 0, color: glowColor } } : {}),
    ...(Number.isFinite(softEdgeEmu) ? { softEdgeEmu } : {}),
  };
  return shadows.length || effects.glow || effects.softEdgeEmu !== undefined ? { effects, shadow: cssShadow } : {};
}

async function processarFormaImagemDeShape(
  sp: NoXml,
  bruto: RetanguloBruto,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  relsSlide: MapaRelacionamentos,
  caminhoSlide: string,
  zip: JSZip,
  geometria: GeometriaCustGeom | null,
  effectiveBlipFill?: NoXml,
): Promise<ResultadoProcessamento> {
  const blipFill = effectiveBlipFill ?? sp?.["p:spPr"]?.["a:blipFill"];
  const blip = blipFill?.["a:blip"];
  const rEmbed = resolverBlipPreferido(blip);
  const { asset, motivo } = await resolverAssetImagem(rEmbed, relsSlide, caminhoSlide, zip);
  if (!asset) {
    return { forma: null, motivo: `imagem em forma (blipFill): ${motivo}`, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: null, geometria: null };
  }

  const { x, y, w, h, rotacao, flipH, flipV } = converterComTransform(bruto, transform, escalaInfo);
  const crop = lerCrop(blipFill);
  const tile = blipFill?.["a:tile"] !== undefined;
  const opacidade = lerOpacidadeBlip(blip);

  // custGeom não-retangular → recorta a imagem pelo path real (clipPath), em vez de mostrá-la
  // como um retângulo (que destoaria visualmente da forma original — ex.: foto com crop arredondado).
  if (geometria && !geometria.ehRetangulo && geometria.pathSvg) {
    const dataUriOriginal = `data:${asset.mimeType};base64,${Buffer.from(asset.bytes).toString("base64")}`;
    const svgMarkup = construirSvgImagemRecortada(geometria.pathSvg, geometria.viewBoxW, geometria.viewBoxH, dataUriOriginal, crop, opacidade);
    const bytesSvg = new TextEncoder().encode(svgMarkup);
    return {
      forma: { tipo: "imagem", x, y, w, h, rotacao, flipH, flipV, opacidade, bytes: bytesSvg, mimeType: "image/svg+xml", nomeArquivo: `${asset.caminhoMedia.split("/").pop() ?? "imagem"}-recortada.svg` },
      motivo: null, fillEncontrado: "blipFill (com recorte custGeom)", relationshipId: rEmbed ?? null, assetResolvido: asset.caminhoMedia, geometria: null,
    };
  }

  return {
    forma: { tipo: "imagem", x, y, w, h, rotacao, flipH, flipV, opacidade, crop, tile, bytes: asset.bytes, mimeType: asset.mimeType, nomeArquivo: asset.caminhoMedia.split("/").pop() ?? "imagem" },
    motivo: null, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: asset.caminhoMedia, geometria: null,
  };
}

async function processarShape(
  sp: NoXml,
  xmlShapeCru: string,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  contexto: ContextoTema,
  spTreeLayout: NoXml | null,
  relsSlide: MapaRelacionamentos,
  caminhoSlide: string,
  zip: JSZip,
  fontesDetectadas: Set<string>,
): Promise<ResultadoProcessamento> {
  const nomeForma = lerCNvPr(sp).nome;
  const bruto = lerRetanguloComHeranca(sp, spTreeLayout, contexto.spTreeMaster);
  if (!bruto) {
    return {
      forma: null, motivo: `forma "${nomeForma}" sem posição resolvível (xfrm ausente e sem placeholder herdado do layout)`,
      fillEncontrado: "desconhecido", relationshipId: null, assetResolvido: null, geometria: null,
    };
  }

  const cadeia = montarCadeiaPlaceholder(sp, contexto.spTreeLayout, contexto.spTreeMaster);
  const spPr = sp?.["p:spPr"];
  const styleNode = resolverNaCadeia(cadeia, ["p:style"]);
  const styleRefs = resolverReferenciasEstilo(styleNode, contexto);
  const effectiveSolidFill = spPr?.["a:solidFill"]
    ?? resolverNaCadeia(cadeia, ["p:spPr", "a:solidFill"])
    ?? styleRefs.fill?.["a:solidFill"]
    ?? styleRefs.fill;
  const effectiveBlipFill = spPr?.["a:blipFill"]
    ?? resolverNaCadeia(cadeia, ["p:spPr", "a:blipFill"])
    ?? styleRefs.fill?.["a:blipFill"];
  const effectiveGradientFill = spPr?.["a:gradFill"]
    ?? resolverNaCadeia(cadeia, ["p:spPr", "a:gradFill"])
    ?? styleRefs.fill?.["a:gradFill"];
  const effectiveLineNode = spPr?.["a:ln"]
    ?? resolverNaCadeia(cadeia, ["p:spPr", "a:ln"])
    ?? styleRefs.line;
  const effectiveEffectsNode = spPr?.["a:effectLst"]
    ?? resolverNaCadeia(cadeia, ["p:spPr", "a:effectLst"])
    ?? styleRefs.effects;
  const temCustGeom = Boolean(spPr?.["a:custGeom"]);
  const prst = spPr?.["a:prstGeom"]?.["@_prst"];
  const geometria = temCustGeom ? extrairGeometriaCustGeom(xmlShapeCru) : null;
  const baseGeometria = temCustGeom
    ? geometria
      ? `custGeom ${geometria.ehRetangulo ? "retangular" : `path (${geometria.viewBoxW}x${geometria.viewBoxH})`}`
      : "custGeom ilegível (sem <a:path> reconhecível)"
    : typeof prst === "string" ? `prstGeom:${prst}` : "sem geometria declarada";
  // Componente `imagem`/`caixa` do Alpha Motion não tem campo de flip — em vez de aplicar
  // silenciosamente sem efeito, o flip detectado fica visível no diagnóstico (posição/imagem
  // continuam corretas, só o espelhamento não é reproduzido).
  const descricaoGeometria = baseGeometria + (bruto.flipH || bruto.flipV ? ` [flip${bruto.flipH ? "H" : ""}${bruto.flipV ? "V" : ""}]` : "");

  // 1) Imagem usada como preenchimento da forma — com ou sem recorte por custGeom.
  if (effectiveBlipFill) {
    const resultado = await processarFormaImagemDeShape(sp, bruto, transform, escalaInfo, relsSlide, caminhoSlide, zip, geometria, effectiveBlipFill);
    return { ...resultado, geometria: descricaoGeometria };
  }

  const corFundo = lerCorOoxml(effectiveSolidFill, contexto);
  const gradientStops = comoArray<NoXml>(effectiveGradientFill?.["a:gsLst"]?.["a:gs"])
    .map((stop) => ({
      position: Math.max(0, Math.min(100, (Number(stop?.["@_pos"]) || 0) / 1000)),
      color: resolverCorOoxml(stop, { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores })?.css,
    }))
    .filter((stop): stop is { position: number; color: string } => Boolean(stop.color));
  const gradientAngle = ((Number(effectiveGradientFill?.["a:lin"]?.["@_ang"]) || 0) / 60000 + 90) % 360;
  const gradientCss = gradientStops.length
    ? `linear-gradient(${gradientAngle}deg, ${gradientStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")})`
    : null;
  const line = lerLinhaOoxml(effectiveLineNode, contexto);
  const effectsResult = lerEfeitosOoxml(effectiveEffectsNode, contexto, escalaInfo);
  const txBody = sp?.["p:txBody"];
  const inheritedTextBodies = [cadeia.master?.["p:txBody"], cadeia.layout?.["p:txBody"]].filter((body): body is NoXml => Boolean(body));
  const textoInterno = txBody ? processarFormaTexto(sp, bruto, transform, escalaInfo, contexto, fontesDetectadas, inheritedTextBodies, xmlShapeCru) : null;
  if (textoInterno && styleRefs.fontFamily) {
    textoInterno.fontFamily ??= styleRefs.fontFamily;
    fontesDetectadas.add(styleRefs.fontFamily);
    if (textoInterno.richText) {
      textoInterno.richText = {
        ...textoInterno.richText,
        paragraphs: textoInterno.richText.paragraphs.map((paragraph) => ({
          ...paragraph,
          runs: paragraph.runs.map((run) => ({
            ...run,
            style: {
              ...run.style,
              fontFamily: run.style.fontFamily ?? styleRefs.fontFamily ?? undefined,
              color: run.style.color ?? (styleRefs.placeholderColor
                ? { hex: styleRefs.placeholderColor.slice(0, 7), alpha: 1, css: styleRefs.placeholderColor, source: "placeholder" as const }
                : undefined),
            },
          })),
        })),
      };
    }
  }

  const ehRetSimples = typeof prst === "string" && GEOMETRIAS_SUPORTADAS.has(prst);
  const ehRetViaCustGeom = geometria?.ehRetangulo === true;

  // 2) Retângulo/roundRect/ellipse (nativo OU custGeom disfarçado de retângulo — comum em
  //    exports de ferramentas de design) com fundo sólido → "caixa" (card), texto aninhado se tiver.
  if ((ehRetSimples || ehRetViaCustGeom) && (corFundo || gradientCss || line || effectsResult.effects)) {
    const { x, y, w, h, rotacao, flipH, flipV } = converterComTransform(bruto, transform, escalaInfo);
    const formato = prst === "roundRect" ? "roundRect" : prst === "ellipse" ? "ellipse" : "rect";
    return {
      forma: {
        tipo: "caixa", x, y, w, h, rotacao, flipH, flipV,
        corFundo: gradientCss ?? corFundo ?? "transparent", formato, textoInterno,
        line, effects: effectsResult.effects, gradientCss,
        lineWidthPx: line ? line.widthEmu * escalaInfo.escala : undefined,
        sombra: effectsResult.shadow,
      },
      motivo: null,
      fillEncontrado: gradientCss ? "gradFill" : corFundo ? "solidFill" : line ? "line only" : "effects only",
      relationshipId: null, assetResolvido: null, geometria: descricaoGeometria,
    };
  }

  // 3) custGeom genuinamente não-retangular — sem card nativo pra path arbitrário; fallback
  //    SVG preserva tanto fundo sólido quanto gradiente, em vez de descartar a forma inteira.
  if (geometria && !geometria.ehRetangulo && geometria.pathSvg && (corFundo || gradientStops.length > 0 || line)) {
    const { x, y, w, h, rotacao, flipH, flipV } = converterComTransform(bruto, transform, escalaInfo);
    const stroke = line?.color ? {
      color: line.color.css,
      width: Math.max(1, line.widthEmu / Math.max(1, bruto.ext.cx) * geometria.viewBoxW),
      ...(line.dash ? { dash: line.dash.includes("dot") ? "1 2" : "4 3" } : {}),
    } : undefined;
    const svgMarkup = gradientStops.length > 0
      ? construirSvgFormaGradiente(geometria.pathSvg, geometria.viewBoxW, geometria.viewBoxH, gradientAngle, gradientStops, stroke)
      : construirSvgFormaColorida(geometria.pathSvg, geometria.viewBoxW, geometria.viewBoxH, corFundo ?? "none", stroke);
    const bytes = new TextEncoder().encode(svgMarkup);
    return {
      forma: { tipo: "imagem", x, y, w, h, rotacao, flipH, flipV, bytes, mimeType: "image/svg+xml", nomeArquivo: `forma-${nomeForma}.svg` },
      motivo: null,
      fillEncontrado: gradientStops.length > 0 ? "custGeom gradiente (fallback SVG)" : "custGeom colorido (fallback SVG)",
      relationshipId: null, assetResolvido: null, geometria: descricaoGeometria,
    };
  }

  // 4) Sem fundo reconhecido: se tiver texto, extrai só o texto (perde a moldura, preserva conteúdo).
  if (textoInterno) {
    return { forma: textoInterno, motivo: null, fillEncontrado: "texto sem forma de fundo reconhecida", relationshipId: null, assetResolvido: null, geometria: descricaoGeometria };
  }

  const rawText = txBody ? extrairTextBody(txBody, { scheme: contexto.esquemaCores, colorMap: contexto.mapaCores }) : null;
  const unsupportedPatternFill = spPr?.["a:pattFill"] ?? resolverNaCadeia(cadeia, ["p:spPr", "a:pattFill"]);
  if ((!rawText || !textoTemConteudoVisual(rawText)) && !corFundo && !effectiveGradientFill && !unsupportedPatternFill && !line && !effectsResult.effects) {
    return {
      forma: null,
      motivo: null,
      silencioso: true,
      fillEncontrado: "textbox vazia/transparente",
      relationshipId: null,
      assetResolvido: null,
      geometria: descricaoGeometria,
    };
  }

  // 5) Nada aproveitável — motivo ESPECÍFICO (nunca a antiga mensagem genérica).
  const tipoFill = effectiveGradientFill ? (gradientStops.length > 0 ? "gradFill resolvido sem geometria renderizável" : "gradFill sem stops resolvíveis")
    : unsupportedPatternFill ? "pattFill (padrão, sem equivalente no schema)"
    : spPr?.["a:noFill"] ? "noFill (sem preenchimento — provável forma só de contorno)"
    : "sem fill declarado ou não resolvido";
  return {
    forma: null,
    motivo: `forma "${nomeForma}" sem imagem/texto/preenchimento aproveitável — geometria: ${descricaoGeometria}, fill: ${tipoFill}`,
    fillEncontrado: tipoFill, relationshipId: null, assetResolvido: null, geometria: descricaoGeometria,
  };
}

// ---------- Processamento de imagem (p:pic) ----------

async function processarImagem(
  pic: NoXml,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  relsSlide: MapaRelacionamentos,
  caminhoSlide: string,
  zip: JSZip,
  spTreeLayout: NoXml | null,
): Promise<ResultadoProcessamento> {
  const bruto = lerRetanguloComHeranca(pic, spTreeLayout);
  if (!bruto) {
    return { forma: null, motivo: "p:pic sem posição resolvível (xfrm ausente e sem placeholder herdado)", fillEncontrado: "blipFill", relationshipId: null, assetResolvido: null, geometria: null };
  }

  const blipFill = pic?.["p:blipFill"];
  const blip = blipFill?.["a:blip"];
  const rEmbed = resolverBlipPreferido(blip);
  const { asset, motivo } = await resolverAssetImagem(rEmbed, relsSlide, caminhoSlide, zip);
  if (!asset) {
    return { forma: null, motivo: `p:pic: ${motivo}`, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: null, geometria: null };
  }

  const { x, y, w, h, rotacao, flipH, flipV } = converterComTransform(bruto, transform, escalaInfo);
  const crop = lerCrop(blipFill);
  const tile = blipFill?.["a:tile"] !== undefined;
  const opacidade = lerOpacidadeBlip(blip);
  return {
    forma: { tipo: "imagem", x, y, w, h, rotacao, flipH, flipV, crop, tile, opacidade, bytes: asset.bytes, mimeType: asset.mimeType, nomeArquivo: asset.caminhoMedia.split("/").pop() ?? "imagem" },
    motivo: null, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: asset.caminhoMedia, geometria: null,
  };
}

// ---------- Tabela ----------

function processarTabela(
  graphicFrame: NoXml,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  contexto: ContextoTema,
  fontesDetectadas: Set<string>,
): FormaTabelaExtraida | null {
  const xfrm = graphicFrame?.["p:xfrm"];
  const off = xfrm?.["a:off"];
  const ext = xfrm?.["a:ext"];
  const x = extrairNumero(off?.["@_x"]);
  const y = extrairNumero(off?.["@_y"]);
  const cx = extrairNumero(ext?.["@_cx"]);
  const cy = extrairNumero(ext?.["@_cy"]);
  if (x === null || y === null || cx === null || cy === null) return null;

  const tbl = graphicFrame?.["a:graphic"]?.["a:graphicData"]?.["a:tbl"];
  if (!tbl) return null;

  const linhasXml = comoArray(tbl["a:tr"]);
  const linhasTexto = linhasXml.map((tr) =>
    comoArray(tr["a:tc"]).map((tc) => {
      const { paragrafos } = extrairTextoDeBody(tc["a:txBody"] ?? {}, contexto, fontesDetectadas, escalaInfo);
      return paragrafos.join(" ").trim();
    }),
  );
  if (linhasTexto.length === 0) return null;

  const [colunas, ...linhas] = linhasTexto;
  const { x: px, y: py, w, h, rotacao } = converterComTransform({ off: { x, y }, ext: { cx, cy }, rot: 0, flipH: false, flipV: false }, transform, escalaInfo);
  return { tipo: "tabela", x: px, y: py, w, h, rotacao, colunas, linhas };
}

function processarConector(
  connector: NoXml,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  contexto: ContextoTema,
): FormaLinhaExtraida | null {
  const bruto = lerXfrmBruto(connector?.["p:spPr"]);
  const line = lerLinhaOoxml(connector?.["p:spPr"]?.["a:ln"], contexto);
  if (!bruto || !line) return null;
  const { x, y, w, h, rotacao, flipH, flipV } = converterComTransform(bruto, transform, escalaInfo);
  return {
    tipo: "linha", x, y, w, h: Math.max(1, h), rotacao, flipH, flipV, line,
    lineWidthPx: Math.max(1, line.widthEmu * escalaInfo.escala),
  };
}

// ---------- Percurso da árvore de formas (ordem real do documento) ----------

interface ContextoSlide {
  transform: TransformoEmu;
  escalaInfo: EscalaPptx;
  relsSlide: MapaRelacionamentos;
  caminhoSlide: string;
  zip: JSZip;
  ignorados: Record<string, number>;
  contextoTema: ContextoTema;
  /** Texto XML cru do slide inteiro — necessário pra `xmlDoNo` (fatiar 1 shape) e pro scanner de `<a:path>` de `geometria.ts`. */
  xmlCru: string;
  slideIndice: number;
  /** Breadcrumb de nomes de grupo (do mais externo pro mais interno) — vira `grupoPai` no diagnóstico. */
  caminhoGrupos: string[];
  fontesDetectadas: Set<string>;
  diagnostico: DiagnosticoElemento[];
  diagnosticosDetalhados: PptxDiagnosticEntry[];
  sourceLevel: "master" | "layout" | "slide";
  sourcePath: string;
  zCounter: { value: number };
  intermediateTarget: PptxElement[];
}

function contar(ignorados: Record<string, number>, chave: string) {
  ignorados[chave] = (ignorados[chave] ?? 0) + 1;
}

function registrarDiagnostico(
  ctx: ContextoSlide,
  tipoOoxml: string,
  shapeId: string | null,
  nome: string,
  r: ResultadoProcessamento,
  elemento?: PptxElement,
) {
  ctx.diagnostico.push({
    slide: ctx.slideIndice,
    shapeId,
    nome,
    tipoOoxml,
    fillEncontrado: r.fillEncontrado,
    relationshipId: r.relationshipId,
    assetResolvido: r.assetResolvido,
    grupoPai: ctx.caminhoGrupos.length > 0 ? ctx.caminhoGrupos.join(" > ") : null,
    geometria: r.geometria,
    motivoFallback: r.motivo,
  });
  const source: PptxSourceRef = {
    slide: ctx.slideIndice,
    xmlPath: ctx.sourcePath,
    level: ctx.sourceLevel,
    ...(shapeId ? { shapeId } : {}),
    ...(r.relationshipId ? { relationshipId: r.relationshipId } : {}),
    ...(nome ? { name: nome } : {}),
  };
  ctx.diagnosticosDetalhados.push({
    severity: r.silencioso ? "INFO" : r.forma ? (r.fillEncontrado.includes("fallback") ? "FALLBACK" : "INFO") : r.motivo?.includes("asset") ? "ERROR" : "WARNING",
    source,
    type: tipoOoxml,
    geometry: r.geometria ?? undefined,
    fill: r.fillEncontrado,
    asset: r.assetResolvido ?? undefined,
    parent: ctx.caminhoGrupos.length ? ctx.caminhoGrupos.join(" > ") : undefined,
    localTransform: elemento?.transform.localTransform,
    worldTransform: elemento?.transform.worldTransform ?? ctx.transform,
    ...(r.forma?.tipo === "imagem" && r.forma.crop ? { crop: r.forma.crop } : {}),
    result: r.forma?.tipo ?? (r.silencioso ? "skipped" : "unsupported"),
    message: r.motivo ?? (r.silencioso ? "Elemento deliberadamente invisível ignorado." : "Elemento convertido."),
  });
}

function aplicarResultado(
  ctx: ContextoSlide,
  tipoOoxml: string,
  shapeId: string | null,
  nome: string,
  r: ResultadoProcessamento,
  formas: FormaExtraida[],
  rawTransform?: RetanguloBruto | null,
) {
  let elementoIntermediario: PptxElement | undefined;
  if (r.forma) {
    ctx.zCounter.value += 1;
    r.forma.zIndex = ctx.zCounter.value;
    r.forma.source = {
      slide: ctx.slideIndice,
      xmlPath: ctx.sourcePath,
      level: ctx.sourceLevel,
      ...(shapeId ? { shapeId } : {}),
      ...(r.relationshipId ? { relationshipId: r.relationshipId } : {}),
      ...(nome ? { name: nome } : {}),
    };
    formas.push(r.forma);
    elementoIntermediario = converterFormaParaIntermediario(
      r.forma,
      ctx.intermediateTarget.length,
      ctx.escalaInfo,
      ctx.slideIndice,
      ctx.sourcePath,
      rawTransform ?? undefined,
      ctx.transform,
    );
    ctx.intermediateTarget.push(elementoIntermediario);
  }
  else if (!r.silencioso) {
    contar(ctx.ignorados, r.motivo ?? `${tipoOoxml} sem motivo registrado`);
    const source: PptxSourceRef = {
      slide: ctx.slideIndice,
      xmlPath: ctx.sourcePath,
      level: ctx.sourceLevel,
      ...(shapeId ? { shapeId } : {}),
      ...(r.relationshipId ? { relationshipId: r.relationshipId } : {}),
      ...(nome ? { name: nome } : {}),
    };
    ctx.intermediateTarget.push({
      id: shapeId ?? `${ctx.sourceLevel}-fallback-${ctx.intermediateTarget.length + 1}`,
      name: nome,
      type: "fallback",
      source,
      transform: {
        off: { x: 0, y: 0 }, ext: { cx: 1, cy: 1 }, rotation: 0, flipH: false, flipV: false,
        localTransform: MATRIZ_IDENTIDADE, worldTransform: ctx.transform,
      },
      zIndex: ctx.intermediateTarget.length,
      fallbackReason: r.motivo ?? "Elemento OOXML sem conversão nativa.",
    });
  }
  registrarDiagnostico(ctx, tipoOoxml, shapeId, nome, r, elementoIntermediario);
}

/** Percorre a árvore de formas de um slide (`<p:spTree>`) na ORDEM REAL do XML original — usa
 * `ConsumidorPorTipo` pra "zipar" os arrays já parseados (agrupados por tag pelo `fast-xml-parser`)
 * de volta na sequência correta entre tipos diferentes intercalados (essencial pro z-index real). */
async function processarArvoreFormas(spTree: NoXml, ordemFilhos: NoOrdem[], ctx: ContextoSlide): Promise<FormaExtraida[]> {
  const formas: FormaExtraida[] = [];
  const spTreeLayout = ctx.contextoTema.spTreeLayout;

  const consumidor = new ConsumidorPorTipo<NoXml>({
    "p:sp": comoArray<NoXml>(spTree?.["p:sp"]),
    "p:pic": comoArray<NoXml>(spTree?.["p:pic"]),
    "p:grpSp": comoArray<NoXml>(spTree?.["p:grpSp"]),
    "p:graphicFrame": comoArray<NoXml>(spTree?.["p:graphicFrame"]),
    "p:cxnSp": comoArray<NoXml>(spTree?.["p:cxnSp"]),
  });

  for (const noOrdem of ordemFilhos) {
    const noParsed = consumidor.proximo(noOrdem.tag);
    if (!noParsed) {
      contar(ctx.ignorados, `elemento ${noOrdem.tag} não pareado entre ordem real do XML e árvore parseada`);
      continue;
    }

    if (noOrdem.tag === "p:sp") {
      const { id, nome } = lerCNvPr(noParsed);
      if (ctx.sourceLevel !== "slide" && (shapeEhPlaceholder(noParsed) || textoEhInstrucaoDeMaster(noParsed))) {
        continue;
      }
      try {
        const xmlShapeCru = xmlDoNo(ctx.xmlCru, noOrdem);
        const resultado = await processarShape(
          noParsed, xmlShapeCru, ctx.transform, ctx.escalaInfo, ctx.contextoTema, spTreeLayout,
          ctx.relsSlide, ctx.caminhoSlide, ctx.zip, ctx.fontesDetectadas,
        );
        aplicarResultado(ctx, "p:sp", id, nome, resultado, formas, lerRetanguloComHeranca(noParsed, spTreeLayout, ctx.contextoTema.spTreeMaster));
      } catch (erro) {
        contar(ctx.ignorados, `forma "${nome}" com erro de leitura (${mensagemDeErro(erro)})`);
      }
      continue;
    }

    if (noOrdem.tag === "p:pic") {
      const { id, nome } = lerCNvPr(noParsed);
      if (ctx.sourceLevel !== "slide" && shapeEhPlaceholder(noParsed)) continue;
      try {
        const resultado = await processarImagem(noParsed, ctx.transform, ctx.escalaInfo, ctx.relsSlide, ctx.caminhoSlide, ctx.zip, spTreeLayout);
        aplicarResultado(ctx, "p:pic", id, nome, resultado, formas, lerRetanguloComHeranca(noParsed, spTreeLayout, ctx.contextoTema.spTreeMaster));
      } catch (erro) {
        contar(ctx.ignorados, `imagem "${nome}" com erro de leitura (${mensagemDeErro(erro)})`);
      }
      continue;
    }

    if (noOrdem.tag === "p:graphicFrame") {
      const { id, nome } = lerCNvPr(noParsed);
      try {
        const uri = noParsed?.["a:graphic"]?.["a:graphicData"]?.["@_uri"] as string | undefined;
        if (uri?.includes("/table")) {
          const forma = processarTabela(noParsed, ctx.transform, ctx.escalaInfo, ctx.contextoTema, ctx.fontesDetectadas);
          const frameXfrm = noParsed?.["p:xfrm"];
          const frameRaw = frameXfrm ? lerXfrmBruto({ "a:xfrm": frameXfrm }) : null;
          aplicarResultado(ctx, "p:graphicFrame", id, nome, {
            forma, motivo: forma ? null : `tabela "${nome}" sem linhas/colunas legíveis`,
            fillEncontrado: "tabela", relationshipId: null, assetResolvido: null, geometria: null,
          }, formas, frameRaw);
        } else {
          const tipoObjeto = uri?.includes("/chart") ? "gráfico (chart) — fora do escopo"
            : uri?.includes("diagram") ? "SmartArt (diagram) — fora do escopo"
            : uri?.includes("oleObject") ? "objeto OLE incorporado — fora do escopo"
            : `graphicFrame não suportado (uri: ${uri ?? "desconhecido"})`;
          aplicarResultado(ctx, "p:graphicFrame", id, nome, {
            forma: null, motivo: `"${nome}": ${tipoObjeto}`, fillEncontrado: "nenhum", relationshipId: null, assetResolvido: null, geometria: null,
          }, formas);
        }
      } catch (erro) {
        contar(ctx.ignorados, `graphicFrame "${nome}" com erro de leitura (${mensagemDeErro(erro)})`);
      }
      continue;
    }

    if (noOrdem.tag === "p:cxnSp") {
      const { id, nome } = lerCNvPr(noParsed);
      const forma = processarConector(noParsed, ctx.transform, ctx.escalaInfo, ctx.contextoTema);
      aplicarResultado(ctx, "p:cxnSp", id, nome, {
        forma, motivo: forma ? null : `conector/linha "${nome}" sem transform ou linha resolvível`,
        fillEncontrado: forma ? "line" : "nenhum", relationshipId: null, assetResolvido: null, geometria: "connector",
      }, formas, lerXfrmBruto(noParsed?.["p:spPr"]));
      continue;
    }

    // p:grpSp — recursão, compondo o transform do grupo com o transform acumulado até aqui.
    const { id, nome } = lerCNvPr(noParsed);
    try {
      const grpSpPr = noParsed?.["p:grpSpPr"];
      const xfrm = grpSpPr?.["a:xfrm"];
      const off = xfrm?.["a:off"];
      const ext = xfrm?.["a:ext"];
      const chOff = xfrm?.["a:chOff"];
      const chExt = xfrm?.["a:chExt"];
      const x = extrairNumero(off?.["@_x"]);
      const y = extrairNumero(off?.["@_y"]);
      const cx = extrairNumero(ext?.["@_cx"]);
      const cy = extrairNumero(ext?.["@_cy"]);
      const chx = extrairNumero(chOff?.["@_x"]);
      const chy = extrairNumero(chOff?.["@_y"]);
      const chcx = extrairNumero(chExt?.["@_cx"]);
      const chcy = extrairNumero(chExt?.["@_cy"]);
      const groupRotationRaw = extrairNumero(xfrm?.["@_rot"]);
      const groupRotation = groupRotationRaw !== null ? groupRotationRaw / 60000 : 0;
      const groupFlipH = lerFlagBooleana(xfrm?.["@_flipH"]);
      const groupFlipV = lerFlagBooleana(xfrm?.["@_flipV"]);

      const transformDoGrupoAtual =
        x !== null && y !== null && cx !== null && cy !== null && chx !== null && chy !== null && chcx !== null && chcy !== null
          ? transformoDoGrupo({ x, y }, { cx, cy }, { x: chx, y: chy }, { cx: chcx, cy: chcy }, groupRotation, groupFlipH, groupFlipV)
          : TRANSFORMO_IDENTIDADE;

      const novoContexto: ContextoSlide = {
        ...ctx,
        transform: compor(ctx.transform, transformDoGrupoAtual),
        caminhoGrupos: [...ctx.caminhoGrupos, nome],
        intermediateTarget: [],
      };
      const groupElement: PptxElement = {
        id: id ?? `${ctx.sourceLevel}-group-${ctx.intermediateTarget.length + 1}`,
        name: nome,
        type: "group",
        source: {
          slide: ctx.slideIndice,
          xmlPath: ctx.sourcePath,
          level: ctx.sourceLevel,
          ...(id ? { shapeId: id } : {}),
          ...(nome ? { name: nome } : {}),
        },
        transform: {
          off: { x: x ?? 0, y: y ?? 0 },
          ext: { cx: cx ?? 1, cy: cy ?? 1 },
          ...(chx !== null && chy !== null ? { chOff: { x: chx, y: chy } } : {}),
          ...(chcx !== null && chcy !== null ? { chExt: { cx: chcx, cy: chcy } } : {}),
          rotation: groupRotation,
          flipH: groupFlipH,
          flipV: groupFlipV,
          localTransform: transformDoGrupoAtual,
          worldTransform: novoContexto.transform,
        },
        children: novoContexto.intermediateTarget,
        zIndex: ctx.intermediateTarget.length,
      };
      ctx.intermediateTarget.push(groupElement);
      const formasDoGrupo = await processarArvoreFormas(noParsed, noOrdem.filhos, novoContexto);
      formas.push(...formasDoGrupo);
    } catch (erro) {
      contar(ctx.ignorados, `grupo "${nome}" com erro de leitura (${mensagemDeErro(erro)})`);
    }
  }

  return formas;
}

/** Resolve o fundo (slide → layout → master) e devolve como 1ª forma da lista (zIndex mais baixo), cobrindo o slide inteiro. */
async function resolverFormaDeFundo(
  slideXml: NoXml,
  contextoTema: ContextoTema,
  escalaInfo: EscalaPptx,
  slideSizeEmu: { cx: number; cy: number },
  relsSlide: MapaRelacionamentos,
  caminhoSlide: string,
  zip: JSZip,
): Promise<{ forma: FormaExtraida | null; backgroundColor: string; backgroundImage?: string; backgroundFill?: PptxFill; sourceLevel: "slide" | "layout" | "master" | "default" }> {
  const bgSlide = slideXml?.["p:sld"]?.["p:cSld"]?.["p:bg"] ?? null;
  const fundo = lerFundo(bgSlide, contextoTema, "slide")
    ?? lerFundo(contextoTema.bgLayout, contextoTema, "layout")
    ?? lerFundo(contextoTema.bgMaster, contextoTema, "master");

  // O branco implícito do OOXML pertence ao canvas. Criar uma forma sintética aqui
  // alteraria o z-order e faria um slide vazio parecer ter um objeto editável.
  if (!fundo) return { forma: null, backgroundColor: "#FFFFFF", sourceLevel: "default" };

  const { x, y, w, h } = converterRetanguloEmu({ x: 0, y: 0 }, slideSizeEmu, escalaInfo);

  if (fundo.imagemREmbed) {
    const sourceLevel = fundo.sourceLevel ?? "slide";
    const sourceRels = sourceLevel === "layout" ? contextoTema.relsLayout : sourceLevel === "master" ? contextoTema.relsMaster : relsSlide;
    const sourcePath = sourceLevel === "layout" ? contextoTema.caminhoLayout : sourceLevel === "master" ? contextoTema.caminhoMaster : caminhoSlide;
    const { asset } = await resolverAssetImagem(fundo.imagemREmbed, sourceRels, sourcePath ?? caminhoSlide, zip);
    if (asset) {
      const forma: FormaImagemExtraida = {
        tipo: "imagem", x, y, w, h, rotacao: 0, zIndex: 0,
        source: { slide: 1, xmlPath: sourcePath ?? caminhoSlide, level: sourceLevel === "default" ? "slide" : sourceLevel, relationshipId: fundo.imagemREmbed, name: "Background" },
        bytes: asset.bytes, mimeType: asset.mimeType, nomeArquivo: asset.caminhoMedia.split("/").pop() ?? "fundo",
      };
      return { forma, backgroundColor: "#FFFFFF", sourceLevel };
    }
  }

  if (fundo.tipoCor) {
    const sourceLevel = fundo.sourceLevel ?? "default";
    return {
      forma: { tipo: "caixa", x, y, w, h, rotacao: 0, zIndex: 0, corFundo: fundo.gradientCss ?? fundo.tipoCor, formato: "rect", textoInterno: null, gradientCss: fundo.gradientCss },
      backgroundColor: fundo.tipoCor,
      ...(fundo.gradientCss ? { backgroundImage: fundo.gradientCss } : {}),
      ...(fundo.gradient ? { backgroundFill: { type: "gradient" as const, angle: fundo.gradient.angle, stops: fundo.gradient.stops } } : {}),
      sourceLevel,
    };
  }

  return { forma: null, backgroundColor: "#FFFFFF", sourceLevel: "default" };
}

function converterFormaParaIntermediario(
  forma: FormaExtraida,
  index: number,
  escalaInfo: EscalaPptx,
  slideNumber: number,
  slidePath: string,
  rawTransform?: RetanguloBruto,
  parentTransform: PptxMatrix = MATRIZ_IDENTIDADE,
): PptxElement {
  const flattenedOff = {
    x: (forma.x - escalaInfo.offsetX) / escalaInfo.escala,
    y: (forma.y - escalaInfo.offsetY) / escalaInfo.escala,
  };
  const off = rawTransform?.off ?? flattenedOff;
  const ext = rawTransform?.ext ?? { cx: forma.w / escalaInfo.escala, cy: forma.h / escalaInfo.escala };
  const rotation = rawTransform?.rot ?? forma.rotacao;
  const flipH = rawTransform?.flipH ?? forma.flipH ?? false;
  const flipV = rawTransform?.flipV ?? forma.flipV ?? false;
  const localTransform = multiplicarMatrizes(
    matrizTranslacao(off.x + ext.cx / 2, off.y + ext.cy / 2),
    multiplicarMatrizes(
      matrizRotacao(rotation),
      multiplicarMatrizes(matrizEscala(flipH ? -1 : 1, flipV ? -1 : 1), matrizTranslacao(-ext.cx / 2, -ext.cy / 2)),
    ),
  );
  const source = forma.source ?? { slide: slideNumber, xmlPath: slidePath, level: "slide" as const };
  const type: PptxElement["type"] = forma.tipo === "texto" ? "text" : forma.tipo === "imagem" ? "image"
    : forma.tipo === "tabela" ? "table" : forma.tipo === "linha" ? "line" : "shape";
  const fill = forma.tipo === "caixa"
    ? { type: "solid" as const, color: { hex: forma.corFundo?.startsWith("#") ? forma.corFundo : "#FFFFFF", alpha: 1, css: forma.corFundo ?? "transparent", source: "default" as const } }
    : forma.tipo === "imagem"
      ? {
        type: "image" as const,
        relationshipId: forma.source?.relationshipId ?? "",
        ...(forma.crop ? { crop: forma.crop } : {}),
        mode: forma.tile ? "tile" as const : "stretch" as const,
      }
      : undefined;
  return {
    id: source.shapeId ?? `${source.level}-${slideNumber}-${index + 1}`,
    name: source.name,
    type,
    source,
    transform: {
      off,
      ext,
      rotation,
      flipH,
      flipV,
      localTransform,
      worldTransform: multiplicarMatrizes(parentTransform, localTransform),
    },
    ...(fill ? { fill } : {}),
    ...(forma.tipo === "caixa" && forma.line ? { line: forma.line } : {}),
    ...(forma.tipo === "caixa" && forma.effects ? { effects: forma.effects } : {}),
    ...(forma.tipo === "linha" ? { line: forma.line } : {}),
    ...(forma.tipo === "texto" && forma.richText ? { text: forma.richText } : {}),
    zIndex: index,
  };
}

export async function extrairApresentacaoPptx(
  buffer: Buffer,
  canvasDestino: { width: number; height: number },
): Promise<ApresentacaoPptxExtraida> {
  const zip = await JSZip.loadAsync(buffer);
  validarPacotePptx(zip);

  const presentationXml = await lerXml(zip, "ppt/presentation.xml");
  const sldSz = presentationXml?.["p:presentation"]?.["p:sldSz"];
  const cx = extrairNumero(sldSz?.["@_cx"]) ?? SLIDE_SIZE_FALLBACK_EMU.cx;
  const cy = extrairNumero(sldSz?.["@_cy"]) ?? SLIDE_SIZE_FALLBACK_EMU.cy;
  const slideSizeEmu = { cx, cy };
  const escalaInfo = calcularEscalaPptx(slideSizeEmu, canvasDestino);

  const relsApresentacao = await lerRelacionamentos(zip, "ppt/_rels/presentation.xml.rels");
  const idsOrdenados = comoArray(presentationXml?.["p:presentation"]?.["p:sldIdLst"]?.["p:sldId"])
    .map((s: NoXml) => s?.["@_r:id"])
    .filter((id: unknown): id is string => typeof id === "string");

  const ignorados: Record<string, number> = {};
  const fontesDetectadas = new Set<string>();
  const diagnostico: DiagnosticoElemento[] = [];
  const diagnosticosDetalhados: PptxDiagnosticEntry[] = [];
  const slides: SlideExtraido[] = [];
  const intermediateSlides: PptxIntermediateSlide[] = [];

  let indiceSlide = 0;
  for (const rId of idsOrdenados) {
    indiceSlide += 1;
    const alvo = relsApresentacao[rId];
    if (!alvo) continue;
    const caminhoSlide = resolverCaminhoRelativo("ppt/presentation.xml", alvo);

    try {
      const lido = await lerXmlComTexto(zip, caminhoSlide);
      if (!lido) {
        slides.push({ formas: [], backgroundColor: "#FFFFFF", sourcePath: caminhoSlide });
        intermediateSlides.push({ number: indiceSlide, xmlPath: caminhoSlide, background: { fill: { type: "solid", color: { hex: "#FFFFFF", alpha: 1, css: "#FFFFFF", source: "default" } }, sourceLevel: "default" }, elements: [] });
        continue;
      }
      const { parsed: slideXml, texto: xmlCru } = lido;
      const spTree = slideXml?.["p:sld"]?.["p:cSld"]?.["p:spTree"];
      if (!spTree) {
        slides.push({ formas: [], backgroundColor: "#FFFFFF", sourcePath: caminhoSlide });
        intermediateSlides.push({ number: indiceSlide, xmlPath: caminhoSlide, background: { fill: { type: "solid", color: { hex: "#FFFFFF", alpha: 1, css: "#FFFFFF", source: "default" } }, sourceLevel: "default" }, elements: [] });
        continue;
      }

      const nomePasta = caminhoSlide.split("/").slice(0, -1).join("/");
      const nomeArquivo = caminhoSlide.split("/").pop() ?? "";
      const caminhoRels = `${nomePasta}/_rels/${nomeArquivo}.rels`;
      const relsSlide = await lerRelacionamentos(zip, caminhoRels);
      const contextoTema = await resolverContextoTema(zip, caminhoSlide);

      const formaFundo = await resolverFormaDeFundo(slideXml, contextoTema, escalaInfo, slideSizeEmu, relsSlide, caminhoSlide, zip).catch((erro) => {
        console.error(`[extrairApresentacaoPptx] Falha ao resolver fundo de ${caminhoSlide}`, erro);
        return {
          forma: null,
          backgroundColor: "#FFFFFF",
          backgroundImage: undefined,
          backgroundFill: undefined,
          sourceLevel: "default" as const,
        };
      });

      const zCounter = { value: 0 };
      const intermediateElements: PptxElement[] = [];
      const ctxSlide: ContextoSlide = {
        transform: TRANSFORMO_IDENTIDADE,
        escalaInfo,
        relsSlide,
        caminhoSlide,
        zip,
        ignorados,
        contextoTema,
        xmlCru,
        slideIndice: indiceSlide,
        caminhoGrupos: [],
        fontesDetectadas,
        diagnostico,
        diagnosticosDetalhados,
        sourceLevel: "slide",
        sourcePath: caminhoSlide,
        zCounter,
        intermediateTarget: intermediateElements,
      };

      const formasHerdadas: FormaExtraida[] = [];
      const processarOrigemHerdada = async (
        level: "master" | "layout",
        sourcePath: string | null,
        relationships: MapaRelacionamentos,
      ) => {
        if (!sourcePath) return;
        const source = await lerXmlComTexto(zip, sourcePath);
        if (!source) return;
        const root = level === "master" ? source.parsed?.["p:sldMaster"] : source.parsed?.["p:sldLayout"];
        const sourceTree = root?.["p:cSld"]?.["p:spTree"];
        if (!sourceTree) return;
        const sourceContext: ContextoSlide = {
          ...ctxSlide,
          relsSlide: relationships,
          caminhoSlide: sourcePath,
          xmlCru: source.texto,
          sourceLevel: level,
          sourcePath,
        };
        formasHerdadas.push(...await processarArvoreFormas(sourceTree, construirArvoreOrdem(source.texto), sourceContext));
      };

      const showMasterShapes = !["0", "false"].includes(String(slideXml?.["p:sld"]?.["@_showMasterSp"] ?? "1").toLowerCase())
        && !["0", "false"].includes(String(contextoTema.layoutXml?.["p:sldLayout"]?.["@_showMasterSp"] ?? "1").toLowerCase());
      if (showMasterShapes) await processarOrigemHerdada("master", contextoTema.caminhoMaster, contextoTema.relsMaster);
      await processarOrigemHerdada("layout", contextoTema.caminhoLayout, contextoTema.relsLayout);

      const arvoreOrdem = construirArvoreOrdem(xmlCru);
      const formasSlide = await processarArvoreFormas(spTree, arvoreOrdem, ctxSlide);
      const formas = [...formasHerdadas, ...formasSlide];

      const diagnosticoDoSlide = diagnostico.filter((d) => d.slide === indiceSlide);
      if (diagnosticoDoSlide.length > 0) {
        console.info(`[pptx-diag] slide ${indiceSlide} (${caminhoSlide}) — ${diagnosticoDoSlide.length} elemento(s)`, diagnosticoDoSlide);
      }

      const backgroundSourcePath = formaFundo.sourceLevel === "master" ? contextoTema.caminhoMaster
        : formaFundo.sourceLevel === "layout" ? contextoTema.caminhoLayout : caminhoSlide;
      if (formaFundo.forma) {
        formaFundo.forma.source = {
          slide: indiceSlide,
          xmlPath: backgroundSourcePath ?? caminhoSlide,
          level: formaFundo.sourceLevel === "default" ? "slide" : formaFundo.sourceLevel,
          ...(formaFundo.forma.source?.relationshipId ? { relationshipId: formaFundo.forma.source.relationshipId } : {}),
          name: "Background",
        };
      }
      const formasComFundo = formaFundo.forma ? [formaFundo.forma, ...formas] : formas;
      slides.push({
        formas: formasComFundo,
        backgroundColor: formaFundo.backgroundColor,
        ...(formaFundo.backgroundImage ? { backgroundImage: formaFundo.backgroundImage } : {}),
        sourcePath: caminhoSlide,
      });
      const backgroundFill = formaFundo.backgroundFill ?? (formaFundo.forma?.tipo === "imagem"
        ? { type: "image" as const, relationshipId: formaFundo.forma.source?.relationshipId ?? "", mode: "stretch" as const }
        : { type: "solid" as const, color: { hex: formaFundo.backgroundColor.startsWith("#") ? formaFundo.backgroundColor.slice(0, 7) : "#FFFFFF", alpha: 1, css: formaFundo.backgroundColor, source: "default" as const } });
      intermediateSlides.push({
        number: indiceSlide,
        xmlPath: caminhoSlide,
        background: { fill: backgroundFill, sourceLevel: formaFundo.sourceLevel, sourcePath: backgroundSourcePath ?? undefined },
        elements: intermediateElements,
      });
    } catch (erro) {
      console.error(`[extrairApresentacaoPptx] Falha ao processar ${caminhoSlide}`, erro);
      slides.push({ formas: [], backgroundColor: "#FFFFFF", sourcePath: caminhoSlide });
      intermediateSlides.push({ number: indiceSlide, xmlPath: caminhoSlide, background: { fill: { type: "solid", color: { hex: "#FFFFFF", alpha: 1, css: "#FFFFFF", source: "default" } }, sourceLevel: "default" }, elements: [] });
      contar(ignorados, "slide com erro de leitura (ficou vazio)");
    }
  }

  const fontes = [...fontesDetectadas].sort();
  return {
    slideSizeEmu,
    slides,
    ignorados,
    // Mantido por compatibilidade com consumidores antigos; a disponibilidade real
    // agora é decidida no browser pelo FontResolver.
    fontesNaoAplicadas: fontes,
    fontesDetectadas: fontes,
    diagnostico,
    diagnosticosDetalhados,
    intermediateModel: { version: 1, importerVersion: PPTX_IMPORTER_VERSION, slideSizeEmu, slides: intermediateSlides },
  };
}
