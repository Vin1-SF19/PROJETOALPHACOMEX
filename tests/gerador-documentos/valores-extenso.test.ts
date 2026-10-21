import { describe, expect, it } from "vitest";
import { campoExtensoAutomatico, sincronizarValoresPorExtenso, valorMonetarioPorExtenso } from "@/lib/gerador-documentos/valores-extenso";

const definicoes = ["valor_total", "valor_total_extenso", "valor_inicial", "valor_inicial_extenso", "valor_final", "valor_final_extenso", "desconto_valor", "desconto_extenso"].map((nome) => ({ nome }));

describe("valores monetários por extenso", () => {
  it.each([
    ["0", "zero reais"], [0, "zero reais"], ["1", "um real"],
    ["0.01", "um centavo"], ["1.01", "um real e um centavo"],
    ["2.02", "dois reais e dois centavos"], ["15000", "quinze mil reais"],
    ["1234.56", "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"],
    ["1.234,56", "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"],
    ["R$ 1.234.567,89", "um milhão, duzentos e trinta e quatro mil quinhentos e sessenta e sete reais e oitenta e nove centavos"],
    [" 10,50 ", "dez reais e cinquenta centavos"],
    ["-1.01", "menos um real e um centavo"],
    ["9999999999999.99", "nove trilhões, novecentos e noventa e nove bilhões, novecentos e noventa e nove milhões, novecentos e noventa e nove mil novecentos e noventa e nove reais e noventa e nove centavos"],
  ])("converte %s sem perder centavos", (valor, esperado) => {
    expect(valorMonetarioPorExtenso(valor)).toBe(esperado);
  });

  it.each(["", " ", "_______", "1.234", "1.2345", "12,345", "10%", "1e3", "1.", "1,", "1.2.3,00", "1,234.56", "abc", "10 reais", "R$", "1".repeat(100), "90071992547409.91", "9007199254740993.01", null, undefined, false, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])("não inventa moeda para %s", (valor) => {
    expect(valorMonetarioPorExtenso(valor)).toBe("");
  });

  it("sincroniza quatro pares sem calcular parcelas, alterar fonte, flags ou outros campos", () => {
    const valores = { valor_total: "10.50", valor_inicial: "1", valor_final: "2", desconto_valor: "0", desconto_extenso: "antigo", __flag: true, nome: "Cliente" };
    const resultado = sincronizarValoresPorExtenso(definicoes, valores);
    expect(resultado).toEqual({ ...valores, valor_total_extenso: "dez reais e cinquenta centavos", valor_inicial_extenso: "um real", valor_final_extenso: "dois reais", desconto_extenso: "zero reais" });
    expect(valores.desconto_extenso).toBe("antigo");
  });

  it("atualiza somente o par alterado e remove o extenso obsoleto ao apagar/invalidar", () => {
    const valores = { valor_total: "", valor_total_extenso: "antigo", valor_final: "1", valor_final_extenso: "preservado" };
    expect(sincronizarValoresPorExtenso(definicoes, valores, "valor_total")).toEqual({ ...valores, valor_total_extenso: "" });
    expect(sincronizarValoresPorExtenso(definicoes, { ...valores, valor_total: "inválido" }, "valor_total").valor_total_extenso).toBe("");
  });

  it("não inventa variáveis nem bloqueia campos sem seu par no template", () => {
    const valores = { valor_total: "1", desconto_extenso: "texto livre", outro: "valor" };
    expect(sincronizarValoresPorExtenso([{ nome: "valor_total" }, { nome: "desconto_extenso" }], valores)).toEqual(valores);
    expect(campoExtensoAutomatico("valor_total_extenso", definicoes)).toBe(true);
    expect(campoExtensoAutomatico("desconto_extenso", [{ nome: "desconto_extenso" }])).toBe(false);
  });
});
