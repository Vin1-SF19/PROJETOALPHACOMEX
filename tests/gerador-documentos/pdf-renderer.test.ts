import { describe, expect, it } from "vitest";
import { renderHtmlParaPdf } from "@/lib/gerador-documentos/pdf-renderer";

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
