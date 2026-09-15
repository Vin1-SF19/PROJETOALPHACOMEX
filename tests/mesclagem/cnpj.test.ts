import { describe, expect, it } from "vitest";
import { classificarCnpj, normalizarCnpjMesclagem } from "@/lib/mesclagem/cnpj";

describe("CNPJ mesclagem", () => {
  it("normaliza CNPJ com máscara", () => {
    expect(normalizarCnpjMesclagem("12.345.678/0001-95")).toBe("12345678000195");
  });

  it("classifica CNPJ válido", () => {
    expect(classificarCnpj("12.345.678/0001-95")).toEqual({ status: "valido", cnpj: "12345678000195", recuperado: false });
  });

  it("classifica CNPJ inválido", () => {
    expect(classificarCnpj("12.345.678/0001-96")).toEqual({ status: "invalido", cnpj: "12345678000196", recuperado: false });
  });

  it("classifica CNPJ vazio", () => {
    expect(classificarCnpj("   ")).toEqual({ status: "vazio", cnpj: null, recuperado: false });
  });
});
