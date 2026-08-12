import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { FormaExtraida, FormaTextoExtraida, SlideExtraido } from "./tipos";

const TAMANHO_FONTE_TITULO_PADRAO = 44;
const TAMANHO_FONTE_CORPO_PADRAO = 20;

function mapearTexto(forma: FormaTextoExtraida): ComponenteSlide {
  const pointToCanvas = forma.fontScale ?? (96 / 72);
  const emuToCanvas = pointToCanvas / 12700;
  const richText = forma.richText ? {
    paragraphs: forma.richText.paragraphs.map((paragraph) => ({
      alignment: paragraph.alignment,
      level: paragraph.level,
      marginLeft: paragraph.marginLeftEmu !== undefined ? paragraph.marginLeftEmu * emuToCanvas : undefined,
      indent: paragraph.indentEmu !== undefined ? paragraph.indentEmu * emuToCanvas : undefined,
      lineSpacing: paragraph.lineSpacing,
      spaceBefore: paragraph.spaceBefore !== undefined ? paragraph.spaceBefore * pointToCanvas : undefined,
      spaceAfter: paragraph.spaceAfter !== undefined ? paragraph.spaceAfter * pointToCanvas : undefined,
      bullet: paragraph.bullet,
      numbering: paragraph.numbering,
      tabs: paragraph.tabs?.map((tab) => tab * emuToCanvas),
      runs: paragraph.runs.map((run) => ({
        text: run.text,
        fontFamily: run.style.fontFamily,
        fontSize: run.style.fontSizePt !== undefined ? run.style.fontSizePt * pointToCanvas : undefined,
        bold: run.style.bold,
        italic: run.style.italic,
        underline: run.style.underline,
        strike: run.style.strike,
        color: run.style.color?.css,
        baseline: run.style.baseline,
        tracking: run.style.tracking,
        caps: run.style.caps,
        hyperlink: run.style.hyperlink,
      })),
    })),
  } : undefined;
  return {
    id: crypto.randomUUID(),
    tipo: "texto",
    x: forma.x,
    y: forma.y,
    w: forma.w,
    h: forma.h,
    zIndex: 0,
    rotacao: forma.rotacao,
    texto: forma.paragrafos.join("\n"),
    tag: forma.ehTitulo ? "h1" : "p",
    alinhamento: forma.alinhamento ?? "left",
    ...(forma.corTexto ? { corTexto: forma.corTexto } : {}),
    fontSize: forma.tamanhoFonte ?? (forma.ehTitulo ? TAMANHO_FONTE_TITULO_PADRAO : TAMANHO_FONTE_CORPO_PADRAO),
    ...(forma.negrito ? { fontWeight: "bold" as const } : {}),
    ...(forma.fontFamily ? { fontFamily: forma.fontFamily } : {}),
    ...(forma.italic ? { fontStyle: "italic" as const } : {}),
    ...(forma.underline ? { textDecoration: "underline" } : {}),
    ...(forma.lineHeight ? { lineHeight: forma.lineHeight } : {}),
    ...(forma.letterSpacing !== null && forma.letterSpacing !== undefined ? { letterSpacing: forma.letterSpacing } : {}),
    ...(forma.padding ? { padding: forma.padding } : {}),
    ...(forma.verticalAlign ? { verticalAlign: forma.verticalAlign } : {}),
    ...(forma.wrap !== undefined ? { wrap: forma.wrap } : {}),
    ...(forma.autofit ? { autofit: forma.autofit } : {}),
    ...(richText ? { richText } : {}),
    ...(forma.flipH ? { flipH: true } : {}),
    ...(forma.flipV ? { flipV: true } : {}),
    ...(forma.opacidade !== undefined ? { opacidade: forma.opacidade } : {}),
    ...(forma.source ? { pptxOrigem: forma.source } : {}),
  };
}

function raioDaCaixa(formato: "rect" | "roundRect" | "ellipse", w: number, h: number): number {
  if (formato === "ellipse") return Math.round(Math.min(w, h) / 2);
  if (formato === "roundRect") return Math.max(4, Math.round(Math.min(w, h) * 0.08));
  return 0;
}

/**
 * Converte as formas já extraídas de 1 slide do PPTX em `ComponenteSlide[]` prontos pra gravar
 * em `Slide.dadosJson`. Upload de imagem é I/O assíncrono — recebe `enviarImagem` (normalmente
 * um upload pro Vercel Blob) em vez de fazer a decisão de armazenamento aqui dentro.
 */
export async function mapearSlideExtraido(
  slide: SlideExtraido,
  enviarImagem: (bytes: Uint8Array, mimeType: string, nomeArquivo: string) => Promise<string>,
): Promise<ComponenteSlide[]> {
  const componentes: ComponenteSlide[] = [];
  let zIndex = 0;

  for (const forma of slide.formas) {
    // Fundo sólido pertence ao canvas do slide (persistido separadamente nas rotas), não à
    // árvore editável de componentes. Background de imagem continua como imagem z=0.
    if (forma.source?.name === "Background" && forma.tipo === "caixa") continue;
    zIndex += 1;
    const componente = await mapearForma(forma, forma.zIndex ?? zIndex, enviarImagem);
    if (componente) componentes.push(componente);
  }

  return componentes;
}

async function mapearForma(
  forma: FormaExtraida,
  zIndex: number,
  enviarImagem: (bytes: Uint8Array, mimeType: string, nomeArquivo: string) => Promise<string>,
): Promise<ComponenteSlide | null> {
  if (forma.tipo === "texto") {
    return { ...mapearTexto(forma), zIndex };
  }

  if (forma.tipo === "imagem") {
    const url = await enviarImagem(forma.bytes, forma.mimeType, forma.nomeArquivo);
    return {
      id: crypto.randomUUID(), tipo: "imagem", x: forma.x, y: forma.y, w: forma.w, h: forma.h,
      // OOXML: stretch sem srcRect distorce a imagem até o quadro; srcRect é aplicado
      // separadamente pelo renderer. Portanto o modo base correto é "fill", sem o recorte
      // implícito que object-fit "cover" introduziria.
      zIndex, rotacao: forma.rotacao, url, objectFit: "fill",
      ...(forma.crop ? { crop: forma.crop } : {}),
      ...(forma.tile ? { tile: true } : {}),
      ...(forma.flipH ? { flipH: true } : {}),
      ...(forma.flipV ? { flipV: true } : {}),
      ...(forma.opacidade !== undefined ? { opacidade: forma.opacidade } : {}),
      ...(forma.source ? { pptxOrigem: forma.source } : {}),
    };
  }

  if (forma.tipo === "tabela") {
    return {
      id: crypto.randomUUID(), tipo: "tabela", x: forma.x, y: forma.y, w: forma.w, h: forma.h,
      zIndex, rotacao: forma.rotacao, colunas: forma.colunas, linhas: forma.linhas,
    };
  }

  if (forma.tipo === "linha") {
    const dash = forma.line.dash?.toLowerCase();
    return {
      id: crypto.randomUUID(), tipo: "divisor", x: forma.x, y: forma.y, w: forma.w, h: Math.max(1, forma.h),
      zIndex, rotacao: forma.rotacao,
      cor: forma.line.color?.css ?? "#000000",
      espessura: forma.lineWidthPx ?? Math.max(1, forma.h),
      estilo: dash?.includes("dot") && dash?.includes("dash") ? "dashDot" : dash?.includes("dot") ? "dot" : dash?.includes("dash") ? "dash" : "solid",
      cap: forma.line.cap === "rnd" ? "round" : forma.line.cap === "sq" ? "square" : "butt",
      ...(forma.line.beginArrow ? { beginArrow: forma.line.beginArrow } : {}),
      ...(forma.line.endArrow ? { endArrow: forma.line.endArrow } : {}),
      ...(forma.source ? { pptxOrigem: forma.source } : {}),
    };
  }

  // forma.tipo === "caixa"
  const filhos: ComponenteSlide[] = forma.textoInterno
    ? [{ ...mapearTexto({ ...forma.textoInterno, x: 0, y: 0, rotacao: 0 }), zIndex: 0 }]
    : [];
  return {
    id: crypto.randomUUID(), tipo: "card", x: forma.x, y: forma.y, w: forma.w, h: forma.h,
    zIndex, rotacao: forma.rotacao,
    corFundo: forma.gradientCss ?? forma.corFundo ?? "transparent",
    borderRadius: raioDaCaixa(forma.formato, forma.w, forma.h),
    padding: 16,
    filhos,
    ...(forma.line?.color ? { corBorda: forma.line.color.css } : {}),
    ...(forma.lineWidthPx !== undefined ? { larguraBorda: forma.lineWidthPx } : {}),
    ...(forma.line?.dash ? { estiloBorda: forma.line.dash.includes("dot") ? "dotted" as const : forma.line.dash.includes("dash") ? "dashed" as const : "solid" as const } : {}),
    ...(forma.sombra ? { sombra: forma.sombra } : {}),
    ...(forma.flipH ? { flipH: true } : {}),
    ...(forma.flipV ? { flipV: true } : {}),
    ...(forma.opacidade !== undefined ? { opacidade: forma.opacidade } : {}),
    ...(forma.source ? { pptxOrigem: forma.source } : {}),
  };
}
