import { describe, expect, it } from "vitest";

import {
  BLUEPRINT_PREMIO_MAX_CENTS,
  formatarPremioBRL,
  formatarPremioParaInput,
  parsePremioReaisParaCents,
  podeAlterarPremioBlueprint,
} from "@/lib/blueprint/premio";

describe("parsePremioReaisParaCents", () => {
  it.each([
    ["", null],
    ["0", 0],
    ["0,01", 1],
    ["1500", 150_000],
    ["1.500", 150_000],
    ["1.500,25", 150_025],
    ["1500.25", 150_025],
    ["R$ 1.500,25", 150_025],
    ["21.474.836,47", BLUEPRINT_PREMIO_MAX_CENTS],
  ])("converte %s sem usar ponto flutuante", (entrada, esperado) => {
    expect(parsePremioReaisParaCents(entrada)).toEqual({ success: true, value: esperado });
  });

  it.each(["-1", "1,234", "abc", "1.2.3", "21.474.836,48"])("rejeita valor inválido: %s", (entrada) => {
    expect(parsePremioReaisParaCents(entrada).success).toBe(false);
  });
});

describe("formatação do prêmio", () => {
  it("formata centavos em BRL para exibição", () => {
    expect(formatarPremioBRL(150_025)).toContain("1.500,25");
  });

  it("formata para o input e preserva ausência", () => {
    expect(formatarPremioParaInput(150_025)).toBe("1.500,25");
    expect(formatarPremioParaInput(null)).toBe("");
  });
});

describe("podeAlterarPremioBlueprint", () => {
  it("autoriza somente o usuário que criou o projeto", () => {
    expect(podeAlterarPremioBlueprint(42, 42)).toBe(true);
    expect(podeAlterarPremioBlueprint(42, 7)).toBe(false);
  });

  it("não concede bypass implícito a outro ID administrativo", () => {
    const criadorId = 42;
    const adminId = 1;
    expect(podeAlterarPremioBlueprint(criadorId, adminId)).toBe(false);
  });
});
