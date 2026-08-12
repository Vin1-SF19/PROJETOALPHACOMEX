/**
 * Representação OOXML preservada antes da conversão para componentes do Alpha Motion.
 * Coordenadas continuam em EMU e cores/estilos mantêm a origem para evitar decisões visuais
 * prematuras no parser.
 */

export type PptxElementType = "text" | "shape" | "image" | "group" | "line" | "table" | "chart" | "fallback";

export interface PptxSourceRef {
  slide: number;
  xmlPath: string;
  level: "master" | "layout" | "slide";
  shapeId?: string;
  relationshipId?: string;
  name?: string;
}

export interface PptxPointEmu {
  x: number;
  y: number;
}

export interface PptxSizeEmu {
  cx: number;
  cy: number;
}

export interface PptxMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface PptxTransform {
  off: PptxPointEmu;
  ext: PptxSizeEmu;
  chOff?: PptxPointEmu;
  chExt?: PptxSizeEmu;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  localTransform: PptxMatrix;
  worldTransform: PptxMatrix;
}

export interface PptxResolvedColor {
  hex: string;
  alpha: number;
  css: string;
  source: "srgb" | "scheme" | "system" | "scrgb" | "preset" | "hsl" | "placeholder" | "default";
}

export type PptxFill =
  | { type: "none" }
  | { type: "solid"; color: PptxResolvedColor }
  | { type: "gradient"; angle?: number; stops: Array<{ position: number; color: PptxResolvedColor }> }
  | { type: "image"; relationshipId: string; crop?: PptxCrop; mode: "stretch" | "tile" };

export interface PptxCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PptxLine {
  widthEmu: number;
  color?: PptxResolvedColor;
  gradient?: Extract<PptxFill, { type: "gradient" }>;
  dash?: string;
  cap?: string;
  join?: string;
  beginArrow?: string;
  endArrow?: string;
}

export interface PptxShadow {
  type: "outer" | "inner";
  blurEmu: number;
  distanceEmu: number;
  direction: number;
  color: PptxResolvedColor;
}

export interface PptxEffects {
  shadows: PptxShadow[];
  glow?: { radiusEmu: number; color: PptxResolvedColor };
  softEdgeEmu?: number;
}

export interface PptxRunStyle {
  fontFamily?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: string;
  strike?: string;
  color?: PptxResolvedColor;
  baseline?: number;
  kerningPt?: number;
  tracking?: number;
  caps?: string;
  hyperlink?: string;
}

export interface PptxTextRun {
  text: string;
  style: PptxRunStyle;
}

export interface PptxParagraph {
  runs: PptxTextRun[];
  alignment?: "left" | "center" | "right" | "justify";
  level?: number;
  marginLeftEmu?: number;
  indentEmu?: number;
  lineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  bullet?: string;
  numbering?: { type: string; startAt?: number };
  tabs?: number[];
}

export interface PptxTextBody {
  paragraphs: PptxParagraph[];
  margins: { leftEmu: number; rightEmu: number; topEmu: number; bottomEmu: number };
  anchor?: string;
  vertical?: string;
  wrap?: string;
  columns: number;
  autofit: "none" | "normal" | "shape";
}

export interface PptxGeometry {
  kind: "preset" | "custom" | "none";
  preset?: string;
  pathSvg?: string;
  viewBox?: { width: number; height: number };
}

export interface PptxElement {
  id: string;
  name?: string;
  type: PptxElementType;
  source: PptxSourceRef;
  transform: PptxTransform;
  geometry?: PptxGeometry;
  fill?: PptxFill;
  line?: PptxLine;
  effects?: PptxEffects;
  text?: PptxTextBody;
  children?: PptxElement[];
  zIndex: number;
  fallbackReason?: string;
}

export interface PptxBackground {
  fill: PptxFill;
  sourceLevel: "master" | "layout" | "slide" | "default";
  sourcePath?: string;
}

export interface PptxIntermediateSlide {
  number: number;
  xmlPath: string;
  background: PptxBackground;
  elements: PptxElement[];
}

export interface PptxIntermediateModel {
  version: 1;
  importerVersion: string;
  slideSizeEmu: PptxSizeEmu;
  slides: PptxIntermediateSlide[];
}

export const PPTX_IMPORTER_VERSION = "2.0.0";
