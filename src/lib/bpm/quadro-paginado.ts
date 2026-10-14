export const TAMANHO_PAGINA_QUADRO = 30;
export const REVALIDACAO_RESUMOS_MS = 90_000;

export type EntradaManifestoQuadro = {
  id: string;
  etapaId: string;
  revision: string;
  nome: string;
  cnpj: string | null;
  servico: string | null;
  responsaveis: { id: number; nome: string }[];
};
export type ManifestoQuadro = { configVersion: number; entradas: EntradaManifestoQuadro[] };
export type FiltrosQuadro = { busca?: string; responsavelId?: number | null; limites?: Record<string, number> };

const normalizar = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export function selecionarPaginaQuadro(entradas: EntradaManifestoQuadro[], filtros: FiltrosQuadro = {}) {
  const termo = normalizar(filtros.busca ?? "");
  const totais: Record<string, number> = {};
  const ids: string[] = [];
  for (const card of entradas) {
    if (filtros.responsavelId && !card.responsaveis.some((p) => p.id === filtros.responsavelId)) continue;
    const texto = normalizar(`${card.nome} ${card.cnpj ?? ""} ${(card.cnpj ?? "").replace(/\D/g, "")} ${card.servico ?? ""}`);
    if (termo && !texto.includes(termo)) continue;
    const total = (totais[card.etapaId] ?? 0) + 1;
    totais[card.etapaId] = total;
    if (total <= (filtros.limites?.[card.etapaId] ?? TAMANHO_PAGINA_QUADRO)) ids.push(card.id);
  }
  return { ids, totais };
}

/** Reutiliza objetos inalterados para não redesenhar os cards sem mudanças. */
export function mesclarResumosQuadro<T extends { id: string }>(atuais: T[], alterados: T[], ids: string[]): T[] {
  const mapa = new Map(atuais.map((card) => [card.id, card]));
  for (const card of alterados) {
    const anterior = mapa.get(card.id);
    mapa.set(card.id, anterior && JSON.stringify(anterior) === JSON.stringify(card) ? anterior : card);
  }
  const proxima = ids.flatMap((id) => { const card = mapa.get(id); return card ? [card] : []; });
  return atuais.length === proxima.length && proxima.every((card, i) => card === atuais[i]) ? atuais : proxima;
}
