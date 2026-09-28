import { describe, expect, it } from "vitest";
import { calcularNovoContrato, pendenciasValidacaoNovoContrato } from "@/lib/bpm/novo-contrato-financeiro";
import { FINANCIAL_FIELD_KEYS as K } from "@/lib/bpm/pipeline-financeiro";

describe("cálculo de Novo Contrato", () => {
  it("calcula retenções com arredondamento em centavos e guarda a memória", () => {
    const resultado = calcularNovoContrato({
      [K.REGIME_CLIENTE]: "Simples Nacional", [K.REGIME_PRESTADOR]: "Regime Normal",
      [K.VALOR_BRUTO]: "1000.00", [K.IRRF_APLICAVEL]: "Sim", [K.ALIQUOTA_IRRF]: "1.5",
      [K.CSRF_APLICAVEL]: "Sim", [K.ALIQUOTA_CSRF]: "4.65",
      [K.VENCIMENTO]: "2026-12-31", [K.DADOS_PAGAMENTO]: "DADOS DE TESTE",
    });
    expect(resultado.pendencias).toEqual([]);
    expect(resultado.resultados[K.VALOR_IRRF]).toBe("15.00");
    expect(resultado.resultados[K.VALOR_CSRF]).toBe("46.50");
    expect(resultado.resultados[K.TOTAL_RETENCOES]).toBe("61.50");
    expect(resultado.resultados[K.VALOR_LIQUIDO]).toBe("938.50");
    expect(resultado.resultados[K.STATUS_FINANCEIRO]).toBe("Aguardando pagamento");
    expect(JSON.parse(resultado.resultados[K.MEMORIA_CALCULO]!).bruto).toBe("1000.00");
  });

  it("não libera pagamento sem alíquota ou dados de pagamento", () => {
    const regimes = { [K.REGIME_CLIENTE]: "Simples Nacional", [K.REGIME_PRESTADOR]: "Regime Normal" };
    const incompleto = calcularNovoContrato({ ...regimes, [K.VALOR_BRUTO]: "100", [K.IRRF_APLICAVEL]: "Sim", [K.CSRF_APLICAVEL]: "Não" });
    expect(incompleto.pendencias).toContain("Alíquota IRRF");
    expect(incompleto.resultados[K.VALOR_LIQUIDO]).toBe("");
    const semPagamento = calcularNovoContrato({ ...regimes, [K.VALOR_BRUTO]: "100", [K.IRRF_APLICAVEL]: "Não", [K.CSRF_APLICAVEL]: "Não" });
    expect(semPagamento.resultados[K.VALOR_LIQUIDO]).toBe("100.00");
    expect(semPagamento.resultados[K.STATUS_FINANCEIRO]).toBe("");
  });

  it("recusa valores cadastrais e monetários inválidos", () => {
    expect(pendenciasValidacaoNovoContrato({ [K.CEP]: "123", [K.ESTADO]: "XX", [K.VALOR_BRUTO]: "0" }))
      .toEqual(["CEP inválido", "Estado (UF) inválido", "Valor bruto do contrato inválido"]);
  });
});
