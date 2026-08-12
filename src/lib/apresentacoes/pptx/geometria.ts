/**
 * Extração e conversão de `<a:custGeom>` (geometria customizada/freeform) pra SVG — necessário
 * porque ferramentas de design (Figma, Canva e outras) frequentemente exportam TODA forma como
 * `custGeom`, inclusive retângulos simples, e fotos com recorte arredondado/customizado usam
 * `custGeom` real (curvas `cubicBezTo`) como máscara pro preenchimento de imagem.
 *
 * Os comandos de um `<a:path>` (`moveTo`/`lnTo`/`cubicBezTo`/`quadBezTo`/`arcTo`/`close`) são
 * uma SEQUÊNCIA ordenada — o `fast-xml-parser` (modo normal) agrupa por nome de tag e perde
 * essa ordem, o que desenharia uma forma errada, não só mal posicionada. Por isso este módulo
 * opera direto sobre o XML CRU do shape (obtido via `ordem-xml.ts`), com um scanner sequencial
 * dedicado — não usa o `fast-xml-parser` pra path nenhum.
 */

export interface ComandoPath {
  tipo: "M" | "L" | "C" | "Q" | "Z" | "A";
  pontos: Array<{ x: number; y: number }>;
  wR?: number;
  hR?: number;
  stAng?: number;
  swAng?: number;
}

const REGEX_COMANDO = /<a:(moveTo|lnTo|cubicBezTo|quadBezTo|close|arcTo)\b([^>]*?)(\/>|>([\s\S]*?)<\/a:\1>)/g;
const REGEX_PONTO = /<a:pt\s+x="(-?\d+)"\s+y="(-?\d+)"\s*\/>/g;

function extrairAtributoNumerico(atributos: string, nome: string): number {
  const m = new RegExp(`\\b${nome}="(-?\\d+)"`).exec(atributos);
  return m ? Number(m[1]) : 0;
}

/** Extrai a sequência de comandos de 1 `<a:path>...</a:path>` (conteúdo interno, sem a tag path em si). */
export function extrairComandosPath(xmlPathCru: string): ComandoPath[] {
  const comandos: ComandoPath[] = [];
  REGEX_COMANDO.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = REGEX_COMANDO.exec(xmlPathCru))) {
    const [, nome, atributos, , conteudoInterno] = match;

    if (nome === "close") {
      comandos.push({ tipo: "Z", pontos: [] });
      continue;
    }
    if (nome === "arcTo") {
      comandos.push({
        tipo: "A",
        pontos: [],
        wR: extrairAtributoNumerico(atributos, "wR"),
        hR: extrairAtributoNumerico(atributos, "hR"),
        stAng: extrairAtributoNumerico(atributos, "stAng"),
        swAng: extrairAtributoNumerico(atributos, "swAng"),
      });
      continue;
    }

    const pontos: Array<{ x: number; y: number }> = [];
    REGEX_PONTO.lastIndex = 0;
    let matchPonto: RegExpExecArray | null;
    while ((matchPonto = REGEX_PONTO.exec(conteudoInterno ?? ""))) {
      pontos.push({ x: Number(matchPonto[1]), y: Number(matchPonto[2]) });
    }
    if (pontos.length === 0) continue;

    const tipo = nome === "moveTo" ? "M" : nome === "lnTo" ? "L" : nome === "cubicBezTo" ? "C" : "Q";
    comandos.push({ tipo, pontos });
  }

  return comandos;
}

/** Converte a sequência de comandos OOXML pra uma string `d` de `<path>` SVG — mapeamento quase
 * 1:1 (M/L/C/Q/Z), exceto `arcTo` (parametrizado por ângulo+raio, precisa resolver centro e
 * ponto final a partir da posição atual antes de virar o arco elíptico do SVG). */
export function comandosParaSvgPath(comandos: ComandoPath[]): string {
  const partes: string[] = [];
  let atual = { x: 0, y: 0 };

  for (const cmd of comandos) {
    if (cmd.tipo === "Z") {
      partes.push("Z");
      continue;
    }
    if (cmd.tipo === "M") {
      const [p] = cmd.pontos;
      partes.push(`M${p.x},${p.y}`);
      atual = p;
      continue;
    }
    if (cmd.tipo === "L") {
      const [p] = cmd.pontos;
      partes.push(`L${p.x},${p.y}`);
      atual = p;
      continue;
    }
    if (cmd.tipo === "C" && cmd.pontos.length === 3) {
      const [p1, p2, p3] = cmd.pontos;
      partes.push(`C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`);
      atual = p3;
      continue;
    }
    if (cmd.tipo === "Q" && cmd.pontos.length === 2) {
      const [p1, p2] = cmd.pontos;
      partes.push(`Q${p1.x},${p1.y} ${p2.x},${p2.y}`);
      atual = p2;
      continue;
    }
    if (cmd.tipo === "A" && cmd.wR !== undefined && cmd.hR !== undefined) {
      const stRad = ((cmd.stAng ?? 0) / 60000) * (Math.PI / 180);
      const swAngGraus = (cmd.swAng ?? 0) / 60000;
      const swRad = swAngGraus * (Math.PI / 180);
      const cx = atual.x - cmd.wR * Math.cos(stRad);
      const cy = atual.y - cmd.hR * Math.sin(stRad);
      const endX = cx + cmd.wR * Math.cos(stRad + swRad);
      const endY = cy + cmd.hR * Math.sin(stRad + swRad);
      const largeArc = Math.abs(swAngGraus) > 180 ? 1 : 0;
      const sweep = swAngGraus > 0 ? 1 : 0;
      partes.push(`A${cmd.wR},${cmd.hR} 0 ${largeArc} ${sweep} ${endX},${endY}`);
      atual = { x: endX, y: endY };
    }
  }

  return partes.join(" ");
}

/** Detecta o caso comum (ferramentas de design exportam retângulo simples como `custGeom` em
 * vez de `prstGeom prst="rect"`) — path com só M/L/Z formando exatamente os 4 cantos do
 * retângulo declarado (0,0)-(w,h). Nesse caso não precisa de clipPath nenhum. */
export function ehRetanguloSimples(comandos: ComandoPath[], pathW: number, pathH: number): boolean {
  if (comandos.some((c) => c.tipo === "C" || c.tipo === "Q" || c.tipo === "A")) return false;
  const pontos = comandos.filter((c) => c.tipo === "M" || c.tipo === "L").flatMap((c) => c.pontos);
  if (pontos.length < 4) return false;
  const xs = new Set(pontos.map((p) => p.x));
  const ys = new Set(pontos.map((p) => p.y));
  return xs.size === 2 && ys.size === 2 && xs.has(0) && xs.has(pathW) && ys.has(0) && ys.has(pathH);
}

export interface GeometriaCustGeom {
  ehRetangulo: boolean;
  /** `null` quando `ehRetangulo` — não precisa de clip, a forma já é o próprio retângulo. */
  pathSvg: string | null;
  viewBoxW: number;
  viewBoxH: number;
}

/** Localiza e interpreta o `<a:path w="" h="">...</a:path>` dentro do XML cru de 1 shape
 * (precisa ser o XML cru, não o objeto já parseado — ver comentário do módulo). */
export function extrairGeometriaCustGeom(xmlShapeCru: string): GeometriaCustGeom | null {
  const aberturaMatch = /<a:path\b([^>]*)>/.exec(xmlShapeCru);
  if (!aberturaMatch) return null;

  const atributos = aberturaMatch[1];
  const w = extrairAtributoNumerico(atributos, "w");
  const h = extrairAtributoNumerico(atributos, "h");
  if (!w || !h) return null;

  const inicioConteudo = aberturaMatch.index + aberturaMatch[0].length;
  const fimTag = xmlShapeCru.indexOf("</a:path>", inicioConteudo);
  if (fimTag === -1) return null;

  const comandos = extrairComandosPath(xmlShapeCru.slice(inicioConteudo, fimTag));
  if (comandos.length === 0) return null;

  if (ehRetanguloSimples(comandos, w, h)) {
    return { ehRetangulo: true, pathSvg: null, viewBoxW: w, viewBoxH: h };
  }
  return { ehRetangulo: false, pathSvg: comandosParaSvgPath(comandos), viewBoxW: w, viewBoxH: h };
}

export function escaparAtributoXml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Monta um SVG autocontido: imagem recortada pelo path (clipPath), `preserveAspectRatio` tipo
 * "cover" (`slice`) pra preencher o quadro igual o comportamento padrão de preenchimento de
 * forma do PowerPoint. `imagemUrl` pode ser `data:` (prévia) ou URL do Blob (após commit). */
export function construirSvgImagemRecortada(
  pathSvg: string,
  viewBoxW: number,
  viewBoxH: number,
  imagemUrl: string,
  crop?: PptxCrop,
  opacity = 1,
): string {
  const urlSegura = escaparAtributoXml(imagemUrl);
  const visibleWidth = Math.max(0.001, 1 - (crop?.left ?? 0) - (crop?.right ?? 0));
  const visibleHeight = Math.max(0.001, 1 - (crop?.top ?? 0) - (crop?.bottom ?? 0));
  const imageWidth = viewBoxW / visibleWidth;
  const imageHeight = viewBoxH / visibleHeight;
  const imageX = -((crop?.left ?? 0) / visibleWidth) * viewBoxW;
  const imageY = -((crop?.top ?? 0) / visibleHeight) * viewBoxH;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxW} ${viewBoxH}">`
    + `<clipPath id="c"><path d="${pathSvg}"/></clipPath>`
    + `<image href="${urlSegura}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" opacity="${Math.max(0, Math.min(1, opacity))}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>`
    + `</svg>`;
}

/** Fallback de ÚLTIMO recurso pra `custGeom` colorido (`solidFill`) sem equivalente nativo no
 * schema de componentes (só rect/roundRect/ellipse têm campo próprio) — desenha o path real
 * preenchido, em vez de descartar a forma inteira. */
export function construirSvgFormaColorida(
  pathSvg: string,
  viewBoxW: number,
  viewBoxH: number,
  corFundo: string,
  stroke?: SvgStroke,
): string {
  const gradienteContorno = stroke?.gradient ? construirDefinicaoGradiente("sg", stroke.gradient.angle, stroke.gradient.stops) : null;
  const pinturaContorno = gradienteContorno ? "url(#sg)" : stroke?.color;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxComSangriaDeContorno(viewBoxW, viewBoxH, stroke)}">`
    + (gradienteContorno ? `<defs>${gradienteContorno}</defs>` : "")
    + `<path d="${pathSvg}" fill="${escaparAtributoXml(corFundo)}"`
    + (stroke && pinturaContorno ? ` stroke="${escaparAtributoXml(pinturaContorno)}" stroke-width="${stroke.width}"${stroke.dash ? ` stroke-dasharray="${escaparAtributoXml(stroke.dash)}"` : ""}` : "")
    + `/>`
    + `</svg>`;
}

function corEOpacidadeDaParada(cor: string): { cor: string; opacidade?: number } {
  const rgba = /^rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/i.exec(cor);
  if (!rgba) return { cor };
  const [, r, g, b, alpha] = rgba;
  return { cor: `rgb(${r}, ${g}, ${b})`, opacidade: Math.max(0, Math.min(1, Number(alpha))) };
}

interface SvgGradient {
  angle: number;
  stops: Array<{ position: number; color: string }>;
}

interface SvgStroke {
  color?: string;
  gradient?: SvgGradient;
  width: number;
  dash?: string;
}

function viewBoxComSangriaDeContorno(viewBoxW: number, viewBoxH: number, stroke?: SvgStroke): string {
  const margem = stroke ? Math.max(0, stroke.width / 2) : 0;
  return `${-margem} ${-margem} ${viewBoxW + margem * 2} ${viewBoxH + margem * 2}`;
}

function construirDefinicaoGradiente(id: string, angle: number, stops: SvgGradient["stops"]): string {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const x1 = 0.5 - dx / 2;
  const y1 = 0.5 - dy / 2;
  const x2 = 0.5 + dx / 2;
  const y2 = 0.5 + dy / 2;
  const stopsMarkup = stops.map((stop) => {
    const normalizada = corEOpacidadeDaParada(stop.color);
    return `<stop offset="${Math.max(0, Math.min(100, stop.position))}%" stop-color="${escaparAtributoXml(normalizada.cor)}"`
      + (normalizada.opacidade !== undefined ? ` stop-opacity="${normalizada.opacidade}"` : "")
      + "/>";
  }).join("");
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsMarkup}</linearGradient>`;
}

/** Fallback SVG para `custGeom` arbitrário com `gradFill`. O ângulo recebido usa a mesma
 * convenção CSS já aplicada aos cards: 0° aponta para cima e 90° da esquerda para a direita. */
export function construirSvgFormaGradiente(
  pathSvg: string,
  viewBoxW: number,
  viewBoxH: number,
  angle: number,
  stops: Array<{ position: number; color: string }>,
  stroke?: SvgStroke,
): string {
  const gradienteFundo = construirDefinicaoGradiente("g", angle, stops);
  const gradienteContorno = stroke?.gradient ? construirDefinicaoGradiente("sg", stroke.gradient.angle, stroke.gradient.stops) : null;
  const pinturaContorno = gradienteContorno ? "url(#sg)" : stroke?.color;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxComSangriaDeContorno(viewBoxW, viewBoxH, stroke)}">`
    + `<defs>${gradienteFundo}${gradienteContorno ?? ""}</defs>`
    + `<path d="${pathSvg}" fill="url(#g)"`
    + (stroke && pinturaContorno ? ` stroke="${escaparAtributoXml(pinturaContorno)}" stroke-width="${stroke.width}"${stroke.dash ? ` stroke-dasharray="${escaparAtributoXml(stroke.dash)}"` : ""}` : "")
    + `/>`
    + `</svg>`;
}

export function svgParaDataUri(svgMarkup: string): string {
  const base64 = Buffer.from(svgMarkup, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
import type { PptxCrop } from "./modelo-intermediario";
