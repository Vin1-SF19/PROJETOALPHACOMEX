import { coletarUrlsDeAssets, substituirUrlsDeAssets } from "./percorrer-componentes";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

/** Orçamento combinado de assets embutidos como base64 — ver decisão no plano de export HTML. */
export const ORCAMENTO_MAX_ASSETS_BYTES = 25 * 1024 * 1024;

export interface AssetConhecido {
  url: string;
  tamanhoBytes: number;
}

export class OrcamentoAssetsExcedidoError extends Error {
  readonly totalBytes: number;
  readonly limiteBytes: number;

  constructor(totalBytes: number, limiteBytes: number) {
    super(
      `Assets desta apresentação somam ${(totalBytes / 1024 / 1024).toFixed(1)}MB, acima do limite de ${(limiteBytes / 1024 / 1024).toFixed(0)}MB para exportação autocontida.`,
    );
    this.name = "OrcamentoAssetsExcedidoError";
    this.totalBytes = totalBytes;
    this.limiteBytes = limiteBytes;
  }
}

/**
 * Verifica o orçamento de bytes ANTES de baixar qualquer asset, usando o `tamanhoBytes` já
 * salvo no banco (`ApresentacaoAsset`) — nunca baixa nada só para descobrir se cabe.
 */
export function verificarOrcamentoAssets(
  urlsReferenciadas: string[],
  assetsConhecidos: AssetConhecido[],
  limiteBytes: number = ORCAMENTO_MAX_ASSETS_BYTES,
): void {
  const tamanhoPorUrl = new Map(assetsConhecidos.map((asset) => [asset.url, asset.tamanhoBytes]));
  const total = urlsReferenciadas.reduce((soma, url) => soma + (tamanhoPorUrl.get(url) ?? 0), 0);
  if (total > limiteBytes) throw new OrcamentoAssetsExcedidoError(total, limiteBytes);
}

/**
 * Busca cada URL única e devolve um mapa url → `data:` URI base64. Fail-fast: uma falha em
 * qualquer asset aborta a exportação inteira (preferível a devolver um `.html` autocontido
 * com um asset quebrado silenciosamente, contradizendo a promessa de funcionar 100% offline).
 */
export async function baixarAssetsComoDataUri(urls: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (const url of urls) {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`Falha ao baixar asset (HTTP ${resposta.status}): ${url}`);
    const buffer = Buffer.from(await resposta.arrayBuffer());
    const mime = resposta.headers.get("content-type") ?? "application/octet-stream";
    mapa.set(url, `data:${mime};base64,${buffer.toString("base64")}`);
  }
  return mapa;
}

/** Embute (pré-checagem de orçamento + download + substituição) todos os assets referenciados por uma lista de slides. */
export async function embutirAssetsNosSlides<T extends { componentes: ComponenteSlide[] }>(
  slides: T[],
  assetsConhecidos: AssetConhecido[],
): Promise<T[]> {
  const todasUrls = new Set<string>();
  for (const slide of slides) {
    for (const url of coletarUrlsDeAssets(slide.componentes)) todasUrls.add(url);
  }
  const urlsUnicas = Array.from(todasUrls);
  if (urlsUnicas.length === 0) return slides;

  verificarOrcamentoAssets(urlsUnicas, assetsConhecidos);
  const mapaDataUri = await baixarAssetsComoDataUri(urlsUnicas);

  return slides.map((slide) => ({
    ...slide,
    componentes: substituirUrlsDeAssets(slide.componentes, mapaDataUri),
  }));
}
