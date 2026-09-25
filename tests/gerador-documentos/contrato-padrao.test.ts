import { describe, expect, it } from "vitest";
import { carregarContratoPadrao, VALORES_INICIAIS_CONTRATO_PADRAO } from "@/lib/gerador-documentos/contrato-padrao";
import { renderizarConteudo } from "@/lib/gerador-documentos/render";
import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";
import { criarHtmlDeClausulas } from "@/lib/gerador-documentos/clause-sync";
import { renderHtmlComVariaveis } from "@/lib/gerador-documentos/html-render";

describe("contrato padrão versionado", () => {
  it("lê todas as nove cláusulas e preserva cabeçalho, fonte e assinaturas do DOCX", async () => {
    const modelo = await carregarContratoPadrao();
    const texto = modelo.clausulas.map((c) => c.conteudo).join("\n");
    expect(modelo.clausulas).toHaveLength(10);
    expect(texto.length).toBeGreaterThan(12_000);
    expect(modelo.clausulas[0].titulo).toBe("Qualificação das partes");
    expect(modelo.clausulas.at(-1)?.titulo).toBe("Cláusula 9ª");
    expect(texto).toContain("Portaria Coana nº 72/2020");
    expect(texto).toContain("Testemunhas:");
    expect(texto).toContain("ALPHA COMEX BRASIL LTDA");
    expect(texto).toContain("{{contratante_nome}}");
    expect(texto).not.toContain("NOME DA EMPRESA");
    expect(modelo.estiloDocx.fonteCorpo).toBe("Palatino Linotype");
    expect(modelo.estiloDocx.cabecalhoImagem).toMatch(/^data:image\/png;base64,/);
  });

  it("gera PDF com os dados editáveis sem perder o texto fixo do contrato", async () => {
    const modelo = await carregarContratoPadrao();
    const valores = {
      ...VALORES_INICIAIS_CONTRATO_PADRAO,
      contratante_nome: "EMPRESA EXEMPLO LTDA",
      contratante_cnpj: "12.345.678/0001-90",
      contratante_endereco: "Rua Exemplo, nº 10, Centro, São Paulo, SP",
      contratante_email: "contato@exemplo.com",
      data_assinatura: "2026-09-25",
    };
    const clausulas = modelo.clausulas.map((c) => ({
      titulo: c.titulo,
      conteudo: renderizarConteudo(c.conteudo, modelo.variaveis, valores),
    }));
    expect(clausulas[0].conteudo).toContain("EMPRESA EXEMPLO LTDA");
    expect(clausulas[0].conteudo).toContain("ALPHA COMEX BRASIL LTDA");
    expect(clausulas.at(-1)?.conteudo).toContain("25/09/2026");
    expect(clausulas.map((c) => c.conteudo).join("\n")).not.toContain("{{");
    const html = renderHtmlComVariaveis(
      criarHtmlDeClausulas("Contrato", modelo.clausulas),
      modelo.variaveis,
      valores,
    );
    expect(html).toContain("EMPRESA EXEMPLO LTDA");
    expect(html).not.toContain("NOME DA EMPRESA");
    const pdf = await gerarPdfDocumento({ titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", clausulas, estiloDocx: modelo.estiloDocx });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(20_000);
  });
});
