import { describe, expect, it } from "vitest";
import {
  VariavelTemplateSchema,
  CriarTemplateSchema,
  GerarDocumentoSchema,
  ReescreverClasulaSchema,
} from "@/lib/gerador-documentos/schemas";

describe("VariavelTemplateSchema", () => {
  it("aceita nome válido (letras, números, underscore, começando com letra)", () => {
    const resultado = VariavelTemplateSchema.safeParse({
      nome: "cliente_nome_2",
      label: "Cliente",
      tipo: "texto",
      obrigatorio: true,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita nome com espaço", () => {
    const resultado = VariavelTemplateSchema.safeParse({
      nome: "cliente nome",
      label: "Cliente",
      tipo: "texto",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita nome começando com número", () => {
    const resultado = VariavelTemplateSchema.safeParse({
      nome: "2cliente",
      label: "Cliente",
      tipo: "texto",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita tipo fora do enum permitido", () => {
    const resultado = VariavelTemplateSchema.safeParse({
      nome: "cliente",
      label: "Cliente",
      tipo: "invalido",
    });
    expect(resultado.success).toBe(false);
  });

  it("obrigatorio default é true quando omitido", () => {
    const resultado = VariavelTemplateSchema.parse({ nome: "x", label: "X", tipo: "texto" });
    expect(resultado.obrigatorio).toBe(true);
  });
});

describe("CriarTemplateSchema", () => {
  it("exige ao menos 1 cláusula", () => {
    const resultado = CriarTemplateSchema.safeParse({ titulo: "T", clausulas: [] });
    expect(resultado.success).toBe(false);
  });

  it("rejeita mais de 200 cláusulas", () => {
    const clausulas = Array.from({ length: 201 }, (_, i) => ({ titulo: `C${i}`, conteudo: "texto" }));
    const resultado = CriarTemplateSchema.safeParse({ titulo: "T", clausulas });
    expect(resultado.success).toBe(false);
  });

  it("aceita exatamente 200 cláusulas (limite, não excedente)", () => {
    const clausulas = Array.from({ length: 200 }, (_, i) => ({ titulo: `C${i}`, conteudo: "texto" }));
    const resultado = CriarTemplateSchema.safeParse({ titulo: "T", clausulas });
    expect(resultado.success).toBe(true);
  });

  it("rejeita título vazio", () => {
    const resultado = CriarTemplateSchema.safeParse({
      titulo: "",
      clausulas: [{ titulo: "C", conteudo: "texto" }],
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita cláusula com conteúdo vazio", () => {
    const resultado = CriarTemplateSchema.safeParse({
      titulo: "T",
      clausulas: [{ titulo: "C", conteudo: "" }],
    });
    expect(resultado.success).toBe(false);
  });
});

describe("GerarDocumentoSchema", () => {
  it("exige templateId no formato cuid", () => {
    const resultado = GerarDocumentoSchema.safeParse({
      templateId: "não-é-cuid",
      titulo: "Doc",
      variaveis: {},
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita variaveis com string, número, booleano e null", () => {
    const resultado = GerarDocumentoSchema.safeParse({
      templateId: "clx0000000000000000000000",
      titulo: "Doc",
      variaveis: { a: "x", b: 1, c: true, d: null },
    });
    expect(resultado.success).toBe(true);
  });
});

describe("ReescreverClasulaSchema", () => {
  it("rejeita instrução com menos de 3 caracteres (evita chamadas vazias à IA)", () => {
    const resultado = ReescreverClasulaSchema.safeParse({
      documentoId: "clx0000000000000000000000",
      clasulaId: "clx0000000000000000000001",
      instrucao: "ok",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita instrução acima de 2000 caracteres", () => {
    const resultado = ReescreverClasulaSchema.safeParse({
      documentoId: "clx0000000000000000000000",
      clasulaId: "clx0000000000000000000001",
      instrucao: "a".repeat(2001),
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita instrução válida", () => {
    const resultado = ReescreverClasulaSchema.safeParse({
      documentoId: "clx0000000000000000000000",
      clasulaId: "clx0000000000000000000001",
      instrucao: "Deixe o tom mais formal",
    });
    expect(resultado.success).toBe(true);
  });
});
