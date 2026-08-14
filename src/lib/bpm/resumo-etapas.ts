export type EtapaResumoPipeline = {
  id: string;
  nome: string;
  ordem: number;
};

/**
 * Retorna as etapas anteriores no sentido mais útil para leitura do card:
 * a imediatamente anterior vem primeiro e deve iniciar aberta.
 */
export function etapasAnterioresParaResumo(
  etapas: EtapaResumoPipeline[],
  etapaAtualId: string,
): EtapaResumoPipeline[] {
  const etapaAtual = etapas.find((etapa) => etapa.id === etapaAtualId);
  if (!etapaAtual) return [];

  return etapas
    .filter((etapa) => etapa.ordem < etapaAtual.ordem)
    .sort((a, b) => b.ordem - a.ordem || b.nome.localeCompare(a.nome));
}

export function etapaResumoInicialId(
  etapas: EtapaResumoPipeline[],
  etapaAtualId: string,
): string | null {
  return etapasAnterioresParaResumo(etapas, etapaAtualId)[0]?.id ?? null;
}
