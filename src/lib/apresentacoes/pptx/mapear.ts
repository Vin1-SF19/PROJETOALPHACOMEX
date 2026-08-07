import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { FormaExtraida, FormaTextoExtraida, SlideExtraido } from "./tipos";

const TAMANHO_FONTE_TITULO_PADRAO = 44;
const TAMANHO_FONTE_CORPO_PADRAO = 20;

function mapearTexto(forma: FormaTextoExtraida): ComponenteSlide {
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
    zIndex += 1;
    const componente = await mapearForma(forma, zIndex, enviarImagem);
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
      // OOXML: <a:blipFill><a:stretch><a:fillRect/></a:stretch></a:blipFill> (o caso comum, sem
      // recorte) sempre PREENCHE o quadro por completo — equivalente a object-fit "cover", não
      // "contain" (que deixaria barras vazias, diferente do PowerPoint).
      zIndex, rotacao: forma.rotacao, url, objectFit: "cover",
    };
  }

  if (forma.tipo === "tabela") {
    return {
      id: crypto.randomUUID(), tipo: "tabela", x: forma.x, y: forma.y, w: forma.w, h: forma.h,
      zIndex, rotacao: forma.rotacao, colunas: forma.colunas, linhas: forma.linhas,
    };
  }

  // forma.tipo === "caixa"
  const filhos: ComponenteSlide[] = forma.textoInterno
    ? [{ ...mapearTexto({ ...forma.textoInterno, x: 0, y: 0, rotacao: 0 }), zIndex: 0 }]
    : [];
  return {
    id: crypto.randomUUID(), tipo: "card", x: forma.x, y: forma.y, w: forma.w, h: forma.h,
    zIndex, rotacao: forma.rotacao,
    corFundo: forma.corFundo ?? "#0f172a",
    borderRadius: raioDaCaixa(forma.formato, forma.w, forma.h),
    padding: 16,
    filhos,
  };
}
