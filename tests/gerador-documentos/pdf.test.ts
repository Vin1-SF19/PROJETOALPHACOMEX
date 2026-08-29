import { describe, expect, it } from "vitest";
import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";

describe("gerarPdfDocumento", () => {
  it("gera um Buffer não-vazio para um documento com 1 cláusula", async () => {
    const buffer = await gerarPdfDocumento({
      titulo: "Contrato de Teste",
      clausulas: [{ titulo: "Objeto", conteudo: "O presente contrato tem como objeto a prestação de serviços." }],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
    // %PDF é a assinatura de magic bytes de todo PDF válido.
    expect(buffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("gera Buffer para múltiplas cláusulas", async () => {
    const buffer = await gerarPdfDocumento({
      titulo: "Contrato com Várias Cláusulas",
      clausulas: [
        { titulo: "Objeto", conteudo: "Texto da primeira cláusula." },
        { titulo: "Prazo", conteudo: "Texto da segunda cláusula." },
        { titulo: "Valor", conteudo: "Texto da terceira cláusula." },
      ],
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("não lança erro com conteúdo de cláusula vazio", async () => {
    await expect(
      gerarPdfDocumento({
        titulo: "Contrato Vazio",
        clausulas: [{ titulo: "Cláusula sem texto", conteudo: "" }],
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("não lança erro com conteúdo de cláusula muito longo", async () => {
    const conteudoLongo = "Texto repetido para simular cláusula extensa. ".repeat(500);

    await expect(
      gerarPdfDocumento({
        titulo: "Contrato Extenso",
        clausulas: [{ titulo: "Cláusula longa", conteudo: conteudoLongo }],
      }),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it("não lança erro com lista de cláusulas vazia", async () => {
    await expect(gerarPdfDocumento({ titulo: "Sem cláusulas", clausulas: [] })).resolves.toBeInstanceOf(Buffer);
  });
});
