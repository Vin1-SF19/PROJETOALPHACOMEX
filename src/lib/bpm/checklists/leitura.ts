export type EscopoTemplateChecklist = {
  pipelineId: string | null;
  etapaId: string | null;
  servico: string | null;
  tipoProcesso: string | null;
  cardId: string | null;
};

export type ContextoCardChecklist = {
  id: string;
  pipelineId: string;
  etapaId: string;
  servico: string | null;
  tipoProcesso?: string | null;
};

export type ItemEstadoChecklist = {
  id?: string;
  nome?: string;
  status: string;
  obrigatorio: boolean;
};

export type InstanciaEstadoChecklist = {
  id: string;
  templateId?: string;
  templateNome: string;
  materializado?: boolean;
  itens: ItemEstadoChecklist[];
};

export type ResumoChecklistCard = ReturnType<typeof calcularResumoChecklist>;

export function templateChecklistCompativel(escopo: EscopoTemplateChecklist, card: ContextoCardChecklist): boolean {
  return (!escopo.pipelineId || escopo.pipelineId === card.pipelineId)
    && (!escopo.etapaId || escopo.etapaId === card.etapaId)
    && (!escopo.servico || escopo.servico === card.servico)
    && (!escopo.tipoProcesso || escopo.tipoProcesso === card.tipoProcesso)
    && (!escopo.cardId || escopo.cardId === card.id);
}

export function calcularResumoChecklist(instancias: InstanciaEstadoChecklist[]) {
  const itens = instancias.flatMap((instancia) => instancia.itens);
  const total = itens.length;
  const concluidos = itens.filter((item) => item.status === "CONCLUIDO").length;
  const pendentesObrigatorios = itens.filter((item) => item.obrigatorio && item.status !== "CONCLUIDO").length;
  const templatesComPendencia = instancias
    .filter((instancia) => instancia.itens.some((item) => item.obrigatorio && item.status !== "CONCLUIDO"))
    .map((instancia) => ({
      id: instancia.id,
      templateId: instancia.templateId ?? instancia.id,
      nome: instancia.templateNome,
      materializado: instancia.materializado !== false,
    }));
  const itensObrigatoriosPendentes = instancias.flatMap((instancia) =>
    instancia.itens
      .filter((item) => item.obrigatorio && item.status !== "CONCLUIDO")
      .map((item, indice) => ({
        id: item.id ?? `${instancia.id}:${indice}`,
        nome: item.nome ?? "Item obrigatório",
        checklistId: instancia.id,
        templateId: instancia.templateId ?? instancia.id,
        templateNome: instancia.templateNome,
        materializado: instancia.materializado !== false,
      })),
  );
  const checklists = instancias.map((instancia) => {
    const totalChecklist = instancia.itens.length;
    const concluidosChecklist = instancia.itens.filter((item) => item.status === "CONCLUIDO").length;
    const obrigatoriosPendentes = instancia.itens.filter(
      (item) => item.obrigatorio && item.status !== "CONCLUIDO",
    ).length;
    return {
      id: instancia.id,
      templateId: instancia.templateId ?? instancia.id,
      nome: instancia.templateNome,
      materializado: instancia.materializado !== false,
      concluido: totalChecklist > 0 && concluidosChecklist === totalChecklist,
      total: totalChecklist,
      concluidos: concluidosChecklist,
      obrigatoriosPendentes,
    };
  });
  return {
    checklists,
    total,
    concluidos,
    percentual: total === 0 ? 0 : Math.round((concluidos / total) * 100),
    concluido: total > 0 && concluidos === total,
    pendentesObrigatorios,
    possuiPendenciaObrigatoria: pendentesObrigatorios > 0,
    templatesComPendencia,
    itensObrigatoriosPendentes,
  };
}
