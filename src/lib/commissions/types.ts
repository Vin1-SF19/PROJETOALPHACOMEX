// Tipos compartilhados do motor de regras de Gestão de Comissões e Prêmios.
// Dinheiro sempre em centavos (Int) — nunca Float, ver decisions.md (2026-07-28).

export type EventType =
  | "CONTRACTING"
  | "PROCESS_STARTED"
  | "PROCESS_SUCCESS"
  | "FIRST_ATTEMPT_SUCCESS"
  | "AUXILIARY_PARTICIPATION"
  | "MANUAL_EVENT"
  | "CANCELLATION"
  | "REVERSAL";

export type BenefitType = "COMMISSION" | "BONUS" | "DSR";

export type ConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "CONTAINS"
  | "IN"
  | "BETWEEN"
  | "EXISTS"
  | "NOT_EXISTS"
  | "BEFORE"
  | "AFTER";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export type CalculationType =
  | "PERCENTAGE"
  | "FIXED"
  | "PER_UNIT"
  | "ADDITIONAL"
  | "DSR"
  | "CAP"
  | "FLOOR"
  | "PROPORTIONAL"
  | "SUM_OF_COMPONENTS"
  | "TOTAL_FIXO_COM_DSR";

export interface RuleCalculation {
  type: CalculationType;
  benefitType: BenefitType;
  /** Percentual expresso como fração (0.04 = 4%), usado quando type === "PERCENTAGE". */
  rate?: number;
  /** Base explícita da regra percentual. Ausente preserva o cálculo legado por tarifário. */
  baseCalculo?: "VALOR_BRUTO" | "VALOR_LIQUIDO";
  /** Valor fixo em centavos, usado quando type === "FIXED" | "ADDITIONAL". */
  fixedAmountCents?: number;
  /** Valor por unidade em centavos, usado quando type === "PER_UNIT". */
  perUnitAmountCents?: number;
  quantity?: number;
  /** Teto/piso em centavos, usados com CAP/FLOOR. */
  capCents?: number;
  floorCents?: number;
  /** Proporção (0-1), usada com PROPORTIONAL. */
  proportion?: number;
  /** Componentes a somar, usados com SUM_OF_COMPONENTS (referem-se a outros cálculos já resolvidos). */
  componentsCents?: number[];
  /** Nome da fórmula de DSR a aplicar — resolvida por dsr-formula.ts, nunca percentual fixo hardcoded aqui. */
  dsrFormulaName?: string;
  /**
   * Usado com type === "TOTAL_FIXO_COM_DSR": o valor total (comissão+DSR combinados, ex:
   * R$350 do Analista Sênior) é decomposto em comissão base + DSR usando
   * `diasUteis`/`diasDescanso` do mês do evento — nunca um DSR fixo hardcoded separado.
   */
  totalFixoComDsrCents?: number;
}

export interface PaymentSchedule {
  /** Nome da regra de calendário a aplicar (ex: "QUINTO_DIA_UTIL_CLT", "ULTIMO_DIA_MES_SEGUINTE_PJ"). */
  scheduleRuleName: string;
}

export interface CommissionRuleVersionData {
  ruleId: string;
  ruleName: string;
  version: number;
  /** FK da versão persistida; ausente apenas nas regras legadas em código. */
  ruleVersionId?: string;
  eventType: EventType;
  benefitType: BenefitType;
  /** Quanto maior, mais precedência dentro do MESMO nível hierárquico (ver PrecedenceLevel). */
  priority: number;
  cargoId?: number | null;
  setorId?: number | null;
  collaboratorId?: number | null;
  clienteId?: number | null;
  contratoComercialId?: string | null;
  servico?: string | null;
  conditions: RuleCondition[];
  calculation: RuleCalculation;
  paymentSchedule: PaymentSchedule;
  approvalRequired: boolean;
  active: boolean;
  blocked?: boolean;
}

/** Fatos disponíveis para avaliação de uma regra contra um evento/colaborador específico. */
export type FactRecord = Record<string, unknown>;

export interface RuleEvaluationResult {
  matchedRule: CommissionRuleVersionData | null;
  candidateRules: CommissionRuleVersionData[];
  precedenceLevel: PrecedenceLevelName | null;
}

/**
 * Ordem de precedência (seção 15 do prompt original) — do mais específico para o mais genérico.
 * Nunca reordenar sem decisão explícita do usuário.
 */
export const PRECEDENCE_ORDER = [
  "BLOQUEIO",
  "CONTRATO",
  "EMPRESA",
  "INDIVIDUAL",
  "CARGO_SERVICO",
  "CARGO_GERAL",
  "PADRAO",
] as const;

export type PrecedenceLevelName = (typeof PRECEDENCE_ORDER)[number];
