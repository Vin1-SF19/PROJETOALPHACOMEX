import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { criarRelatorioExcel } from "@/components/Extratos/lib/exportar-excel";
import {
  prepararTransacaoParaRelatorio,
  simplificarDescricaoItau,
} from "@/components/Extratos/lib/relatorio-extrato";

describe("relatório de extratos", () => {
  const cabecalhoEsperado = [
    "MÊS REF.",
    "BANCO",
    "DATA",
    "DESCRIÇÃO",
    "VALOR (R$)",
    "JUSTIFICATIVA",
  ];

  function valoresCabecalho(row: ExcelJS.Row): ExcelJS.CellValue[] {
    return Array.from({ length: 6 }, (_, indice) => row.getCell(indice + 1).value);
  }

  it("remove a razão social da descrição do Itaú e mantém a nomenclatura", () => {
    expect(
      simplificarDescricaoItau(
        "PIX RECEBIDO - ALPHA IMPORTAÇÃO LTDA",
        "Alpha Importacao Ltda",
        "Itaú",
      ),
    ).toBe("PIX RECEBIDO");
  });

  it("não altera descrições de outros bancos ou do Itaú consolidado", () => {
    const descricao = "TED RECEBIDA - ALPHA IMPORTAÇÃO LTDA";

    expect(simplificarDescricaoItau(descricao, "Alpha Importação Ltda", "Bradesco")).toBe(descricao);
    expect(simplificarDescricaoItau(descricao, "Alpha Importação Ltda", "Itaú - Consolidado")).toBe(descricao);
  });

  it("preserva a descrição original quando remover a razão social apagaria todo o lançamento", () => {
    expect(simplificarDescricaoItau("ALPHA LTDA", "Alpha Ltda", "Itau")).toBe("ALPHA LTDA");
  });

  it("prepara a transação sem mutar os demais campos", () => {
    const original = {
      mesReferencia: "Julho/2026",
      nomeBanco: "Itaú",
      data: "10/07/2026",
      descricao: "PAGAMENTO PIX | ALPHA LTDA",
      valor: -150,
    };

    expect(prepararTransacaoParaRelatorio(original, "Alpha Ltda")).toEqual({
      ...original,
      descricao: "PAGAMENTO PIX",
    });
    expect(original.descricao).toBe("PAGAMENTO PIX | ALPHA LTDA");
  });

  it("repete o cabeçalho completo em cada troca de mês", async () => {
    const workbook = criarRelatorioExcel(
      [
        {
          mesReferencia: "Junho/2026",
          nomeBanco: "Bradesco",
          data: "05/06/2026",
          descricao: "TED",
          valor: 500,
        },
        {
          mesReferencia: "Julho/2026",
          nomeBanco: "Itaú",
          data: "01/07/2026",
          descricao: "PIX",
          valor: 100,
        },
        {
          mesReferencia: "Julho/2026",
          nomeBanco: "Itaú",
          data: "02/07/2026",
          descricao: "BOLETO",
          valor: -50,
        },
      ],
      "Alpha Ltda",
      "00.000.000/0001-00",
    );

    const worksheet = workbook.getWorksheet("Relatório Radar");
    expect(worksheet).toBeDefined();
    expect(valoresCabecalho(worksheet!.getRow(5))).toEqual(cabecalhoEsperado);
    expect(worksheet?.getCell("A6").value).toBe("JULHO/2026");
    expect(valoresCabecalho(worksheet!.getRow(8))).toEqual(cabecalhoEsperado);
    expect(worksheet?.getCell("A9").value).toBe("JUNHO/2026");
    expect(worksheet?.getCell("F7").border.bottom?.style).toBe("medium");
    expect(worksheet?.getCell("C8").border.top?.style).toBe("thick");
    expect(worksheet?.getCell("C9").border.top?.style).toBe("medium");
    expect(worksheet?.views[0]).toMatchObject({ state: "frozen", ySplit: 5 });

    const buffer = await workbook.xlsx.writeBuffer();
    const reaberto = new ExcelJS.Workbook();
    await reaberto.xlsx.load(buffer as ArrayBuffer);
    expect(reaberto.getWorksheet("Relatório Radar")?.rowCount).toBe(9);
    expect(valoresCabecalho(reaberto.getWorksheet("Relatório Radar")!.getRow(8))).toEqual(cabecalhoEsperado);
  });
});
