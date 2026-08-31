import { describe, expect, it } from "vitest";
import {
  VariavelTemplateSchema,
  CriarTemplateSchema,
  GerarDocumentoSchema,
  ReescreverClasulaSchema,
  IdentificacaoTemplateSchema,
  EmpresaContratadaSchema,
  AtualizarEmpresaContratadaSchema,
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

describe("IdentificacaoTemplateSchema", () => {
  it("aceita payload válido com variáveis e cláusulas", () => {
    const resultado = IdentificacaoTemplateSchema.safeParse({
      variaveis: [{ nome: "cliente", label: "Cliente", tipo: "texto", obrigatorio: true }],
      clausulas: [{ titulo: "Objeto", conteudo: "Texto com {{cliente}}." }],
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita variaveis vazio — lista de variáveis é opcional (documento sem dado variável)", () => {
    const resultado = IdentificacaoTemplateSchema.safeParse({
      variaveis: [],
      clausulas: [{ titulo: "Objeto", conteudo: "Texto fixo sem variável." }],
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita clausulas vazio — sempre precisa de ao menos 1 cláusula", () => {
    const resultado = IdentificacaoTemplateSchema.safeParse({
      variaveis: [],
      clausulas: [],
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita variável com nome inválido (não segue a regex de identificador)", () => {
    const resultado = IdentificacaoTemplateSchema.safeParse({
      variaveis: [{ nome: "nome com espaço", label: "Nome", tipo: "texto", obrigatorio: true }],
      clausulas: [{ titulo: "Objeto", conteudo: "texto" }],
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita cláusula sem título", () => {
    const resultado = IdentificacaoTemplateSchema.safeParse({
      variaveis: [],
      clausulas: [{ titulo: "", conteudo: "texto" }],
    });
    expect(resultado.success).toBe(false);
  });
});

describe("GerarDocumentoSchema — clienteId/empresaContratadaId opcionais", () => {
  it("aceita payload sem clienteId nem empresaContratadaId (ambos opcionais)", () => {
    const resultado = GerarDocumentoSchema.safeParse({
      templateId: "clx0000000000000000000000",
      titulo: "Doc",
      variaveis: {},
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita clienteId numérico positivo e empresaContratadaId cuid", () => {
    const resultado = GerarDocumentoSchema.safeParse({
      templateId: "clx0000000000000000000000",
      titulo: "Doc",
      variaveis: {},
      clienteId: 42,
      empresaContratadaId: "clx0000000000000000000001",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita clienteId não-positivo", () => {
    const resultado = GerarDocumentoSchema.safeParse({
      templateId: "clx0000000000000000000000",
      titulo: "Doc",
      variaveis: {},
      clienteId: 0,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita empresaContratadaId que não é cuid válido", () => {
    const resultado = GerarDocumentoSchema.safeParse({
      templateId: "clx0000000000000000000000",
      titulo: "Doc",
      variaveis: {},
      empresaContratadaId: "não-é-cuid",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("EmpresaContratadaSchema", () => {
  it("aceita CNPJ com 14 dígitos e dígitos verificadores válidos, com máscara (normalizado antes de validar)", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Teste LTDA",
      cnpj: "11.222.333/0001-81",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.cnpj).toBe("11222333000181");
    }
  });

  it("rejeita CNPJ com menos de 14 dígitos", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Teste LTDA",
      cnpj: "123456789",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita CNPJ com mais de 14 dígitos", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Teste LTDA",
      cnpj: "123456789000199999",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita CNPJ com 14 dígitos mas dígitos verificadores inválidos", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Teste LTDA",
      cnpj: "12345678000190",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const msgs = resultado.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes("dígitos verificadores"))).toBe(true);
    }
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Teste LTDA",
      cnpj: "11111111111111",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita razão social vazia", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "",
      cnpj: "11222333000181",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita payload só com os campos obrigatórios — todos os demais são opcionais", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Mínima LTDA",
      cnpj: "11222333000181",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita payload completo com endereço e representante legal", () => {
    const resultado = EmpresaContratadaSchema.safeParse({
      razaoSocial: "Empresa Completa LTDA",
      nomeFantasia: "Completa",
      cnpj: "11222333000181",
      logradouro: "Rua Teste",
      numero: "100",
      bairro: "Centro",
      municipio: "São Paulo",
      uf: "SP",
      cep: "01000-000",
      naturezaJuridica: "Sociedade Empresária Limitada",
      representanteLegalNome: "Fulano de Tal",
      representanteLegalCpf: "111.111.111-11",
      representanteLegalCargo: "Sócio-administrador",
    });
    expect(resultado.success).toBe(true);
  });
});

describe("AtualizarEmpresaContratadaSchema", () => {
  it("exige empresaId no formato cuid", () => {
    const resultado = AtualizarEmpresaContratadaSchema.safeParse({
      empresaId: "não-é-cuid",
      razaoSocial: "Nova Razão Social",
    });
    expect(resultado.success).toBe(false);
  });

  it("aceita update parcial — só empresaId + 1 campo", () => {
    const resultado = AtualizarEmpresaContratadaSchema.safeParse({
      empresaId: "clx0000000000000000000000",
      nomeFantasia: "Novo Nome Fantasia",
    });
    expect(resultado.success).toBe(true);
  });

  it("aceita só empresaId, sem nenhum campo de dado (partial permite tudo omitido)", () => {
    const resultado = AtualizarEmpresaContratadaSchema.safeParse({
      empresaId: "clx0000000000000000000000",
    });
    expect(resultado.success).toBe(true);
  });
});
