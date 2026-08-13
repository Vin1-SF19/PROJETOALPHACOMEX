import { describe, expect, it } from "vitest";

import { formatarCnpj } from "@/components/Extratos/lib/formatters";

describe("formatarCnpj (Fase 3.3 do Cliente Master — Cliente.cnpj nullable)", () => {
  it("formata CNPJ de 14 dígitos com máscara", () => {
    expect(formatarCnpj("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("retorna 'CNPJ pendente' para null (empresa em constituição)", () => {
    expect(formatarCnpj(null)).toBe("CNPJ pendente");
  });

  it("retorna 'CNPJ pendente' para undefined", () => {
    expect(formatarCnpj(undefined)).toBe("CNPJ pendente");
  });

  it("retorna 'CNPJ pendente' para string vazia", () => {
    expect(formatarCnpj("")).toBe("CNPJ pendente");
  });
});
