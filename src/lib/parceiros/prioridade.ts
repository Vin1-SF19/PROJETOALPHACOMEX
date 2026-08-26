// CRM de Canais e Parcerias — Fase 05. Prioridade de follow-up: SIMPLES e explicável
// (pedido original é explícito: "não inventar um algoritmo complexo"). Pesos nomeados,
// auditáveis, ajustáveis sem reescrever a lógica.

export interface EntradaPrioridade {
  potencialRecorrencia: number | null;
  proximaAcaoEm: Date | null;
  diasSemIndicacao: number | null;
  estagioDesenvolvimento: string;
}

// Pesos — quanto maior, mais prioridade. Ordem de importância conforme o pedido original:
// potencial > follow-up vencido > ausência de próxima ação > tempo sem indicação > status.
export const PESOS_PRIORIDADE = {
  POTENCIAL_POR_PONTO: 10, // 0-5 → 0-50
  FOLLOWUP_VENCIDO: 40,
  SEM_PROXIMA_ACAO: 25,
  DIAS_SEM_INDICACAO_POR_UNIDADE: 0.3, // capado abaixo
  DIAS_SEM_INDICACAO_TETO: 30, // no máximo 30 pontos vindos daqui (100 dias × 0.3)
  ESTAGIO_ATIVO_RECORRENTE: 15, // parceiro RECORRENTE/ATIVO compete mais pela fila do que EM_ATIVACAO
} as const;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Score puro (maior = mais prioritário). Nunca soma dados de parceiros INATIVOS — esses vão para alerta separado, não para a fila de follow-up comercial. */
export function calcularPrioridadeFollowUp(entrada: EntradaPrioridade): number {
  let score = 0;

  score += (entrada.potencialRecorrencia ?? 0) * PESOS_PRIORIDADE.POTENCIAL_POR_PONTO;

  const agora = Date.now();
  if (entrada.proximaAcaoEm) {
    if (entrada.proximaAcaoEm.getTime() < agora) {
      score += PESOS_PRIORIDADE.FOLLOWUP_VENCIDO;
    }
  } else {
    score += PESOS_PRIORIDADE.SEM_PROXIMA_ACAO;
  }

  if (entrada.diasSemIndicacao !== null) {
    score += Math.min(entrada.diasSemIndicacao, PESOS_PRIORIDADE.DIAS_SEM_INDICACAO_TETO / PESOS_PRIORIDADE.DIAS_SEM_INDICACAO_POR_UNIDADE)
      * PESOS_PRIORIDADE.DIAS_SEM_INDICACAO_POR_UNIDADE;
  }

  if (entrada.estagioDesenvolvimento === "ATIVO" || entrada.estagioDesenvolvimento === "RECORRENTE") {
    score += PESOS_PRIORIDADE.ESTAGIO_ATIVO_RECORRENTE;
  }

  return Math.round(score * 100) / 100;
}

export function followUpEstaVencido(proximaAcaoEm: Date | null): boolean {
  return proximaAcaoEm !== null && proximaAcaoEm.getTime() < Date.now();
}

export { DIA_MS };
