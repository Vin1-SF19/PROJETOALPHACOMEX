import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extrairEstiloDocxPdf } from "@/lib/gerador-documentos/docx-style";
import { gerarPdfDocumento } from "@/lib/gerador-documentos/pdf";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+XG8LAAAAAElFTkSuQmCC",
  "base64",
);

describe("estilo do DOCX no PDF", () => {
  it("extrai a imagem do cabeçalho, a fonte predominante e as margens do modelo", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", `<w:document><w:rFonts w:ascii="Palatino Linotype"/><w:rFonts w:ascii="Palatino Linotype"/><w:rFonts w:ascii="Arial"/><w:sz w:val="30"/><w:headerReference w:type="default" r:id="rId6"/><w:pgMar w:top="1840" w:right="1440" w:bottom="1140" w:left="1440"/></w:document>`);
    zip.file("word/styles.xml", `<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
    zip.file("word/_rels/document.xml.rels", `<Relationships><Relationship Id="rId6" Target="header1.xml"/></Relationships>`);
    zip.file("word/header1.xml", `<w:hdr><w:drawing><wp:extent cx="7600950" cy="1099851"/><a:blip r:embed="rId1"/></w:drawing></w:hdr>`);
    zip.file("word/_rels/header1.xml.rels", `<Relationships><Relationship Id="rId1" Target="media/image1.png"/></Relationships>`);
    zip.file("word/media/image1.png", PNG_1X1);

    const estilo = await extrairEstiloDocxPdf(await zip.generateAsync({ type: "nodebuffer" }));
    expect(estilo.fonteCorpo).toBe("Palatino Linotype");
    expect(estilo.tamanhoFonte).toBe(11);
    expect(estilo.tamanhoTitulo).toBe(15);
    expect(estilo.cabecalhoImagem).toBe(`data:image/png;base64,${PNG_1X1.toString("base64")}`);
    expect(estilo.cabecalhoLargura).toBeCloseTo(598.5);
    expect(estilo.margemSuperior).toBe(92);
    expect(estilo.margemEsquerda).toBe(72);
  });

  it("gera um PDF com a fonte compatível com Palatino", async () => {
    const pdf = await gerarPdfDocumento({
      titulo: "Contrato",
      clausulas: [{ titulo: "Objeto", conteudo: "Prestação de serviços" }],
      estiloDocx: { fonteCorpo: "Palatino Linotype", margemSuperior: 92, margemEsquerda: 72 },
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
