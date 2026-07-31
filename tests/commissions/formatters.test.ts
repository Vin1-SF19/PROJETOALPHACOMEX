import { describe, expect, it } from "vitest";
import { formatarFormaPagamentoComissao } from "@/components/Comissoes/lib/formatters";

describe("formatarFormaPagamentoComissao", () => {
  it("exibe ENTRADA_EXITO com o mesmo rótulo de Metas/CS", () => {
    expect(formatarFormaPagamentoComissao("ENTRADA_EXITO")).toBe(
      "50% Entrada / 50% Êxito (Pix)",
    );
  });

  it("traduz os códigos equivalentes antigos do módulo", () => {
    expect(formatarFormaPagamentoComissao("PARCELADO_CONTRATACAO_EXITO")).toBe(
      "50% Entrada / 50% Êxito (Pix)",
    );
    expect(formatarFormaPagamentoComissao("CARTAO_PARCELADO")).toBe(
      "Parcelamento Cartão de Crédito - até 12x com juros",
    );
    expect(formatarFormaPagamentoComissao("A_VISTA_DESCONTO")).toBe(
      "Integral na contratação - 10% OFF (Pix)",
    );
  });

  it("preserva uma forma de pagamento personalizada", () => {
    expect(formatarFormaPagamentoComissao("Boleto em 3 parcelas")).toBe(
      "Boleto em 3 parcelas",
    );
  });
});
