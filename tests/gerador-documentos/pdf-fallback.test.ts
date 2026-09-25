import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ renderToBuffer: vi.fn() }));

vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer: mocks.renderToBuffer };
});

import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";

describe("fallback da fonte do DOCX", () => {
  it("repete a geração com fonte interna e conserva o cabeçalho quando P052 falha", async () => {
    mocks.renderToBuffer
      .mockRejectedValueOnce(new Error("Fonte não disponível na função"))
      .mockResolvedValueOnce(Buffer.from("%PDF-fallback"));

    const pdf = await gerarPdfDocumento({
      titulo: "Contrato",
      clausulas: [{ titulo: "Objeto", conteudo: "Texto" }],
      estiloDocx: { fonteCorpo: "Palatino Linotype", cabecalhoImagem: "data:image/png;base64,abc" },
    });

    expect(pdf.toString()).toBe("%PDF-fallback");
    expect(mocks.renderToBuffer).toHaveBeenCalledTimes(2);
    expect(mocks.renderToBuffer.mock.calls[1][0].props.estiloDocx).toMatchObject({
      fonteCorpo: "Times New Roman",
      cabecalhoImagem: "data:image/png;base64,abc",
    });
  });
});
