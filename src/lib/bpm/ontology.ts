/** Identidades semânticas persistidas. Labels nunca devem controlar domínio. */
export const BPM_PIPELINE_KEYS = {
  COMERCIAL: "comercial",
  FINANCEIRO: "financeiro",
  OPERACIONAL: "operacional",
  RADAR: "radar",
} as const;

export const BPM_STAGE_KEYS = {
  NOVOS_LEADS: "novos_leads",
  AGENDAR_REUNIAO: "agendar_reuniao",
  REUNIAO_AGENDADA: "reuniao_agendada",
  EM_TRATATIVA: "em_tratativa",
  FECHADO: "fechado",
  LOST: "lost",
  SEM_VIABILIDADE: "sem_viabilidade",
  STANDBY_FOLLOW_UP: "standby_follow_up",
  MONITORAMENTO: "monitoramento",
  BOAS_VINDAS: "boas_vindas",
  ALINHAMENTO_ESTRATEGICO: "alinhamento_estrategico_agendado",
  SOLICITACAO_CONTRATO: "solicitacao_contrato",
  ELABORACAO_CONTRATO: "elaboracao_contrato",
  FORMALIZACAO_CONTRATACAO: "formalizacao_contratacao",
  CONFIRMACAO_PAGAMENTO: "confirmacao_pagamento",
  EMISSAO_NOTA_FISCAL: "emissao_nota_fiscal",
  CONTRATACAO_FINALIZADA: "contratacao_finalizada",
} as const;

export const BPM_CAPABILITIES = {
  MEETING_SCHEDULER: "MEETING_SCHEDULER",
  MEETING_TRANSCRIPT: "MEETING_TRANSCRIPT",
  FOLLOW_UP_SCHEDULER: "FOLLOW_UP_SCHEDULER",
  FOLLOW_UP_CHECKLIST: "FOLLOW_UP_CHECKLIST",
  STANDBY_FOLLOW_UP: "STANDBY_FOLLOW_UP",
  COMMERCIAL_POST_CLOSING: "COMMERCIAL_POST_CLOSING",
  STAGE_CHECKLIST: "STAGE_CHECKLIST",
} as const;

export type BpmLifecycleStatus = "ATIVO" | "CONCLUIDO" | "CANCELADO" | "ARQUIVADO";
export type BpmTransitionRequester = "MANUAL" | "AUTOMACAO" | "SISTEMA" | "INTEGRACAO";

export function parseBpmCapabilities(value: string | null | undefined): ReadonlySet<string> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

export function transitionOriginForRequester(requester: BpmTransitionRequester): "MANUAL" | "AUTOMACAO" {
  return requester === "MANUAL" ? "MANUAL" : "AUTOMACAO";
}

export function assertLifecycleInvariant(status: string, concluidoEm: Date | null): void {
  if (status === "CONCLUIDO" && !concluidoEm) throw new Error("LIFECYCLE_CONCLUIDO_SEM_DATA");
  if (status === "ATIVO" && concluidoEm) throw new Error("LIFECYCLE_ATIVO_COM_DATA_CONCLUSAO");
}
