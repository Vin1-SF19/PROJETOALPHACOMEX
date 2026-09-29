import { describe, expect, it } from "vitest";
import { avaliarPagamentoFinanceiro } from "@/lib/bpm/financeiro-pagamento-validacao";

const base = {
  confirmado: "Sim", data: "2026-09-29T12:00:00.000Z", esperado: "97.50",
  recebido: "97,50", forma: "Pix", comprovanteExigido: false,
  comprovanteValido: false, liquido: "97.50", bruto: "100.00", retencoes: "2.50",
};

describe("validação da confirmação financeira", () => {
  it("usa o líquido e compara centavos sem ponto flutuante", () => {
    expect(avaliarPagamentoFinanceiro(base)).toEqual({ concluido: true, divergencia: false, pendencias: [] });
  });

  it("bloqueia confirmação incompleta e valores negativos", () => {
    const resultado = avaliarPagamentoFinanceiro({ ...base, data: "", recebido: "-1", forma: "" });
    expect(resultado.concluido).toBe(false);
    expect(resultado.pendencias).toEqual(expect.arrayContaining([
      "Data do pagamento", "Valor recebido", "Forma de pagamento utilizada",
    ]));
  });

  it("sinaliza divergência e exige comprovante apenas quando configurado", () => {
    const resultado = avaliarPagamentoFinanceiro({ ...base, recebido: "97.49", comprovanteExigido: true });
    expect(resultado.divergencia).toBe(true);
    expect(resultado.pendencias).toEqual(expect.arrayContaining([
      "Comprovante", "Divergência financeira: valor recebido diferente do esperado",
    ]));
  });

  it("não usa o bruto quando há retenções e falta o líquido", () => {
    const resultado = avaliarPagamentoFinanceiro({ ...base, liquido: "", esperado: "100.00" });
    expect(resultado.pendencias).toContain("Valor esperado divergente do valor líquido calculado");
  });

  it("usa o bruto sem retenções quando o líquido não está disponível", () => {
    const resultado = avaliarPagamentoFinanceiro({ ...base, liquido: "", retencoes: "0.00",
      esperado: "100.00", recebido: "100.00" });
    expect(resultado.concluido).toBe(true);
  });
});
