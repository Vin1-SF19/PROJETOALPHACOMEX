/** Formata um valor em centavos (Int) para moeda pt-BR. Nunca usar Float neste módulo. */
export function formatarCentavosBRL(valorCents: number): string {
  return (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataComissao(data: Date | string | null): string {
  if (!data) return "--";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  CONTRACTING: "Contratação",
  PROCESS_STARTED: "Processo Iniciado",
  PROCESS_SUCCESS: "Êxito",
  FIRST_ATTEMPT_SUCCESS: "Êxito na 1ª Tentativa",
  AUXILIARY_PARTICIPATION: "Participação Auxiliar",
  MANUAL_EVENT: "Lançamento Manual",
  CANCELLATION: "Cancelamento",
  REVERSAL: "Estorno",
};

export const STATUS_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  AguardandoAprovacao: "Aguardando Aprovação",
  Programado: "Programado",
  Pago: "Pago",
  ParcialmentePago: "Parcialmente Pago",
  Vencido: "Vencido",
  Bloqueado: "Bloqueado",
  EmDivergencia: "Em Divergência",
  Cancelado: "Cancelado",
  Estornado: "Estornado",
  PENDING_REVIEW: "Pendente de Revisão",
  OK: "OK",
  BLOCKED: "Bloqueado",
  INTEGRATION_ERROR: "Erro de Integração",
};

/** Cor do status — verde=pago, amarelo=pendente, vermelho=vencido/bloqueado/divergente (padrão Ledger Vivo). */
export function corDoStatus(status: string): "verde" | "amarelo" | "vermelho" | "neutro" {
  if (status === "Pago" || status === "OK") return "verde";
  if (status === "Pendente" || status === "AguardandoAprovacao" || status === "Programado" || status === "ParcialmentePago") return "amarelo";
  if (status === "Vencido" || status === "Bloqueado" || status === "EmDivergencia" || status === "PENDING_REVIEW" || status === "BLOCKED" || status === "INTEGRATION_ERROR") return "vermelho";
  return "neutro";
}
