import { describe, expect, it } from "vitest";
import { FINANCIAL_FIELDS, FINANCIAL_STAGES, calcularRetencoesFinanceiras, campoFinanceiroSomenteLeitura, financialStageKeyFromLabel, validateFinancialTransition } from "@/lib/bpm/pipeline-financeiro";

function cnpjValidoLocal(cnpj: string) { const digits = cnpj.replace(/\D/g, ""); if (digits.length !== 14) return false; if (digits === digits[0].repeat(14)) return false; let sum = 0; for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (12 - i); if ((sum % 11) >= 2) return false; sum = 0; for (let i = 0; i < 13; i++) sum += Number(digits[i]) * (13 - i); return (sum % 11) < 2 }
function gerarCnpjValido(): string {
  for (let raiz = 100000000000; raiz < 100000000200; raiz += 1) {
    for (let d1 = 0; d1 <= 9; d1 += 1) {
      for (let d2 = 0; d2 <= 9; d2 += 1) {
        const candidato = `${raiz}${d1}${d2}`;
        if (cnpjValidoLocal(candidato)) return candidato;
      }
    }
  }
  throw new Error("Nenhum CNPJ válido encontrado no intervalo de busca");
}
describe("pipeline financeiro", () => {
  it("mantém seis etapas na ordem contratada", () => { expect(FINANCIAL_STAGES).toHaveLength(6); expect(FINANCIAL_STAGES.map((stage) => stage.label)).toEqual(["Solicitação de Contrato", "Elaboração do Contrato", "Formalização", "Pagamento", "Nota Fiscal", "Concluídos"]) });
  it("mapeia as etapas legadas sem deslocar cards semanticamente", () => { expect(financialStageKeyFromLabel("Solicitação de Contrato")).toBe("solicitacao_contrato"); expect(financialStageKeyFromLabel("Contrato")).toBe("elaboracao_contrato"); expect(financialStageKeyFromLabel("Elaboração do Contrato")).toBe("elaboracao_contrato"); expect(financialStageKeyFromLabel("Formalização da Contratação")).toBe("formalizacao"); expect(financialStageKeyFromLabel("Emissão da Nota Fiscal")).toBe("nota_fiscal") });
  it("classifica todos os campos", () => { expect(FINANCIAL_FIELDS.length).toBeGreaterThan(40); expect(FINANCIAL_FIELDS.every((field) => ["OBRIGATORIO", "OBRIGATORIO_CONDICIONAL", "AUTOMATICO_CALCULADO"].includes(field.category))).toBe(true); expect(campoFinanceiroSomenteLeitura("Valor líquido para pagamento")).toBe(true) });
  it("calcula retenções com memória", () => { const result = calcularRetencoesFinanceiras(10000, 1.5, 4.65); expect(result).toMatchObject({ valorIrrf: 150, valorCsrf: 465, totalRetencoes: 615, valorLiquido: 9385 }); expect(JSON.parse(result.memoriaCalculo).resultados.valorLiquido).toBe(9385) });
  it("bloqueia salto e lista pendências", () => { expect(validateFinancialTransition({ pipelineName: "Financeiro", fromStage: FINANCIAL_STAGES[0].label, toStage: FINANCIAL_STAGES[2].label, values: {} }).blocked).toBe(true); const result = validateFinancialTransition({ pipelineName: "Financeiro", fromStage: FINANCIAL_STAGES[0].label, toStage: FINANCIAL_STAGES[1].label, values: {} }); expect(result.pendingFields).toContain("CNPJ"); expect(result.message).toBe("Dados pendentes para avançar de etapa.") });
  it("bloqueia a saída da Etapa 1 (Solicitação de Contrato) com campo obrigatório vazio", () => {
    const result = validateFinancialTransition({ pipelineName: "Financeiro", fromStage: "Solicitação de Contrato", toStage: "Elaboração do Contrato", values: { CNPJ: gerarCnpjValido(), "Razão Social": "Empresa Teste", Rua: "Rua A", Número: "10", Bairro: "Centro", CEP: "01310-100", Município: "São Paulo", Estado: "SP", "E-mail": "contato@teste.com", "Regime tributário do cliente": "Simples Nacional", "Serviço contratado": "Consultoria", "Valor bruto do contrato": "1000", "Forma de pagamento": "PIX", "Condição negociada": "À vista", "Vendedor responsável": "Fulano", "Origem do cliente": "Parceiro", "Contato/Nome do responsável": "Ciclano" } });
    expect(result.blocked).toBe(true);
    expect(result.pendingFields).toContain("Parceiro responsável");
  });
  it("libera a saída da Etapa 1 (Solicitação de Contrato) quando todos os campos obrigatórios estão preenchidos", () => {
    const result = validateFinancialTransition({ pipelineName: "Financeiro", fromStage: "Solicitação de Contrato", toStage: "Elaboração do Contrato", values: { CNPJ: gerarCnpjValido(), "Razão Social": "Empresa Teste", Rua: "Rua A", Número: "10", Bairro: "Centro", CEP: "01310-100", Município: "São Paulo", Estado: "SP", "E-mail": "contato@teste.com", "Regime tributário do cliente": "Simples Nacional", "Serviço contratado": "Consultoria", "Valor bruto do contrato": "1000", "Forma de pagamento": "PIX", "Condição negociada": "À vista", "Vendedor responsável": "Fulano", "Origem do cliente": "Orgânico", "Contato/Nome do responsável": "Ciclano" } });
    expect(result.blocked).toBe(false);
    expect(result.pendingFields).toEqual([]);
  });
});
