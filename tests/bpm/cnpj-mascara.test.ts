import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cnpjEhValido, formatCNPJ, formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";
import { campoBpmEhCnpj, validarValoresCamposBpm } from "@/lib/bpm/campos-dinamicos";
import { BPM_CAMPO_TIPO, novaEmpresaCardSchema } from "@/lib/validations/bpm";

const ler = (arquivo: string) => readFileSync(resolve(process.cwd(), arquivo), "utf8");

const CNPJ_VALIDO = "11222333000181"; // 11.222.333/0001-81

describe("normalizarCNPJ", () => {
  it("retorna string vazia para valor vazio/nulo", () => {
    expect(normalizarCNPJ("")).toBe("");
    expect(normalizarCNPJ(null)).toBe("");
    expect(normalizarCNPJ(undefined)).toBe("");
  });

  it("remove pontuação, letras e espaços", () => {
    expect(normalizarCNPJ("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizarCNPJ(" 11 222 333 0001 81 ")).toBe("11222333000181");
    expect(normalizarCNPJ("AB11.222.333/0001-81CD")).toBe("11222333000181");
  });

  it("limita o resultado a 14 dígitos mesmo com excesso", () => {
    expect(normalizarCNPJ("112223330001819999")).toBe("11222333000181");
    expect(normalizarCNPJ("112223330001819999").length).toBe(14);
  });
});

describe("formatarCNPJProgressivo", () => {
  it("formata vazio como vazio", () => {
    expect(formatarCNPJProgressivo("")).toBe("");
  });

  it("formata progressivamente conforme os dígitos são digitados", () => {
    expect(formatarCNPJProgressivo("1")).toBe("1");
    expect(formatarCNPJProgressivo("11")).toBe("11");
    expect(formatarCNPJProgressivo("112")).toBe("11.2");
    expect(formatarCNPJProgressivo("112223")).toBe("11.222.3");
    expect(formatarCNPJProgressivo("1122233")).toBe("11.222.33");
    expect(formatarCNPJProgressivo("112223330")).toBe("11.222.333/0");
    expect(formatarCNPJProgressivo("1122233300")).toBe("11.222.333/00");
    expect(formatarCNPJProgressivo("11222333000")).toBe("11.222.333/000");
    expect(formatarCNPJProgressivo("112223330001")).toBe("11.222.333/0001");
    expect(formatarCNPJProgressivo("1122233300018")).toBe("11.222.333/0001-8");
    expect(formatarCNPJProgressivo(CNPJ_VALIDO)).toBe("11.222.333/0001-81");
  });

  it("aceita colagem já formatada e produz o mesmo resultado final", () => {
    expect(formatarCNPJProgressivo("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("aceita colagem suja com espaços e letras", () => {
    expect(formatarCNPJProgressivo(" 11 222 333 0001 81 ")).toBe("11.222.333/0001-81");
    expect(formatarCNPJProgressivo("cnpj:11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("ignora dígitos além do 14º", () => {
    expect(formatarCNPJProgressivo("112223330001819999")).toBe("11.222.333/0001-81");
  });
});

describe("formatCNPJ (apresentação read-only)", () => {
  it("retorna null para valores incompletos ou vazios", () => {
    expect(formatCNPJ("")).toBeNull();
    expect(formatCNPJ(null)).toBeNull();
    expect(formatCNPJ("112223330001")).toBeNull();
  });

  it("formata exatamente 14 dígitos no padrão final", () => {
    expect(formatCNPJ(CNPJ_VALIDO)).toBe("11.222.333/0001-81");
    expect(formatCNPJ("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("não mascara silenciosamente um valor com dígitos excedentes", () => {
    expect(formatCNPJ(`${CNPJ_VALIDO}9`)).toBeNull();
  });
});

describe("cnpjEhValido", () => {
  it("aceita um CNPJ com dígitos verificadores corretos", () => {
    expect(cnpjEhValido(CNPJ_VALIDO)).toBe(true);
    expect(cnpjEhValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(cnpjEhValido("11222333000182")).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(cnpjEhValido("11111111111111")).toBe(false);
  });

  it("rejeita tamanho diferente de 14 dígitos", () => {
    expect(cnpjEhValido("1122233300018")).toBe(false);
    expect(cnpjEhValido(`${CNPJ_VALIDO}9`)).toBe(false);
    expect(cnpjEhValido("")).toBe(false);
  });
});

describe("campoBpmEhCnpj (detecção estrita)", () => {
  it("reconhece o tipo dedicado 'cnpj'", () => {
    expect(campoBpmEhCnpj({ tipo: "cnpj", nome: "Qualquer nome" })).toBe(true);
  });

  it("reconhece fallback por nome canônico 'CNPJ' (trim/case-insensitive)", () => {
    expect(campoBpmEhCnpj({ tipo: "texto", nome: "CNPJ" })).toBe(true);
    expect(campoBpmEhCnpj({ tipo: "texto", nome: " cnpj " })).toBe(true);
    expect(campoBpmEhCnpj({ tipo: "texto", nome: "Cnpj" })).toBe(true);
  });

  it("não classifica nomes aproximados como CNPJ", () => {
    expect(campoBpmEhCnpj({ tipo: "texto", nome: "Cartão CNPJ" })).toBe(false);
    expect(campoBpmEhCnpj({ tipo: "texto", nome: "Contato CNPJ" })).toBe(false);
    expect(campoBpmEhCnpj({ tipo: "texto", nome: "CNPJ do parceiro" })).toBe(false);
  });
});

describe("validarValoresCamposBpm - tipo cnpj", () => {
  const campos = [{ id: "c1", nome: "CNPJ", tipo: "cnpj", opcoesJson: null }];

  it("aceita CNPJ válido e normaliza para 14 dígitos", () => {
    const resultado = validarValoresCamposBpm(campos, { c1: "11.222.333/0001-81" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.valores.c1).toBe(CNPJ_VALIDO);
  });

  it("rejeita CNPJ com dígito verificador inválido", () => {
    const resultado = validarValoresCamposBpm(campos, { c1: "11.222.333/0001-82" });
    expect(resultado.success).toBe(false);
  });

  it("aceita valor vazio (campo não obrigatório aqui)", () => {
    const resultado = validarValoresCamposBpm(campos, { c1: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.valores.c1).toBe("");
  });

  it("normaliza e valida campo legado cujo nome canônico é CNPJ", () => {
    const resultado = validarValoresCamposBpm(
      [{ id: "legado", nome: " Cnpj ", tipo: "texto", opcoesJson: null }],
      { legado: "11.222.333/0001-81" },
    );
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.valores.legado).toBe(CNPJ_VALIDO);
  });
});

describe("novaEmpresaCardSchema", () => {
  it("normaliza CNPJ sujo antes da fronteira de persistência", () => {
    const resultado = novaEmpresaCardSchema.safeParse({
      cnpj: " CNPJ: 11.222.333/0001-81 ",
      razaoSocial: "Empresa Teste",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cnpj).toBe(CNPJ_VALIDO);
  });

  it("rejeita CNPJ que não resulte em 14 dígitos", () => {
    const resultado = novaEmpresaCardSchema.safeParse({
      cnpj: "11.222.333/0001",
      razaoSocial: "Empresa Teste",
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita dígitos excedentes em vez de truncá-los no servidor", () => {
    const resultado = novaEmpresaCardSchema.safeParse({
      cnpj: `${CNPJ_VALIDO}9`,
      razaoSocial: "Empresa Teste",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("BPM_CAMPO_TIPO inclui cnpj", () => {
  it("expõe o tipo dedicado 'cnpj'", () => {
    expect(BPM_CAMPO_TIPO).toContain("cnpj");
  });
});

describe("Integração — wiring dos consumidores visuais", () => {
  it("CampoBpmInput aplica máscara progressiva de CNPJ", () => {
    const source = ler("src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx");
    expect(source).toContain("campoBpmEhCnpj(campo)");
    expect(source).toContain("formatarCNPJProgressivo(value)");
    expect(source).toContain("normalizarCNPJ(event.target.value)");
  });

  it("AdminPipelineClient oferece o tipo CNPJ no seletor", () => {
    const source = ler(
      "src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx",
    );
    expect(source).toContain('{ value: "cnpj", label: "CNPJ" }');
  });

  it("NovoCardModal usa o utilitário compartilhado (sem máscara local duplicada)", () => {
    const source = ler(
      "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx",
    );
    expect(source).toContain(
      'import { formatCNPJ, formatarCNPJProgressivo, normalizarCNPJ } from "@/lib/format-cnpj";',
    );
    expect(source).not.toContain("function formatarCnpjInput");
    expect(source).toContain("formatarCNPJProgressivo(novaEmpresa.cnpj)");
    expect(source).toContain("formatCNPJ(empresa.cnpj) ?? empresa.cnpj");
  });

  it("CardAbertoLayout formata o CNPJ do header", () => {
    const source = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
    expect(source).toContain("formatCNPJ(card.empresa.cnpj) ?? card.empresa.cnpj");
  });

  it("DadosEmpresaConteudo formata o CNPJ da gaveta 'Dados da empresa'", () => {
    const source = ler("src/app/PainelAlpha/AlphaCRM/CardModal/DadosEmpresaConteudo.tsx");
    expect(source).toContain("formatCNPJ(dados.empresa.cnpj) ?? dados.empresa.cnpj");
  });

  it("PerfilEmpresaModal formata o CNPJ no perfil global aberto pelo card", () => {
    const source = ler("src/components/PerfilEmpresaGlobal/PerfilEmpresaModal.tsx");
    expect(source).toContain("formatCNPJ(empresa.cnpj) ?? empresa.cnpj");
  });

  it("BuscarEmpresasBpm usa normalização compartilhada na busca", () => {
    const source = ler("src/actions/bpm/Cards.ts");
    expect(source).toContain("normalizarCNPJ(termoSeguro)");
    expect(source).toContain("cnpjNovaEmpresa = normalizarCNPJ(novaEmpresa.cnpj)");
  });
});
