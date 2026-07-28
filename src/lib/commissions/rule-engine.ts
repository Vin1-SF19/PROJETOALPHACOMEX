import type {
  CommissionRuleVersionData,
  ConditionOperator,
  FactRecord,
  PrecedenceLevelName,
  RuleCondition,
  RuleEvaluationResult,
} from "./types";
import { PRECEDENCE_ORDER } from "./types";

/**
 * Avalia uma única condição contra os fatos do evento. Puro, determinístico, sem `eval`
 * nem execução de código arbitrário — cada operador é um `case` explícito.
 */
export function evaluateCondition(condition: RuleCondition, facts: FactRecord): boolean {
  const factValue = facts[condition.field];
  const operator: ConditionOperator = condition.operator;

  switch (operator) {
    case "EQUALS":
      return factValue === condition.value;
    case "NOT_EQUALS":
      return factValue !== condition.value;
    case "GREATER_THAN":
      return isComparable(factValue, condition.value) && factValue! > (condition.value as number | string);
    case "GREATER_THAN_OR_EQUAL":
      return isComparable(factValue, condition.value) && factValue! >= (condition.value as number | string);
    case "LESS_THAN":
      return isComparable(factValue, condition.value) && factValue! < (condition.value as number | string);
    case "LESS_THAN_OR_EQUAL":
      return isComparable(factValue, condition.value) && factValue! <= (condition.value as number | string);
    case "CONTAINS":
      return typeof factValue === "string" && typeof condition.value === "string"
        ? factValue.includes(condition.value)
        : Array.isArray(factValue) && condition.value !== undefined
          ? factValue.includes(condition.value)
          : false;
    case "IN":
      return Array.isArray(condition.value) && condition.value.includes(factValue);
    case "BETWEEN": {
      const [min, max] = (condition.value as [number, number]) ?? [];
      return (
        isComparable(factValue, min) &&
        isComparable(factValue, max) &&
        (factValue as number) >= min &&
        (factValue as number) <= max
      );
    }
    case "EXISTS":
      return factValue !== undefined && factValue !== null;
    case "NOT_EXISTS":
      return factValue === undefined || factValue === null;
    case "BEFORE":
      return isDateComparable(factValue, condition.value) && toDate(factValue)! < toDate(condition.value)!;
    case "AFTER":
      return isDateComparable(factValue, condition.value) && toDate(factValue)! > toDate(condition.value)!;
    default: {
      const _exhaustive: never = operator;
      return _exhaustive;
    }
  }
}

function isComparable(a: unknown, b: unknown): a is number | string {
  return (typeof a === "number" || typeof a === "string") && (typeof b === "number" || typeof b === "string");
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isDateComparable(a: unknown, b: unknown): boolean {
  return toDate(a) !== null && toDate(b) !== null;
}

/** Uma regra "casa" quando TODAS as suas condições são verdadeiras (AND implícito). */
export function ruleMatches(rule: CommissionRuleVersionData, facts: FactRecord): boolean {
  if (!rule.active) return false;
  return rule.conditions.every((condition) => evaluateCondition(condition, facts));
}

/** Classifica uma regra no nível de precedência (seção 15) a partir de seus campos de escopo. */
export function classifyPrecedenceLevel(rule: CommissionRuleVersionData): PrecedenceLevelName {
  if (rule.blocked) return "BLOQUEIO";
  if (rule.contratoComercialId) return "CONTRATO";
  if (rule.clienteId) return "EMPRESA";
  if (rule.collaboratorId) return "INDIVIDUAL";
  if (rule.cargoId && rule.servico) return "CARGO_SERVICO";
  if (rule.cargoId) return "CARGO_GERAL";
  return "PADRAO";
}

/**
 * Avalia todas as regras candidatas contra os fatos e retorna a regra vencedora,
 * respeitando a ordem de precedência: bloqueio > contrato > empresa > individual >
 * cargo+serviço > cargo geral > padrão (seção 15 do prompt original — nunca reordenar).
 * Dentro do mesmo nível, desempata por `priority` (maior vence) e depois por `version`
 * (mais recente vence).
 */
export function evaluateRules(rules: CommissionRuleVersionData[], facts: FactRecord): RuleEvaluationResult {
  const candidates = rules.filter((rule) => ruleMatches(rule, facts));

  if (candidates.length === 0) {
    return { matchedRule: null, candidateRules: [], precedenceLevel: null };
  }

  const byLevel = new Map<PrecedenceLevelName, CommissionRuleVersionData[]>();
  for (const rule of candidates) {
    const level = classifyPrecedenceLevel(rule);
    const bucket = byLevel.get(level) ?? [];
    bucket.push(rule);
    byLevel.set(level, bucket);
  }

  for (const level of PRECEDENCE_ORDER) {
    const bucket = byLevel.get(level);
    if (!bucket || bucket.length === 0) continue;

    const sorted = [...bucket].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.version - a.version;
    });

    return { matchedRule: sorted[0], candidateRules: candidates, precedenceLevel: level };
  }

  // Não deveria ser alcançável (candidates não-vazio implica algum nível populado),
  // mas evita retorno implícito undefined em caso de dado inconsistente.
  return { matchedRule: null, candidateRules: candidates, precedenceLevel: null };
}
