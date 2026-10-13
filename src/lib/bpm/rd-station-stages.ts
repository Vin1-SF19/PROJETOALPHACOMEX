type RdRecord = Record<string, unknown>;
type RequestRd = (path: string, params?: Record<string, string | number>) => Promise<RdRecord>;

/** A API v1 lista somente o funil padrão quando deal_pipeline_id é omitido. */
export async function carregarEtapasRd(pipelineIds: string[], request: RequestRd) {
  const stages = new Map<string, string>();
  for (const pipelineId of new Set(pipelineIds)) {
    let complete = false;
    for (let page = 1; page <= 100; page++) {
      const response = await request("deal_stages", { deal_pipeline_id: pipelineId, limit: 12, page });
      if (!Array.isArray(response.deal_stages)) throw new Error("Resposta de etapas RD inválida.");
      for (const stage of response.deal_stages as RdRecord[]) {
        const id = stage.id ?? stage._id;
        if (typeof id !== "string" || typeof stage.name !== "string") throw new Error("Etapa RD sem identidade/nome.");
        stages.set(id, stage.name);
      }
      if (response.has_more === false || (!response.has_more && response.deal_stages.length < 12)) { complete = true; break; }
    }
    if (!complete) throw new Error("Paginação de etapas RD não concluída.");
  }
  return stages;
}

/** Uma movimentação pode referenciar etapa de outro funil ou já removida. */
export async function completarEtapasHistoricasRd(names: Map<string, string>, ids: string[], request: RequestRd) {
  const indisponiveis = new Set<string>();
  for (const id of new Set(ids.filter(Boolean))) {
    if (names.has(id)) continue;
    try {
      const stage = await request(`deal_stages/${encodeURIComponent(id)}`);
      if (typeof stage.name !== "string") throw new Error("Etapa RD sem nome.");
      names.set(id, stage.name);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "RD_HTTP_404") throw error;
      indisponiveis.add(id);
    }
  }
  return indisponiveis;
}
