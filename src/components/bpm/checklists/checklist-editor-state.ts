import type { EscopoEtapaChecklist } from "@/components/bpm/checklists/EtapasMultiSelect";

export interface VinculosChecklistDraft {
  pipelineId: string;
  escopoEtapa: EscopoEtapaChecklist;
  etapaIds: string[];
  cardId: string;
}

interface TemplateComEtapas {
  etapaId: string | null;
  etapas: Array<{ etapaId: string }>;
}

export function resolverSelecaoEtapasTemplate(template: TemplateComEtapas) {
  const etapaIds = template.etapas.length > 0
    ? template.etapas.map((vinculo) => vinculo.etapaId)
    : template.etapaId ? [template.etapaId] : [];

  return {
    escopoEtapa: etapaIds.length > 0 ? "SELECIONADAS" as const : "TODAS" as const,
    etapaIds,
  };
}

export function trocarPipelineChecklist<T extends VinculosChecklistDraft>(draft: T, pipelineId: string): T {
  return { ...draft, pipelineId, etapaIds: [], cardId: "" };
}

export function etapaIdsParaPayload(draft: Pick<VinculosChecklistDraft, "escopoEtapa" | "etapaIds">) {
  return draft.escopoEtapa === "SELECIONADAS" ? [...draft.etapaIds] : [];
}

export function encontrarEtapasIncompativeis(etapaIds: string[], etapasDisponiveis: Array<{ id: string }>) {
  const idsDisponiveis = new Set(etapasDisponiveis.map((etapa) => etapa.id));
  return etapaIds.filter((id) => !idsDisponiveis.has(id));
}

export function resumoEtapasTemplate(template: TemplateComEtapas & {
  etapa: { nome: string } | null;
  etapas: Array<{ etapaId: string; etapa: { nome: string } }>;
}) {
  const { etapaIds } = resolverSelecaoEtapasTemplate(template);
  if (etapaIds.length === 0) return "Qualquer etapa";
  if (etapaIds.length > 1) return `${etapaIds.length} etapas`;
  return template.etapas[0]?.etapa.nome ?? template.etapa?.nome ?? "Etapa específica";
}
