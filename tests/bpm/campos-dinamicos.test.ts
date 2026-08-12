import { describe, expect, it } from "vitest";

import { validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";

const campos = [
  { id: "texto", nome: "Texto", tipo: "texto", opcoesJson: null },
  { id: "numero", nome: "Valor", tipo: "numero", opcoesJson: null },
  { id: "data", nome: "Data", tipo: "data", opcoesJson: null },
  { id: "booleano", nome: "Confirmado", tipo: "booleano", opcoesJson: null },
  {
    id: "selecao",
    nome: "Resultado",
    tipo: "selecao",
    opcoesJson: JSON.stringify(["Aprovado", "Reprovado"]),
  },
] as const;

describe("validação semântica de campos BPM", () => {
  it("aceita e normaliza valores válidos de todos os tipos", () => {
    expect(validarValoresCamposBpm(campos, {
      texto: "  observação  ",
      numero: "123.45",
      data: "2026-08-12",
      booleano: "Sim",
      selecao: "Aprovado",
    })).toEqual({
      success: true,
      valores: {
        texto: "observação",
        numero: "123.45",
        data: "2026-08-12",
        booleano: "Sim",
        selecao: "Aprovado",
      },
    });
  });

  it.each([
    ["numero", "12x", "numérico"],
    ["data", "2026-02-30", "data válida"],
    ["booleano", "true", "Sim ou Não"],
    ["selecao", "Injetado", "opção inválida"],
  ])("rejeita %s semanticamente inválido", (id, valor, mensagem) => {
    const resultado = validarValoresCamposBpm(campos, { [id]: valor });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error).toContain(mensagem);
  });

  it("rejeita campo fora do contexto autorizado", () => {
    const resultado = validarValoresCamposBpm(campos, { arbitrario: "valor" });
    expect(resultado).toEqual({
      success: false,
      error: "Um ou mais campos não pertencem a este contexto.",
    });
  });
});
