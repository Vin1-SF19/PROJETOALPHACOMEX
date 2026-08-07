import { describe, expect, it } from "vitest";
import {
  CANAL_PROSPECCAO_ATIVA,
  normalizarCatalogoProspeccoes,
  ProspeccaoAtivaSchema,
} from "@/lib/comercial/prospeccao-ativa";

describe("catálogo de prospecção ativa", () => {
  it("mantém o rótulo oficial do canal", () => {
    expect(CANAL_PROSPECCAO_ATIVA).toBe("Prospecção ativa");
  });

  it("normaliza espaços antes de persistir", () => {
    expect(ProspeccaoAtivaSchema.parse("  Lista   de   associados  ")).toBe("Lista de associados");
  });

  it("remove vazios, inválidos e duplicatas sem diferenciar caixa", () => {
    expect(normalizarCatalogoProspeccoes([
      "LinkedIn",
      " linkedin ",
      "Lista   própria",
      " ",
      null,
      "Indicação de evento",
    ])).toEqual(["Indicação de evento", "LinkedIn", "Lista própria"]);
  });

  it("rejeita descrições acima do limite", () => {
    expect(ProspeccaoAtivaSchema.safeParse("a".repeat(201)).success).toBe(false);
  });
});
