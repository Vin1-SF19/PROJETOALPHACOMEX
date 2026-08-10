import { baixarAssetsComoDataUri } from "./embutir-assets";
import type { FontePersonalizada } from "./fontes-personalizadas";

export const ORCAMENTO_MAX_FONTES_PERSONALIZADAS_BYTES = 25 * 1024 * 1024;

export class OrcamentoFontesExcedidoError extends Error {
  constructor(readonly totalBytes: number, readonly limiteBytes: number) {
    super(`As fontes personalizadas somam ${(totalBytes / 1024 / 1024).toFixed(1)}MB, acima do limite de ${(limiteBytes / 1024 / 1024).toFixed(0)}MB para exportação autocontida.`);
    this.name = "OrcamentoFontesExcedidoError";
  }
}

export async function embutirFontesPersonalizadas(
  fontes: FontePersonalizada[],
  limiteBytes = ORCAMENTO_MAX_FONTES_PERSONALIZADAS_BYTES,
): Promise<FontePersonalizada[]> {
  const totalBytes = fontes.reduce((total, fonte) => total + fonte.tamanhoBytes, 0);
  if (totalBytes > limiteBytes) throw new OrcamentoFontesExcedidoError(totalBytes, limiteBytes);
  if (fontes.length === 0) return fontes;

  const urls = Array.from(new Set(fontes.map((fonte) => fonte.url)));
  const dataUris = await baixarAssetsComoDataUri(urls);
  return fontes.map((fonte) => ({ ...fonte, url: dataUris.get(fonte.url) ?? fonte.url }));
}
