/**
 * Camada de filtro de EligibilityOverride (seção 15 do prompt original) — aplicada ANTES
 * do rule-engine (evaluateRules), não integrada a ele.
 *
 * Decisão de arquitetura (Fase 07): em vez de converter cada EligibilityOverride para o
 * formato CommissionRuleVersionData e injetá-lo em evaluateRules, esta camada roda como
 * um filtro/decisão PRÉVIA e independente. Motivo: o motor de regras (rule-engine.ts,
 * Fase 04) já está implementado e testado (43+ casos) assumindo que toda entrada é uma
 * CommissionRule/CommissionRuleVersion "de verdade" (com paymentSchedule, calculation
 * etc.) — EligibilityOverride tem forma de dado bem diferente (percentualEspecifico OU
 * valorEspecificoCents OU bloqueio puro, sem "calculation" estruturado). Forçar essa
 * conversão adicionaria complexidade e risco de regressão no motor já validado, para um
 * ganho pequeno (a hierarquia de precedência de qualquer forma trata Override como
 * "mais específico que regra de cargo" — o mesmo efeito é obtido rodando o filtro antes).
 *
 * Fluxo: para cada (collaboratorId, evento), buscar overrides vigentes na data do evento
 * que casem por colaborador/cargo/empresa/contrato/serviço/evento, ordenados pela mesma
 * hierarquia da seção 15 (contrato > empresa > individual — bloqueio é checado primeiro,
 * sempre). Retorna a decisão do override de maior precedência, ou null se nenhum aplicar
 * (nesse caso o entry-generator segue para o rule-engine normalmente).
 */

export type EligibilityOverrideType =
  | "BLOQUEIO"
  | "SUBSTITUICAO"
  | "PERCENTUAL_ESPECIFICO"
  | "VALOR_ESPECIFICO"
  | "EXCLUSAO";

export interface EligibilityOverrideRecord {
  id: string;
  collaboratorId: number | null;
  cargoId: number | null;
  /** ClienteServico.id — Fase 3.7 do Cliente Master (2026-08-14), nome corrigido (era "clienteId"), mesmo comportamento de hierarquia por serviço. */
  clienteServicoId: number | null;
  contratoComercialId: string | null;
  servico: string | null;
  eventType: string | null;
  dataInicial: Date | null;
  dataFinal: Date | null;
  tipo: EligibilityOverrideType;
  percentualEspecifico: number | null;
  valorEspecificoCents: number | null;
  justificativa: string;
  prioridade: number;
  approvalRequired: boolean;
  aprovadoEm: Date | null;
}

export interface EligibilityFilterQuery {
  collaboratorId: number;
  cargoId: number | null;
  clienteServicoId: number | null;
  contratoComercialId: string | null;
  servico: string;
  eventType: string;
  dataEvento: Date;
}

export type EligibilityDecision =
  | { action: "BLOQUEAR"; override: EligibilityOverrideRecord }
  | { action: "EXCLUIR"; override: EligibilityOverrideRecord }
  | { action: "SUBSTITUIR_PERCENTUAL"; override: EligibilityOverrideRecord; percentual: number }
  | { action: "SUBSTITUIR_VALOR"; override: EligibilityOverrideRecord; valorCents: number }
  | { action: "AGUARDANDO_APROVACAO"; override: EligibilityOverrideRecord }
  | null;

function vigenteNaData(override: EligibilityOverrideRecord, data: Date): boolean {
  const inicioOk = override.dataInicial === null || override.dataInicial.getTime() <= data.getTime();
  const fimOk = override.dataFinal === null || override.dataFinal.getTime() >= data.getTime();
  return inicioOk && fimOk;
}

function casaComQuery(override: EligibilityOverrideRecord, query: EligibilityFilterQuery): boolean {
  if (override.collaboratorId !== null && override.collaboratorId !== query.collaboratorId) return false;
  if (override.cargoId !== null && override.cargoId !== query.cargoId) return false;
  if (override.clienteServicoId !== null && override.clienteServicoId !== query.clienteServicoId) return false;
  if (override.contratoComercialId !== null && override.contratoComercialId !== query.contratoComercialId) return false;
  if (override.servico !== null && override.servico !== query.servico) return false;
  if (override.eventType !== null && override.eventType !== query.eventType) return false;
  return vigenteNaData(override, query.dataEvento);
}

/** Especificidade decrescente: contrato > empresa > individual > cargo — mesma ordem da seção 15. */
function especificidade(override: EligibilityOverrideRecord): number {
  if (override.contratoComercialId !== null) return 4;
  if (override.clienteServicoId !== null) return 3;
  if (override.collaboratorId !== null) return 2;
  if (override.cargoId !== null) return 1;
  return 0;
}

export function resolverEligibilityOverride(
  overrides: EligibilityOverrideRecord[],
  query: EligibilityFilterQuery,
): EligibilityDecision {
  const candidatos = overrides.filter((o) => casaComQuery(o, query));
  if (candidatos.length === 0) return null;

  // Bloqueio sempre vence, independente de especificidade (topo da hierarquia da seção 15).
  const bloqueios = candidatos.filter((o) => o.tipo === "BLOQUEIO");
  if (bloqueios.length > 0) {
    const vencedor = [...bloqueios].sort((a, b) => b.prioridade - a.prioridade)[0];
    return { action: "BLOQUEAR", override: vencedor };
  }

  const ordenados = [...candidatos].sort((a, b) => {
    const espDiff = especificidade(b) - especificidade(a);
    if (espDiff !== 0) return espDiff;
    return b.prioridade - a.prioridade;
  });

  const vencedor = ordenados[0];

  if (vencedor.approvalRequired && vencedor.aprovadoEm === null) {
    return { action: "AGUARDANDO_APROVACAO", override: vencedor };
  }

  switch (vencedor.tipo) {
    case "EXCLUSAO":
      return { action: "EXCLUIR", override: vencedor };
    case "PERCENTUAL_ESPECIFICO":
      return vencedor.percentualEspecifico !== null
        ? { action: "SUBSTITUIR_PERCENTUAL", override: vencedor, percentual: vencedor.percentualEspecifico }
        : { action: "AGUARDANDO_APROVACAO", override: vencedor };
    case "VALOR_ESPECIFICO":
      return vencedor.valorEspecificoCents !== null
        ? { action: "SUBSTITUIR_VALOR", override: vencedor, valorCents: vencedor.valorEspecificoCents }
        : { action: "AGUARDANDO_APROVACAO", override: vencedor };
    case "SUBSTITUICAO":
      // Substituição por outro colaborador/regra — não resolvido totalmente aqui (requer
      // dado adicional de "substituto"), sinaliza necessidade de aprovação/revisão manual.
      return { action: "AGUARDANDO_APROVACAO", override: vencedor };
    case "BLOQUEIO":
      // Já tratado acima — inalcançável aqui, mas TypeScript exige exaustividade.
      return { action: "BLOQUEAR", override: vencedor };
    default: {
      const _exhaustive: never = vencedor.tipo;
      return _exhaustive;
    }
  }
}
