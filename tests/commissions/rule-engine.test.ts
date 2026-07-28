import { describe, expect, it } from "vitest";
import { evaluateCondition, evaluateRules, ruleMatches } from "@/lib/commissions/rule-engine";
import type { CommissionRuleVersionData } from "@/lib/commissions/types";

function makeRule(overrides: Partial<CommissionRuleVersionData>): CommissionRuleVersionData {
  return {
    ruleId: "test-rule",
    ruleName: "Regra de teste",
    version: 1,
    eventType: "CONTRACTING",
    benefitType: "COMMISSION",
    priority: 0,
    conditions: [],
    calculation: { type: "FIXED", benefitType: "COMMISSION", fixedAmountCents: 100 },
    paymentSchedule: { scheduleRuleName: "QUINTO_DIA_UTIL_CLT" },
    approvalRequired: false,
    active: true,
    ...overrides,
  };
}

describe("evaluateCondition — operadores", () => {
  it("EQUALS / NOT_EQUALS", () => {
    expect(evaluateCondition({ field: "x", operator: "EQUALS", value: 10 }, { x: 10 })).toBe(true);
    expect(evaluateCondition({ field: "x", operator: "NOT_EQUALS", value: 10 }, { x: 5 })).toBe(true);
  });

  it("GREATER_THAN / GREATER_THAN_OR_EQUAL / LESS_THAN / LESS_THAN_OR_EQUAL", () => {
    expect(evaluateCondition({ field: "valor", operator: "GREATER_THAN", value: 100 }, { valor: 150 })).toBe(true);
    expect(evaluateCondition({ field: "valor", operator: "GREATER_THAN_OR_EQUAL", value: 100 }, { valor: 100 })).toBe(true);
    expect(evaluateCondition({ field: "valor", operator: "LESS_THAN", value: 100 }, { valor: 50 })).toBe(true);
    expect(evaluateCondition({ field: "valor", operator: "LESS_THAN_OR_EQUAL", value: 100 }, { valor: 100 })).toBe(true);
  });

  it("CONTAINS em string e em array", () => {
    expect(evaluateCondition({ field: "servico", operator: "CONTAINS", value: "RADAR" }, { servico: "Revisão de RADAR" })).toBe(true);
    expect(evaluateCondition({ field: "tags", operator: "CONTAINS", value: "x" }, { tags: ["a", "x"] })).toBe(true);
  });

  it("IN", () => {
    expect(evaluateCondition({ field: "servico", operator: "IN", value: ["A", "B"] }, { servico: "B" })).toBe(true);
    expect(evaluateCondition({ field: "servico", operator: "IN", value: ["A", "B"] }, { servico: "C" })).toBe(false);
  });

  it("BETWEEN", () => {
    expect(evaluateCondition({ field: "valor", operator: "BETWEEN", value: [10, 20] }, { valor: 15 })).toBe(true);
    expect(evaluateCondition({ field: "valor", operator: "BETWEEN", value: [10, 20] }, { valor: 25 })).toBe(false);
  });

  it("EXISTS / NOT_EXISTS", () => {
    expect(evaluateCondition({ field: "x", operator: "EXISTS" }, { x: 1 })).toBe(true);
    expect(evaluateCondition({ field: "x", operator: "EXISTS" }, {})).toBe(false);
    expect(evaluateCondition({ field: "x", operator: "NOT_EXISTS" }, {})).toBe(true);
  });

  it("BEFORE / AFTER", () => {
    expect(evaluateCondition({ field: "data", operator: "BEFORE", value: "2026-07-01" }, { data: "2026-06-01" })).toBe(true);
    expect(evaluateCondition({ field: "data", operator: "AFTER", value: "2026-06-30T23:59:59-03:00" }, { data: "2026-07-15" })).toBe(true);
    expect(evaluateCondition({ field: "data", operator: "AFTER", value: "2026-06-30T23:59:59-03:00" }, { data: "2026-05-01" })).toBe(false);
  });
});

describe("ruleMatches", () => {
  it("regra inativa nunca casa mesmo com condições verdadeiras", () => {
    const rule = makeRule({ active: false, conditions: [] });
    expect(ruleMatches(rule, {})).toBe(false);
  });

  it("todas as condições precisam ser verdadeiras (AND implícito)", () => {
    const rule = makeRule({
      conditions: [
        { field: "servico", operator: "EQUALS", value: "Revisão de RADAR 150k" },
        { field: "primeiraTentativa", operator: "EQUALS", value: true },
      ],
    });
    expect(ruleMatches(rule, { servico: "Revisão de RADAR 150k", primeiraTentativa: true })).toBe(true);
    expect(ruleMatches(rule, { servico: "Revisão de RADAR 150k", primeiraTentativa: false })).toBe(false);
  });
});

describe("evaluateRules — ordem de precedência (seção 15)", () => {
  it("regra individual vence sobre regra de cargo geral", () => {
    const regraCargoGeral = makeRule({ ruleId: "cargo-geral", cargoId: 1, version: 1 });
    const regraIndividual = makeRule({ ruleId: "individual", collaboratorId: 42, version: 1 });

    const result = evaluateRules([regraCargoGeral, regraIndividual], {});
    expect(result.matchedRule?.ruleId).toBe("individual");
    expect(result.precedenceLevel).toBe("INDIVIDUAL");
  });

  it("regra de contrato vence sobre regra de empresa", () => {
    const regraEmpresa = makeRule({ ruleId: "empresa", clienteId: 10 });
    const regraContrato = makeRule({ ruleId: "contrato", contratoComercialId: "c1" });

    const result = evaluateRules([regraEmpresa, regraContrato], {});
    expect(result.matchedRule?.ruleId).toBe("contrato");
  });

  it("bloqueio vence sobre qualquer outra regra", () => {
    const regraIndividual = makeRule({ ruleId: "individual", collaboratorId: 42 });
    const regraBloqueio = makeRule({ ruleId: "bloqueio", blocked: true });

    const result = evaluateRules([regraIndividual, regraBloqueio], {});
    expect(result.matchedRule?.ruleId).toBe("bloqueio");
    expect(result.precedenceLevel).toBe("BLOQUEIO");
  });

  it("cargo+serviço vence sobre cargo geral", () => {
    const regraCargoGeral = makeRule({ ruleId: "cargo-geral", cargoId: 1 });
    const regraCargoServico = makeRule({ ruleId: "cargo-servico", cargoId: 1, servico: "Revisão de RADAR" });

    const result = evaluateRules([regraCargoGeral, regraCargoServico], {});
    expect(result.matchedRule?.ruleId).toBe("cargo-servico");
  });

  it("dentro do mesmo nível, maior priority vence", () => {
    const regraBaixa = makeRule({ ruleId: "baixa", cargoId: 1, priority: 0 });
    const regraAlta = makeRule({ ruleId: "alta", cargoId: 1, priority: 10 });

    const result = evaluateRules([regraBaixa, regraAlta], {});
    expect(result.matchedRule?.ruleId).toBe("alta");
  });

  it("dentro do mesmo nível e priority, versão mais recente vence", () => {
    const v1 = makeRule({ ruleId: "v1", cargoId: 1, version: 1 });
    const v2 = makeRule({ ruleId: "v2", cargoId: 1, version: 2 });

    const result = evaluateRules([v1, v2], {});
    expect(result.matchedRule?.ruleId).toBe("v2");
  });

  it("nenhuma regra casa → matchedRule null", () => {
    const rule = makeRule({ conditions: [{ field: "servico", operator: "EQUALS", value: "X" }] });
    const result = evaluateRules([rule], { servico: "Y" });
    expect(result.matchedRule).toBeNull();
    expect(result.precedenceLevel).toBeNull();
  });
});

describe("Regras seed — casos da seção 37 do prompt original", () => {
  it("Closer: 2,5% quando fechado abaixo do tarifário padrão", () => {
    const rule = makeRule({
      ruleId: "closer-abaixo",
      conditions: [{ field: "fechadoNoTarifarioOuAcima", operator: "EQUALS", value: false }],
      calculation: { type: "PERCENTAGE", benefitType: "COMMISSION", rate: 0.025 },
    });
    const result = evaluateRules([rule], { fechadoNoTarifarioOuAcima: false });
    expect(result.matchedRule?.calculation.rate).toBe(0.025);
  });

  it("Closer: 4% quando fechado no tarifário padrão ou acima", () => {
    const rule = makeRule({
      ruleId: "closer-acima",
      conditions: [{ field: "fechadoNoTarifarioOuAcima", operator: "EQUALS", value: true }],
      calculation: { type: "PERCENTAGE", benefitType: "COMMISSION", rate: 0.04 },
    });
    const result = evaluateRules([rule], { fechadoNoTarifarioOuAcima: true });
    expect(result.matchedRule?.calculation.rate).toBe(0.04);
  });

  it("Diretora Comercial: 8% sobre a base comissionável", () => {
    const rule = makeRule({
      ruleId: "diretora-comercial",
      calculation: { type: "PERCENTAGE", benefitType: "COMMISSION", rate: 0.08 },
    });
    const result = evaluateRules([rule], {});
    expect(result.matchedRule?.calculation.rate).toBe(0.08);
  });

  it("Diretor Operacional: elegível apenas para contratação em 01/07/2026 ou depois", () => {
    const rule = makeRule({
      ruleId: "diretor-operacional",
      conditions: [{ field: "dataContratacao", operator: "AFTER", value: "2026-06-30T23:59:59-03:00" }],
    });
    expect(ruleMatches(rule, { dataContratacao: "2026-07-01T10:00:00-03:00" })).toBe(true);
    expect(ruleMatches(rule, { dataContratacao: "2026-06-29T10:00:00-03:00" })).toBe(false);
  });

  it("data mínima de 23/08/2026 (exemplo Analista II em experiência)", () => {
    const rule = makeRule({
      ruleId: "analista-ii-experiencia",
      conditions: [{ field: "dataContratacaoEmpresa", operator: "AFTER", value: "2026-08-22T23:59:59-03:00" }],
    });
    expect(ruleMatches(rule, { dataContratacaoEmpresa: "2026-08-23T00:00:00-03:00" })).toBe(true);
    expect(ruleMatches(rule, { dataContratacaoEmpresa: "2026-08-20T00:00:00-03:00" })).toBe(false);
  });
});
