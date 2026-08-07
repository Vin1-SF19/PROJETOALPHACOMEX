import JSZip from "jszip";
import type { ApresentacaoPptxExtraida, DiagnosticoElemento, FormaExtraida, FormaImagemExtraida, FormaTabelaExtraida, FormaTextoExtraida, SlideExtraido } from "./tipos";
import { SLIDE_SIZE_FALLBACK_EMU, calcularEscalaPptx, converterRetanguloEmu, type EscalaPptx } from "./unidades";
import {
  comoArray, extrairNumero, lerRelacionamentos, lerXml, lerXmlComTexto,
  resolverBlipPreferido, resolverCaminhoRelativo, type MapaRelacionamentos, type NoXml,
} from "./xml-utils";
import { buscarPosicaoNoLayout, lerCorOoxml, lerFundo, resolverContextoTema, type ContextoTema } from "./tema";
import { ConsumidorPorTipo, construirArvoreOrdem, xmlDoNo, type NoOrdem } from "./ordem-xml";
import { construirSvgFormaColorida, construirSvgImagemRecortada, extrairGeometriaCustGeom, type GeometriaCustGeom } from "./geometria";

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
 * path colorido quando é só `solidFill`. Nenhuma forma reconhecida (imagem/texto/cor) é
 * descartada em silêncio: toda forma que não vira componente ganha um motivo ESPECÍFICO em
 * `ignorados` (nunca uma mensagem genérica única) e uma entrada em `diagnostico`.
 *
 * Fora do escopo (decisão explícita — cada caso cai em `ignorados` com motivo próprio, nunca
 * trava a extração inteira):
 * - Gráficos (`<c:chart>`), SmartArt (`<dgm:...>`), objetos OLE incorporados.
 * - `<a:gradFill>`/`<a:pattFill>` (gradiente/padrão) em forma — sem equivalente no schema de
 *   componente; precisaria do mesmo fallback SVG do `custGeom` colorido, não implementado pra
 *   esses 2 casos.
 * - `<a:srcRect>` (crop percentual do bitmap original) — não corta o BYTE da imagem, usa
 *   `objectFit: "cover"` como aproximação (preenche sem distorcer, mas não recorta pixel a
 *   pixel como o PowerPoint). Cortar de verdade exigiria uma lib de processamento de imagem no
 *   servidor, que este módulo não usa.
 * - Conectores/linhas (`<p:cxnSp>`) — contados em `ignorados` (não descartados em silêncio), mas
 *   sem renderização: não existe componente de linha/seta no Alpha Motion ainda.
 * - Fonte (`fontFamily`) do texto — DETECTADA e reportada em `fontesNaoAplicadas` (nunca trocada
 *   silenciosamente pela fonte padrão do sistema), mas não aplicada — o componente `texto` do
 *   Alpha Motion não tem campo `fontFamily`.
 * - `flipH`/`flipV` (espelhamento) — DETECTADO e reportado no campo `geometria` do diagnóstico
 *   quando presente, mas não aplicado — nem `imagem` nem `caixa` têm campo de flip no schema de
 *   componente. Aplicar de verdade exigiria mudança de schema + render engine, fora do escopo
 *   de "corrigir o importador". No arquivo de regressão usado nesta correção, todo `flipH`/`flipV`
 *   está `false` (confirmado por inspeção direta), então não há impacto visual conhecido hoje.
 * - Rich text por TRECHO — o componente `texto` guarda 1 estilo por caixa inteira (não por run);
 *   usa cor/tamanho/negrito do 1º run que os definir pra caixa toda.
 * - `<a:arcTo>` dentro de `custGeom` — convertido pra arco elíptico SVG via geometria analítica
 *   (centro/ângulo a partir de wR/hR/stAng/swAng), mas sem exemplo real testado (não apareceu
 *   nos arquivos de regressão inspecionados) — trate como best-effort, não validado visualmente.
 * - Animações, notas do apresentador, EMF/WMF (formato vetorial legado do Office, sem
 *   conversor disponível no servidor).
 */

// ---------- Transformação de coordenadas EMU (composição pra grupos aninhados) ----------

interface TransformoEmu {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

const TRANSFORMO_IDENTIDADE: TransformoEmu = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 };

function aplicarTransformo(t: TransformoEmu, off: { x: number; y: number }, ext: { cx: number; cy: number }) {
  return {
    off: { x: off.x * t.scaleX + t.offsetX, y: off.y * t.scaleY + t.offsetY },
    ext: { cx: ext.cx * t.scaleX, cy: ext.cy * t.scaleY },
  };
}

/** Transform local de 1 grupo: mapeia coordenadas do espaço-filho (`chOff`/`chExt`) pro mesmo espaço do `off`/`ext` do próprio grupo. */
function transformoDoGrupo(
  off: { x: number; y: number },
  ext: { cx: number; cy: number },
  chOff: { x: number; y: number },
  chExt: { cx: number; cy: number },
): TransformoEmu {
  const scaleX = chExt.cx !== 0 ? ext.cx / chExt.cx : 1;
  const scaleY = chExt.cy !== 0 ? ext.cy / chExt.cy : 1;
  return { scaleX, scaleY, offsetX: off.x - chOff.x * scaleX, offsetY: off.y - chOff.y * scaleY };
}

/** Compõe 2 transforms — `interno` se aplica PRIMEIRO (grupo mais profundo), `externo` DEPOIS. */
function compor(externo: TransformoEmu, interno: TransformoEmu): TransformoEmu {
  return {
    scaleX: interno.scaleX * externo.scaleX,
    scaleY: interno.scaleY * externo.scaleY,
    offsetX: interno.offsetX * externo.scaleX + externo.offsetX,
    offsetY: interno.offsetY * externo.scaleY + externo.offsetY,
  };
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
function lerRetanguloComHeranca(sp: NoXml, spTreeLayout: NoXml | null): RetanguloBruto | null {
  const direto = lerXfrmBruto(sp?.["p:spPr"]);
  if (direto) return direto;

  const ph = sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"] ?? sp?.["p:nvPicPr"]?.["p:nvPr"]?.["p:ph"];
  if (!ph) return null;
  return buscarPosicaoNoLayout(spTreeLayout, ph["@_type"] ?? "body", ph["@_idx"]);
}

function converterComTransform(bruto: RetanguloBruto, transform: TransformoEmu, escalaInfo: EscalaPptx) {
  const mapeado = aplicarTransformo(transform, bruto.off, bruto.ext);
  return { ...converterRetanguloEmu(mapeado.off, mapeado.ext, escalaInfo), rotacao: bruto.rot };
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

function extrairTextoDeBody(txBody: NoXml, contexto: ContextoTema, fontesDetectadas: Set<string>): {
  paragrafos: string[];
  corTexto: string | null;
  negrito: boolean;
  tamanhoFonte: number | null;
  alinhamento: "left" | "center" | "right" | null;
} {
  const paragrafosXml = comoArray(txBody?.["a:p"]);
  const paragrafos: string[] = [];
  let corTexto: string | null = null;
  let negrito = false;
  let tamanhoFonte: number | null = null;
  let alinhamento: "left" | "center" | "right" | null = null;

  for (const p of paragrafosXml) {
    const runs = comoArray(p?.["a:r"]);
    const textoParagrafo = runs
      .map((r) => (typeof r?.["a:t"] === "string" ? r["a:t"] : typeof r?.["a:t"] === "number" ? String(r["a:t"]) : ""))
      .join("");
    paragrafos.push(textoParagrafo);

    const algn = p?.["a:pPr"]?.["@_algn"];
    if (!alinhamento && typeof algn === "string") {
      if (algn === "ctr") alinhamento = "center";
      else if (algn === "r") alinhamento = "right";
      else if (algn === "l") alinhamento = "left";
    }

    for (const r of runs) {
      const rPr = r?.["a:rPr"];
      if (!rPr) continue;
      if (rPr["@_b"] === "1" || rPr["@_b"] === 1) negrito = true;
      if (tamanhoFonte === null && rPr["@_sz"] !== undefined) {
        const sz = extrairNumero(rPr["@_sz"]);
        if (sz !== null) tamanhoFonte = Math.round((sz / 100) * 1.333);
      }
      if (!corTexto) {
        corTexto = lerCorOoxml(rPr["a:solidFill"], contexto);
      }
      const typeface = rPr["a:latin"]?.["@_typeface"];
      if (typeof typeface === "string" && typeface.trim()) fontesDetectadas.add(typeface.trim());
    }
  }

  return { paragrafos, corTexto, negrito, tamanhoFonte, alinhamento };
}

const PREFIXOS_TITULO = new Set(["title", "ctrTitle"]);

function processarFormaTexto(
  sp: NoXml,
  bruto: RetanguloBruto,
  transform: TransformoEmu,
  escalaInfo: EscalaPptx,
  contexto: ContextoTema,
  fontesDetectadas: Set<string>,
): FormaTextoExtraida | null {
  const txBody = sp?.["p:txBody"];
  if (!txBody) return null;
  const { paragrafos, corTexto, negrito, tamanhoFonte, alinhamento } = extrairTextoDeBody(txBody, contexto, fontesDetectadas);
  if (paragrafos.every((p) => !p.trim())) return null;

  const tipoPlaceholder = sp?.["p:nvSpPr"]?.["p:nvPr"]?.["p:ph"]?.["@_type"];
  const ehTitulo = typeof tipoPlaceholder === "string" && PREFIXOS_TITULO.has(tipoPlaceholder);

  const { x, y, w, h, rotacao } = converterComTransform(bruto, transform, escalaInfo);
  return { tipo: "texto", x, y, w, h, rotacao, paragrafos, corTexto, negrito, tamanhoFonte, alinhamento, ehTitulo };
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
): Promise<ResultadoProcessamento> {
  const blip = sp?.["p:spPr"]?.["a:blipFill"]?.["a:blip"];
  const rEmbed = resolverBlipPreferido(blip);
  const { asset, motivo } = await resolverAssetImagem(rEmbed, relsSlide, caminhoSlide, zip);
  if (!asset) {
    return { forma: null, motivo: `imagem em forma (blipFill): ${motivo}`, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: null, geometria: null };
  }

  const { x, y, w, h, rotacao } = converterComTransform(bruto, transform, escalaInfo);

  // custGeom não-retangular → recorta a imagem pelo path real (clipPath), em vez de mostrá-la
  // como um retângulo (que destoaria visualmente da forma original — ex.: foto com crop arredondado).
  if (geometria && !geometria.ehRetangulo && geometria.pathSvg) {
    const dataUriOriginal = `data:${asset.mimeType};base64,${Buffer.from(asset.bytes).toString("base64")}`;
    const svgMarkup = construirSvgImagemRecortada(geometria.pathSvg, geometria.viewBoxW, geometria.viewBoxH, dataUriOriginal);
    const bytesSvg = new TextEncoder().encode(svgMarkup);
    return {
      forma: { tipo: "imagem", x, y, w, h, rotacao, bytes: bytesSvg, mimeType: "image/svg+xml", nomeArquivo: `${asset.caminhoMedia.split("/").pop() ?? "imagem"}-recortada.svg` },
      motivo: null, fillEncontrado: "blipFill (com recorte custGeom)", relationshipId: rEmbed ?? null, assetResolvido: asset.caminhoMedia, geometria: null,
    };
  }

  return {
    forma: { tipo: "imagem", x, y, w, h, rotacao, bytes: asset.bytes, mimeType: asset.mimeType, nomeArquivo: asset.caminhoMedia.split("/").pop() ?? "imagem" },
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
  const bruto = lerRetanguloComHeranca(sp, spTreeLayout);
  if (!bruto) {
    return {
      forma: null, motivo: `forma "${nomeForma}" sem posição resolvível (xfrm ausente e sem placeholder herdado do layout)`,
      fillEncontrado: "desconhecido", relationshipId: null, assetResolvido: null, geometria: null,
    };
  }

  const spPr = sp?.["p:spPr"];
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
  const descricaoGeometria = baseGeometria + (bruto.flipH || bruto.flipV ? ` [flip${bruto.flipH ? "H" : ""}${bruto.flipV ? "V" : ""} detectado, não suportado pelo schema]` : "");

  // 1) Imagem usada como preenchimento da forma — com ou sem recorte por custGeom.
  if (spPr?.["a:blipFill"]) {
    const resultado = await processarFormaImagemDeShape(sp, bruto, transform, escalaInfo, relsSlide, caminhoSlide, zip, geometria);
    return { ...resultado, geometria: descricaoGeometria };
  }

  const corFundo = lerCorOoxml(spPr?.["a:solidFill"], contexto);
  const txBody = sp?.["p:txBody"];
  const textoInterno = txBody ? processarFormaTexto(sp, bruto, transform, escalaInfo, contexto, fontesDetectadas) : null;

  const ehRetSimples = typeof prst === "string" && GEOMETRIAS_SUPORTADAS.has(prst);
  const ehRetViaCustGeom = geometria?.ehRetangulo === true;

  // 2) Retângulo/roundRect/ellipse (nativo OU custGeom disfarçado de retângulo — comum em
  //    exports de ferramentas de design) com fundo sólido → "caixa" (card), texto aninhado se tiver.
  if ((ehRetSimples || ehRetViaCustGeom) && corFundo) {
    const { x, y, w, h, rotacao } = converterComTransform(bruto, transform, escalaInfo);
    const formato = prst === "roundRect" ? "roundRect" : prst === "ellipse" ? "ellipse" : "rect";
    return {
      forma: { tipo: "caixa", x, y, w, h, rotacao, corFundo, formato, textoInterno },
      motivo: null, fillEncontrado: "solidFill", relationshipId: null, assetResolvido: null, geometria: descricaoGeometria,
    };
  }

  // 3) custGeom genuinamente não-retangular com fundo sólido — sem card nativo pra path
  //    arbitrário; fallback SVG (o path real preenchido) em vez de descartar a forma inteira.
  if (geometria && !geometria.ehRetangulo && geometria.pathSvg && corFundo) {
    const { x, y, w, h, rotacao } = converterComTransform(bruto, transform, escalaInfo);
    const svgMarkup = construirSvgFormaColorida(geometria.pathSvg, geometria.viewBoxW, geometria.viewBoxH, corFundo);
    const bytes = new TextEncoder().encode(svgMarkup);
    return {
      forma: { tipo: "imagem", x, y, w, h, rotacao, bytes, mimeType: "image/svg+xml", nomeArquivo: `forma-${nomeForma}.svg` },
      motivo: null, fillEncontrado: "custGeom colorido (fallback SVG)", relationshipId: null, assetResolvido: null, geometria: descricaoGeometria,
    };
  }

  // 4) Sem fundo reconhecido: se tiver texto, extrai só o texto (perde a moldura, preserva conteúdo).
  if (textoInterno) {
    return { forma: textoInterno, motivo: null, fillEncontrado: "texto sem forma de fundo reconhecida", relationshipId: null, assetResolvido: null, geometria: descricaoGeometria };
  }

  // 5) Nada aproveitável — motivo ESPECÍFICO (nunca a antiga mensagem genérica).
  const tipoFill = spPr?.["a:gradFill"] ? "gradFill (gradiente, sem equivalente no schema)"
    : spPr?.["a:pattFill"] ? "pattFill (padrão, sem equivalente no schema)"
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

  const blip = pic?.["p:blipFill"]?.["a:blip"];
  const rEmbed = resolverBlipPreferido(blip);
  const { asset, motivo } = await resolverAssetImagem(rEmbed, relsSlide, caminhoSlide, zip);
  if (!asset) {
    return { forma: null, motivo: `p:pic: ${motivo}`, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: null, geometria: null };
  }

  const { x, y, w, h, rotacao } = converterComTransform(bruto, transform, escalaInfo);
  const notaFlip = bruto.flipH || bruto.flipV ? `flip${bruto.flipH ? "H" : ""}${bruto.flipV ? "V" : ""} detectado, não suportado pelo schema` : null;
  return {
    forma: { tipo: "imagem", x, y, w, h, rotacao, bytes: asset.bytes, mimeType: asset.mimeType, nomeArquivo: asset.caminhoMedia.split("/").pop() ?? "imagem" },
    motivo: null, fillEncontrado: "blipFill", relationshipId: rEmbed ?? null, assetResolvido: asset.caminhoMedia, geometria: notaFlip,
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
      const { paragrafos } = extrairTextoDeBody(tc["a:txBody"] ?? {}, contexto, fontesDetectadas);
      return paragrafos.join(" ").trim();
    }),
  );
  if (linhasTexto.length === 0) return null;

  const [colunas, ...linhas] = linhasTexto;
  const { x: px, y: py, w, h, rotacao } = converterComTransform({ off: { x, y }, ext: { cx, cy }, rot: 0, flipH: false, flipV: false }, transform, escalaInfo);
  return { tipo: "tabela", x: px, y: py, w, h, rotacao, colunas, linhas };
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
}

function contar(ignorados: Record<string, number>, chave: string) {
  ignorados[chave] = (ignorados[chave] ?? 0) + 1;
}

function registrarDiagnostico(ctx: ContextoSlide, tipoOoxml: string, shapeId: string | null, nome: string, r: ResultadoProcessamento) {
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
}

function aplicarResultado(ctx: ContextoSlide, tipoOoxml: string, shapeId: string | null, nome: string, r: ResultadoProcessamento, formas: FormaExtraida[]) {
  if (r.forma) formas.push(r.forma);
  else contar(ctx.ignorados, r.motivo ?? `${tipoOoxml} sem motivo registrado`);
  registrarDiagnostico(ctx, tipoOoxml, shapeId, nome, r);
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
      try {
        const xmlShapeCru = xmlDoNo(ctx.xmlCru, noOrdem);
        const resultado = await processarShape(
          noParsed, xmlShapeCru, ctx.transform, ctx.escalaInfo, ctx.contextoTema, spTreeLayout,
          ctx.relsSlide, ctx.caminhoSlide, ctx.zip, ctx.fontesDetectadas,
        );
        aplicarResultado(ctx, "p:sp", id, nome, resultado, formas);
      } catch (erro) {
        contar(ctx.ignorados, `forma "${nome}" com erro de leitura (${mensagemDeErro(erro)})`);
      }
      continue;
    }

    if (noOrdem.tag === "p:pic") {
      const { id, nome } = lerCNvPr(noParsed);
      try {
        const resultado = await processarImagem(noParsed, ctx.transform, ctx.escalaInfo, ctx.relsSlide, ctx.caminhoSlide, ctx.zip, spTreeLayout);
        aplicarResultado(ctx, "p:pic", id, nome, resultado, formas);
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
          aplicarResultado(ctx, "p:graphicFrame", id, nome, {
            forma, motivo: forma ? null : `tabela "${nome}" sem linhas/colunas legíveis`,
            fillEncontrado: "tabela", relationshipId: null, assetResolvido: null, geometria: null,
          }, formas);
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
      aplicarResultado(ctx, "p:cxnSp", id, nome, {
        forma: null, motivo: `conector/linha "${nome}" (p:cxnSp) não tem componente equivalente nesta versão`,
        fillEncontrado: "nenhum", relationshipId: null, assetResolvido: null, geometria: null,
      }, formas);
      continue;
    }

    // p:grpSp — recursão, compondo o transform do grupo com o transform acumulado até aqui.
    const { nome } = lerCNvPr(noParsed);
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

      const transformDoGrupoAtual =
        x !== null && y !== null && cx !== null && cy !== null && chx !== null && chy !== null && chcx !== null && chcy !== null
          ? transformoDoGrupo({ x, y }, { cx, cy }, { x: chx, y: chy }, { cx: chcx, cy: chcy })
          : TRANSFORMO_IDENTIDADE;

      const novoContexto: ContextoSlide = {
        ...ctx,
        transform: compor(ctx.transform, transformDoGrupoAtual),
        caminhoGrupos: [...ctx.caminhoGrupos, nome],
      };
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
): Promise<FormaExtraida | null> {
  const bgSlide = slideXml?.["p:sld"]?.["p:cSld"]?.["p:bg"] ?? null;
  const fundo = lerFundo(bgSlide, contextoTema) ?? lerFundo(contextoTema.bgLayout, contextoTema) ?? lerFundo(contextoTema.bgMaster, contextoTema);
  if (!fundo) return null;

  const { x, y, w, h } = converterRetanguloEmu({ x: 0, y: 0 }, slideSizeEmu, escalaInfo);

  if (fundo.imagemREmbed) {
    const { asset } = await resolverAssetImagem(fundo.imagemREmbed, relsSlide, caminhoSlide, zip);
    if (!asset) return null;
    const forma: FormaImagemExtraida = { tipo: "imagem", x, y, w, h, rotacao: 0, bytes: asset.bytes, mimeType: asset.mimeType, nomeArquivo: asset.caminhoMedia.split("/").pop() ?? "fundo" };
    return forma;
  }

  if (fundo.tipoCor) {
    return { tipo: "caixa", x, y, w, h, rotacao: 0, corFundo: fundo.tipoCor, formato: "rect", textoInterno: null };
  }

  return null;
}

export async function extrairApresentacaoPptx(
  buffer: Buffer,
  canvasDestino: { width: number; height: number },
): Promise<ApresentacaoPptxExtraida> {
  const zip = await JSZip.loadAsync(buffer);

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
  const slides: SlideExtraido[] = [];

  let indiceSlide = 0;
  for (const rId of idsOrdenados) {
    indiceSlide += 1;
    const alvo = relsApresentacao[rId];
    if (!alvo) continue;
    const caminhoSlide = resolverCaminhoRelativo("ppt/presentation.xml", alvo);

    try {
      const lido = await lerXmlComTexto(zip, caminhoSlide);
      if (!lido) {
        slides.push({ formas: [] });
        continue;
      }
      const { parsed: slideXml, texto: xmlCru } = lido;
      const spTree = slideXml?.["p:sld"]?.["p:cSld"]?.["p:spTree"];
      if (!spTree) {
        slides.push({ formas: [] });
        continue;
      }

      const nomePasta = caminhoSlide.split("/").slice(0, -1).join("/");
      const nomeArquivo = caminhoSlide.split("/").pop() ?? "";
      const caminhoRels = `${nomePasta}/_rels/${nomeArquivo}.rels`;
      const relsSlide = await lerRelacionamentos(zip, caminhoRels);
      const contextoTema = await resolverContextoTema(zip, caminhoSlide);

      const formaFundo = await resolverFormaDeFundo(slideXml, contextoTema, escalaInfo, slideSizeEmu, relsSlide, caminhoSlide, zip).catch((erro) => {
        console.error(`[extrairApresentacaoPptx] Falha ao resolver fundo de ${caminhoSlide}`, erro);
        return null;
      });

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
      };

      const arvoreOrdem = construirArvoreOrdem(xmlCru);
      const formas = await processarArvoreFormas(spTree, arvoreOrdem, ctxSlide);

      const diagnosticoDoSlide = diagnostico.filter((d) => d.slide === indiceSlide);
      if (diagnosticoDoSlide.length > 0) {
        console.info(`[pptx-diag] slide ${indiceSlide} (${caminhoSlide}) — ${diagnosticoDoSlide.length} elemento(s)`, diagnosticoDoSlide);
      }

      slides.push({ formas: formaFundo ? [formaFundo, ...formas] : formas });
    } catch (erro) {
      console.error(`[extrairApresentacaoPptx] Falha ao processar ${caminhoSlide}`, erro);
      slides.push({ formas: [] });
      contar(ignorados, "slide com erro de leitura (ficou vazio)");
    }
  }

  return { slideSizeEmu, slides, ignorados, fontesNaoAplicadas: [...fontesDetectadas].sort(), diagnostico };
}
