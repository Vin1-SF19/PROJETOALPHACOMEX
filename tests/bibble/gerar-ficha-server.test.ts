import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "node:path";
import { FichaAlphaPDF } from "@/components/GerarFicha";
import { gerarFichaServer } from "@/lib/bibble/gerar-ficha-server";

const mocks = vi.hoisted(() => ({
  receita: vi.fn(), radar: vi.fn(), consulta: vi.fn(), salvar: vi.fn(), upload: vi.fn(),
}));
vi.mock("@/lib/cnpj/receita-federal", () => ({ getReceitaData: mocks.receita }));
vi.mock("@/lib/prisma", () => ({ default: {
  consultas_radar: { findUnique: mocks.radar },
  consultaPreAnalise: { findUnique: mocks.consulta },
} }));
vi.mock("@/actions/PreAnalise", () => ({ upsertConsulta: mocks.salvar }));
vi.mock("@vercel/blob", () => ({ put: mocks.upload }));

async function lerPdf(buffer: Buffer) {
  const documento = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  try {
    const paginas = [];
    for (let i = 1; i <= documento.numPages; i++) {
      const pagina = await documento.getPage(i);
      const conteudo = await pagina.getTextContent();
      paginas.push({
        tamanho: pagina.view,
        texto: conteudo.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " "),
      });
    }
    return paginas;
  } finally {
    await documento.destroy();
  }
}

describe("Ficha de reunião gerada pelo iAlpha", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.salvar.mockResolvedValue({ success: true });
    mocks.upload.mockResolvedValue({ url: "https://example.test/ficha.pdf" });
  });

  it("envia para download o mesmo PDF A4 da pré-análise, com perguntas e confirmações", async () => {
    const rfb = {
      cnpj: "42.591.651/0001-43", razaoSocial: "EMPRESA DE TESTE", nomeFantasia: "TESTE",
      uf: "SP", dataConstituicao: "01/01/2020", capitalSocial: "100000",
      natureza_juridica: "Sociedade Empresária Limitada",
    };
    const radar = { submodalidade: "LIMITADA", situacao: "ATIVA", dataSituacao: "01/10/2026" };
    const empresaqui = { regimeEA: "LUCRO PRESUMIDO", qualificacao: "TESTE" };
    const extra = {
      nomeResponsavel: "Responsável Teste", dataSituacao: "22/10/2026", horaSituacao: "14:30",
      observacoes: "Observação legada que não deve ser impressa",
    };
    mocks.receita.mockResolvedValue(rfb);
    mocks.radar.mockResolvedValue({
      submodalidade: radar.submodalidade, situacao_radar: radar.situacao, data_situacao: radar.dataSituacao,
    });
    mocks.consulta.mockResolvedValue(empresaqui);

    const resultado = await gerarFichaServer({ cnpj: rfb.cnpj, userName: "Closer Teste", ...extra });
    expect(mocks.upload).toHaveBeenCalledOnce();
    const buffer: unknown = mocks.upload.mock.calls[0][1];
    expect(Buffer.isBuffer(buffer)).toBe(true);
    if (!Buffer.isBuffer(buffer)) throw new Error("Upload deve receber o PDF real");
    const paginas = await lerPdf(buffer);
    const referencia = await lerPdf(await renderToBuffer(FichaAlphaPDF({
      dados: { rfb: { dados: rfb }, radar, empresaqui: { dados: empresaqui }, extra },
      userLogado: "Closer Teste", finalidade: "pre-analise", logoPath: path.resolve("public/LogoTipo02.png"),
    })));

    expect(paginas).toEqual(referencia);
    expect(paginas).toHaveLength(1);
    expect(paginas[0].tamanho[2]).toBeCloseTo(595.28, 1);
    expect(paginas[0].tamanho[3]).toBeCloseTo(841.89, 1);
    expect(paginas[0].texto).toContain("Com a revisão do RADAR, quanto a empresa estima que poderia vender a mais, nos próximos seis meses?");
    expect(paginas[0].texto).toContain("A cada R$ 100.000,00 vendidos, qual o valor líquido costuma ficar para a empresa, tirando os custos?");
    expect(paginas[0].texto.match(/A CONFIRMAR \( \)/g)).toHaveLength(2);
    expect(paginas[0].texto).not.toContain("OBSERVAÇÕES");
    expect(paginas[0].texto).not.toContain(extra.observacoes.toUpperCase());
    expect(paginas[0].texto).toContain(rfb.cnpj);
    expect(paginas[0].texto).toContain("CLOSER: Closer Teste");
    expect(mocks.receita).toHaveBeenCalledWith("42591651000143");
    expect(resultado).toMatchObject({
      url: "https://example.test/ficha.pdf", cnpj: "42591651000143", razaoSocial: rfb.razaoSocial,
      fileName: expect.stringMatching(/^Ficha_.*\.pdf$/),
    });
    expect(mocks.salvar).toHaveBeenCalledWith(expect.objectContaining({
      rfb: { dados: rfb }, extra: expect.objectContaining({ observacoes: extra.observacoes }),
    }));
  });

  it("continua recusando CNPJ incompleto antes de consultar dados ou publicar PDF", async () => {
    await expect(gerarFichaServer({ cnpj: "123" })).rejects.toThrow("CNPJ inválido");
    expect(mocks.receita).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.salvar).not.toHaveBeenCalled();
  });
});
