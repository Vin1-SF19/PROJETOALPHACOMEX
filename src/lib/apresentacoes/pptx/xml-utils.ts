import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NoXml = any;

export const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => [
    "p:sldId", "Relationship",
    "p:sp", "p:pic", "p:graphicFrame", "p:grpSp", "p:cxnSp",
    "a:p", "a:r", "a:tr", "a:tc", "a:gridCol",
  ].includes(name),
});

export function comoArray<T>(valor: T | T[] | undefined): T[] {
  if (valor === undefined) return [];
  return Array.isArray(valor) ? valor : [valor];
}

export async function lerXml(zip: JSZip, caminho: string): Promise<NoXml | null> {
  const arquivo = zip.file(caminho);
  if (!arquivo) return null;
  const texto = await arquivo.async("text");
  return XML_PARSER.parse(texto);
}

/** Igual a `lerXml`, mas também devolve o texto XML CRU — necessário pra reprocessar pedaços
 * específicos (ordem real de irmãos intercalados, sequência de comandos de `<a:path>`) que o
 * `fast-xml-parser` (modo normal, agrupado por tag) não preserva. Ver `ordem-xml.ts`. */
export async function lerXmlComTexto(zip: JSZip, caminho: string): Promise<{ parsed: NoXml; texto: string } | null> {
  const arquivo = zip.file(caminho);
  if (!arquivo) return null;
  const texto = await arquivo.async("text");
  return { parsed: XML_PARSER.parse(texto), texto };
}

export interface MapaRelacionamentos {
  [rId: string]: string;
}

export async function lerRelacionamentos(zip: JSZip, caminho: string): Promise<MapaRelacionamentos> {
  const xml = await lerXml(zip, caminho);
  const mapa: MapaRelacionamentos = {};
  const relacionamentos = comoArray(xml?.Relationships?.Relationship);
  for (const rel of relacionamentos) {
    const id = rel?.["@_Id"];
    const target = rel?.["@_Target"];
    if (typeof id === "string" && typeof target === "string") mapa[id] = target;
  }
  return mapa;
}

/** Resolve um caminho relativo (ex.: `../media/image1.png`, a partir de `ppt/slides/`) pro caminho absoluto dentro do zip. */
export function resolverCaminhoRelativo(base: string, relativo: string): string {
  if (relativo.startsWith("/")) return relativo.slice(1);
  const partesBase = base.split("/").slice(0, -1);
  const partesRelativo = relativo.split("/");
  for (const parte of partesRelativo) {
    if (parte === "..") partesBase.pop();
    else if (parte !== ".") partesBase.push(parte);
  }
  return partesBase.join("/");
}

/** Acha, dentro de um mapa rId→target já resolvido, o primeiro relacionamento cujo Target
 * bate com um prefixo de pasta (ex.: "slideLayouts/" ou "slideMasters/") — usado pra achar
 * layout/master/tema sem precisar ler o campo `Type` (mais simples e tolerante a variações). */
export function acharAlvoPorPrefixo(rels: MapaRelacionamentos, prefixo: string): string | null {
  for (const alvo of Object.values(rels)) {
    if (alvo.includes(prefixo)) return alvo;
  }
  return null;
}

export function extrairNumero(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** Prefere a alternativa SVG (`<asvg:svgBlip>`, extensão do Office 2016+) sobre o raster
 * (`@_r:embed` direto) quando presente — mesma imagem em vetor, mais nítida. A extensão vive em
 * `<a:blip><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip r:embed="..."/></a:ext></a:extLst></a:blip>`. */
export function resolverBlipPreferido(blip: NoXml | undefined): string | undefined {
  const extLst = comoArray(blip?.["a:extLst"]?.["a:ext"]);
  for (const ext of extLst) {
    const rEmbedSvg = ext?.["asvg:svgBlip"]?.["@_r:embed"];
    if (typeof rEmbedSvg === "string") return rEmbedSvg;
  }
  const rEmbedRaster = blip?.["@_r:embed"];
  return typeof rEmbedRaster === "string" ? rEmbedRaster : undefined;
}
