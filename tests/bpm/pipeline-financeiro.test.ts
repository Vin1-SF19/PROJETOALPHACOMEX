import { describe, expect, it } from "vitest";
import { FINANCIAL_FIELDS, FINANCIAL_STAGES, calcularRetencoesFinanceiras, campoFinanceiroSomenteLeitura, validateFinancialTransition } from "@/lib/bpm/pipeline-financeiro";
describe("pipeline financeiro", () => {
  it("mantém seis etapas na ordem contratada", () => expect(FINANCIAL_STAGES).toHaveLength(6));
  it("classifica todos os campos", () => { expect(FINANCIAL_FIELDS.length).toBeGreaterThan(40); expect(FINANCIAL_FIELDS.every((field) => ["OBRIGATORIO", "OBRIGATORIO_CONDICIONAL", "AUTOMATICO_CALCULADO"].includes(field.category))).toBe(true); expect(campoFinanceiroSomenteLeitura("Valor líquido para pagamento")).toBe(true) });
  it("calcula retenções com memória", () => { const result = calcularRetencoesFinanceiras(10000, 1.5, 4.65); expect(result).toMatchObject({ valorIrrf: 150, valorCsrf: 465, totalRetencoes: 615, valorLiquido: 9385 }); expect(JSON.parse(result.memoriaCalculo).resultados.valorLiquido).toBe(9385) });
  it("bloqueia salto e lista pendências", () => { expect(validateFinancialTransition({ pipelineName: "Financeiro", fromStage: FINANCIAL_STAGES[0].label, toStage: FINANCIAL_STAGES[2].label, values: {} }).blocked).toBe(true); const result = validateFinancialTransition({ pipelineName: "Financeiro", fromStage: FINANCIAL_STAGES[0].label, toStage: FINANCIAL_STAGES[1].label, values: {} }); expect(result.pendingFields).toContain("CNPJ"); expect(result.message).toBe("Dados pendentes para elaboração do contrato.") });
});
