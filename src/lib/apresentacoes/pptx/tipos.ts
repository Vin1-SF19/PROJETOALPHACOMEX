/** Representação intermediária extraída de um `.pptx` — antes de virar `ComponenteSlide[]`. */

export interface RetanguloExtraido {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Graus, sentido horário — mesma convenção do campo `rotacao` do schema de componentes. */
  rotacao: number;
}

export interface FormaTextoExtraida extends RetanguloExtraido {
  tipo: "texto";
  paragrafos: string[];
  corTexto: string | null;
  negrito: boolean;
  tamanhoFonte: number | null;
  alinhamento: "left" | "center" | "right" | null;
  ehTitulo: boolean;
}

export interface FormaImagemExtraida extends RetanguloExtraido {
  tipo: "imagem";
  bytes: Uint8Array;
  mimeType: string;
  nomeArquivo: string;
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
}

export type FormaExtraida = FormaTextoExtraida | FormaImagemExtraida | FormaTabelaExtraida | FormaCaixaExtraida;

export interface SlideExtraido {
  formas: FormaExtraida[];
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
  /** Nomes de fonte (`<a:latin typeface="...">`) usados no arquivo original que NÃO são
   * aplicados no Alpha Motion — o componente de texto não tem campo `fontFamily`. Reportado
   * explicitamente em vez de trocar pela fonte padrão do sistema em silêncio. */
  fontesNaoAplicadas: string[];
  /** 1 entrada por elemento OOXML processado — ver `DiagnosticoElemento`. */
  diagnostico: DiagnosticoElemento[];
}
