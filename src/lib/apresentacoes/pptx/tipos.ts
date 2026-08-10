import type { PptxCrop, PptxEffects, PptxIntermediateModel, PptxLine, PptxSourceRef, PptxTextBody } from "./modelo-intermediario";
import type { PptxDiagnosticEntry } from "./diagnostico";

/** Modelo de conversão derivado do `PptxIntermediateModel` — antes de virar `ComponenteSlide[]`. */

export interface RetanguloExtraido {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Graus, sentido horário — mesma convenção do campo `rotacao` do schema de componentes. */
  rotacao: number;
  flipH?: boolean;
  flipV?: boolean;
  opacidade?: number;
  zIndex?: number;
  source?: PptxSourceRef;
}

export interface FormaTextoExtraida extends RetanguloExtraido {
  tipo: "texto";
  paragrafos: string[];
  corTexto: string | null;
  negrito: boolean;
  tamanhoFonte: number | null;
  alinhamento: "left" | "center" | "right" | "justify" | null;
  ehTitulo: boolean;
  richText?: PptxTextBody;
  fontFamily?: string | null;
  italic?: boolean;
  underline?: string | null;
  lineHeight?: number | null;
  letterSpacing?: number | null;
  padding?: { left: number; right: number; top: number; bottom: number };
  verticalAlign?: "top" | "middle" | "bottom";
  wrap?: boolean;
  autofit?: "none" | "normal" | "shape";
  fontScale?: number;
}

export interface FormaImagemExtraida extends RetanguloExtraido {
  tipo: "imagem";
  bytes: Uint8Array;
  mimeType: string;
  nomeArquivo: string;
  crop?: PptxCrop;
  tile?: boolean;
}

export interface FormaTabelaExtraida extends RetanguloExtraido {
  tipo: "tabela";
  colunas: string[];
  linhas: string[][];
}

/** Retângulo/elipse/roundRect com preenchimento sólido — vira `card`. Pode conter texto (aninhado). */
export interface FormaCaixaExtraida extends RetanguloExtraido {
  tipo: "caixa";
  corFundo: string | null;
  formato: "rect" | "roundRect" | "ellipse";
  textoInterno: FormaTextoExtraida | null;
  line?: PptxLine;
  effects?: PptxEffects;
  gradientCss?: string | null;
  lineWidthPx?: number;
  sombra?: { x: number; y: number; blur: number; spread: number; color: string; inset?: boolean };
}

export interface FormaLinhaExtraida extends RetanguloExtraido {
  tipo: "linha";
  line: PptxLine;
  lineWidthPx?: number;
}

export type FormaExtraida = FormaTextoExtraida | FormaImagemExtraida | FormaTabelaExtraida | FormaCaixaExtraida | FormaLinhaExtraida;

export interface SlideExtraido {
  formas: FormaExtraida[];
  backgroundColor: string;
  backgroundImage?: string;
  sourcePath?: string;
}

/** 1 entrada de diagnóstico por elemento OOXML processado (sucesso ou fallback) — pensado pra
 * log estruturado (`console.info`), não pra UI. Substitui mensagens genéricas por rastreabilidade
 * real de por que cada forma virou o que virou. */
export interface DiagnosticoElemento {
  slide: number;
  shapeId: string | null;
  nome: string;
  tipoOoxml: string;
  fillEncontrado: string;
  relationshipId: string | null;
  assetResolvido: string | null;
  grupoPai: string | null;
  geometria: string | null;
  motivoFallback: string | null;
}

export interface ApresentacaoPptxExtraida {
  /** Tamanho do slide no PPTX original, em EMU (unidade nativa OOXML — 914400 EMU = 1 polegada). */
  slideSizeEmu: { cx: number; cy: number };
  slides: SlideExtraido[];
  /** Formas que existiam mas não foram entendidas (gráfico, SmartArt, conector, geometria sem
   * fill reconhecido etc.) — contadas por motivo ESPECÍFICO, só pra reportar ao usuário o que
   * ficou de fora (nunca uma mensagem genérica única). */
  ignorados: Record<string, number>;
  /** Alias legado. A disponibilidade real é verificada no browser pelo FontResolver. */
  fontesNaoAplicadas: string[];
  fontesDetectadas: string[];
  /** 1 entrada por elemento OOXML processado — ver `DiagnosticoElemento`. */
  diagnostico: DiagnosticoElemento[];
  diagnosticosDetalhados: PptxDiagnosticEntry[];
  intermediateModel: PptxIntermediateModel;
}
