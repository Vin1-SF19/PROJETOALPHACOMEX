import { describe, expect, it } from "vitest";
import { FINANCIAL_FIELDS, FINANCIAL_FIELD_KEYS, FINANCIAL_STAGES, calcularNovoContratoFinanceiro, calcularRetencoesFinanceiras, campoFinanceiroSomenteLeitura, financialStageKeyFromLabel, validateCanonicalFinancialTransition, validateFinancialTransition } from "@/lib/bpm/pipeline-financeiro";
import { cnpjEhValido } from "@/lib/format-cnpj";

function gerarCnpjValido(): string {
  for (let raiz = 100000000000; raiz < 100000000200; raiz += 1) {
    for (let d1 = 0; d1 <= 9; d1 += 1) {
      for (let d2 = 0; d2 <= 9; d2 += 1) {
        const candidato = `${raiz}${d1}${d2}`;
        if (cnpjEhValido(candidato)) return candidato;
      }
    }
  }
  throw new Error("Nenhum CNPJ válido encontrado no intervalo de busca");
}
describe("pipeline financeiro", () => {
  it("usa os campos ativos do formulário no avanço de Novo contrato", () => {
    const k = FINANCIAL_FIELD_KEYS;
    const valuesByFieldKey = {
      [k.CNPJ]: gerarCnpjValido(), [k.RAZAO_SOCIAL]: "Empresa Teste",
      [k.RUA]: "Rua A", [k.NUMERO]: "10", [k.BAIRRO]: "Centro",
      [k.CEP]: "01310-100", [k.MUNICIPIO]: "São Paulo", [k.ESTADO]: "SP",
      [k.EMAIL]: "contato@teste.com", [k.REGIME_CLIENTE]: "Simples Nacional",
      [k.SERVICO]: "Consultoria", [k.VALOR_BRUTO]: "1000",
      [k.FORMA_PAGAMENTO]: "PIX", [k.CONDICAO]: "À vista",
      [k.VENDEDOR]: "Fulano", [k.ORIGEM]: "Parceiro",
      [k.PARCEIRO]: "Parceiro A",
    };
    expect(k.VALOR_BRUTO).toBe("alpha.financeiro.valor.bruto.contrato");
    expect(k.ORIGEM).toBe("alpha.canal.origem.do.cliente");
    const input = { pipelineKey: "financeiro", fromStageKey: "solicitacao_contrato", toStageKey: "elaboracao_contrato", valuesByFieldKey };
    expect(validateCanonicalFinancialTransition(input).blocked).toBe(false);
    const semSnapshot = Object.fromEntries(Object.entries(valuesByFieldKey).filter(([chave]) => chave !== k.VALOR_BRUTO));
    expect(validateCanonicalFinancialTransition({ ...input, valuesByFieldKey: { ...semSnapshot, [k.VALOR_NEGOCIADO_ORIGEM]: "1000" } }).blocked).toBe(false);
    expect(validateCanonicalFinancialTransition({ ...input, valuesByFieldKey: { ...valuesByFieldKey, [k.ESTADO]: "XX", [k.PARCEIRO]: "" } }).pendingFields)
      .toEqual(expect.arrayContaining([k.ESTADO, k.PARCEIRO]));
    const indicacaoSemParceiro = { ...valuesByFieldKey, [k.ORIGEM]: "Indicação", [k.PARCEIRO]: "" };
    expect(validateCanonicalFinancialTransition({ ...input, valuesByFieldKey: indicacaoSemParceiro }).blocked).toBe(false);
    expect(validateCanonicalFinancialTransition({ ...input, valuesByFieldKey: indicacaoSemParceiro, parceiroVinculado: true }).pendingFields).toContain(k.PARCEIRO);
    expect(validateCanonicalFinancialTransition({ ...input, optionsByFieldKey: { [k.FORMA_PAGAMENTO]: ["Boleto"] } }).pendingFields).toContain(k.FORMA_PAGAMENTO);
  });
  it("mantém seis etapas na ordem contratada", () => { expect(FINANCIAL_STAGES).toHaveLength(6); expect(FINANCIAL_STAGES.map((stage) => stage.label)).toEqual(["Solicitação de Contrato", "Elaboração do Contrato", "Formalização", "Pagamento", "Nota Fiscal", "Concluídos"]) });
  it("mapeia as etapas legadas sem deslocar cards semanticamente", () => { expect(financialStageKeyFromLabel("Solicitação de Contrato")).toBe("solicitacao_contrato"); expect(financialStageKeyFromLabel("Contrato")).toBe("elaboracao_contrato"); expect(financialStageKeyFromLabel("Elaboração do Contrato")).toBe("elaboracao_contrato"); expect(financialStageKeyFromLabel("Formalização da Contratação")).toBe("formalizacao"); expect(financialStageKeyFromLabel("Emissão da Nota Fiscal")).toBe("nota_fiscal") });
  it("classifica todos os campos", () => { expect(FINANCIAL_FIELDS.length).toBeGreaterThan(40); expect(FINANCIAL_FIELDS.every((field) => ["OBRIGATORIO", "OBRIGATORIO_CONDICIONAL", "AUTOMATICO_CALCULADO"].includes(field.category))).toBe(true); expect(campoFinanceiroSomenteLeitura("Valor líquido para pagamento")).toBe(true) });
  it("calcula retenções com memória", () => { const result = calcularRetencoesFinanceiras(10000, 1.5, 4.65); expect(result).toMatchObject({ valorIrrf: 150, valorCsrf: 465, totalRetencoes: 615, valorLiquido: 9385 }); expect(JSON.parse(result.memoriaCalculo).resultados.valorLiquido).toBe(9385) });
  it("calcula Novo contrato somente com retenções declaradas e libera status após dados de pagamento", () => {
    const k = FINANCIAL_FIELD_KEYS;
    const base = {
      [k.REGIME_CLIENTE]: "Simples Nacional", [k.REGIME_PRESTADOR]: "Lucro Presumido",
      [k.VALOR_BRUTO]: "1000", [k.IRRF_APLICAVEL]: "Sim", [k.CSRF_APLICAVEL]: "Não",
    };
    expect(calcularNovoContratoFinanceiro(base).pendencias).toContain(k.ALIQUOTA_IRRF);
    const calculado = calcularNovoContratoFinanceiro({ ...base, [k.ALIQUOTA_IRRF]: "1,5" });
    expect(calculado.automaticValues[k.VALOR_IRRF]).toBe("15");
    expect(calculado.automaticValues[k.VALOR_CSRF]).toBe("0");
    expect(calculado.automaticValues[k.VALOR_LIQUIDO]).toBe("985");
    expect(calculado.automaticValues[k.STATUS_FINANCEIRO]).toBeUndefined();
    expect(calcularNovoContratoFinanceiro({ ...base, [k.ALIQUOTA_IRRF]: "1,5", [k.VENCIMENTO]: "2026-10-10", [k.DADOS_PAGAMENTO]: "PIX" }).automaticValues[k.STATUS_FINANCEIRO])
      .toBe("Aguardando pagamento");
  });
  it("interpreta alíquota canônica com ponto sem multiplicá-la por dez", () => {
    const result = validateFinancialTransition({
      pipelineName: "Financeiro",
      fromStage: "Formalização",
      toStage: "Pagamento",
      values: {
        "Status do contrato/assinatura": "Assinado",
        "Contrato assinado/anexo": "contrato.pdf",
        "Regime tributário do prestador": "Lucro Presumido",
        "Regime tributário do cliente": "Simples Nacional",
        "Forma de pagamento": "PIX",
        Vencimento: "2026-09-10",
        "Link/dados para pagamento": "pix",
        "IRRF aplicável": "Sim",
        "CSRF aplicável": "Não",
        "Alíquota IRRF": "1.5",
        "Valor bruto do contrato": "1000",
      },
    });
    expect(result.automaticValues["Valor IRRF"]).toBe("15");
    expect(result.automaticValues["Valor líquido para pagamento"]).toBe("985");
  });
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
