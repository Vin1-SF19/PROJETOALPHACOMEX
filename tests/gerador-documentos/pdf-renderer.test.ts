import { describe, expect, it } from "vitest";
import { analisarHtmlParaPdf, renderHtmlParaPdf } from "@/lib/gerador-documentos/pdf-renderer";

const PNG_1X1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XG8LAAAAAElFTkSuQmCC";

describe("renderHtmlParaPdf", () => {
  it("gera um Buffer PDF válido para HTML simples", async () => {
    const html = `<p>Este é um parágrafo de teste.</p><p>Segundo parágrafo.</p>`;
    const buffer = await renderHtmlParaPdf(html);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("gera PDF para HTML com tabela", async () => {
    const html = `
      <table>
        <tr><th>Nome</th><th>Valor</th></tr>
        <tr><td>Item A</td><td>100</td></tr>
        <tr><td>Item B</td><td>200</td></tr>
      </table>
      <p>Texto após a tabela.</p>
    `;
    const buffer = await renderHtmlParaPdf(html);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
    const documento = analisarHtmlParaPdf(html);
    expect(documento.conteudo[0]).toMatchObject({ tipo: "table", totalColunas: 2 });
  });

  it("preserva imagem embutida, título e tabela na ordem do HTML", async () => {
    const html = `<h1>Contrato</h1><img src="${PNG_1X1}" alt="Logotipo" width="80"><table><tr><th>Serviço</th><th colspan="2">Valores</th></tr><tr><td>Radar</td><td>100</td><td>Mensal</td></tr></table>`;
    const documento = analisarHtmlParaPdf(html);
    const buffer = await renderHtmlParaPdf(html);

    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(documento.conteudo.map((bloco) => bloco.tipo)).toEqual(["h1", "image", "table"]);
    expect(documento.conteudo[1]).toMatchObject({ tipo: "image", alt: "Logotipo", largura: 60 });
    expect(documento.conteudo[2]).toMatchObject({ tipo: "table", totalColunas: 3 });
  });

  it("separa cabeçalho e rodapé reconhecíveis para repetição por página", () => {
    const documento = analisarHtmlParaPdf(`<header><p>Alpha Comex</p></header><p>Corpo</p><footer><p>Confidencial</p></footer>`);
    expect(documento.cabecalho).toEqual([{ tipo: "p", texto: "Alpha Comex" }]);
    expect(documento.conteudo).toEqual([{ tipo: "p", texto: "Corpo" }]);
    expect(documento.rodape).toEqual([{ tipo: "p", texto: "Confidencial" }]);
  });

  it("ignora imagem remota apontando para rede privada", () => {
    const documento = analisarHtmlParaPdf(`<img src="http://127.0.0.1/segredo.png"><p>Texto seguro</p>`);
    expect(documento.conteudo).toEqual([{ tipo: "p", texto: "Texto seguro" }]);
  });

  it("gera PDF para HTML com lista", async () => {
    const html = `<ul><li>Item 1</li><li>Item 2</li></ul><p>Texto final.</p>`;
    const buffer = await renderHtmlParaPdf(html);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("lança erro para HTML vazio", async () => {
    await expect(renderHtmlParaPdf("")).rejects.toThrow();
    await expect(renderHtmlParaPdf("   ")).rejects.toThrow();
  });

  it("lança erro para HTML sem conteúdo textual", async () => {
    await expect(renderHtmlParaPdf("<div></div>")).rejects.toThrow();
  });

  it("gera PDF para HTML com entidades HTML", async () => {
    const html = `<p>Preço: R$ 1.000 &amp; impostos.</p>`;
    const buffer = await renderHtmlParaPdf(html);
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});
