import { describe, expect, it } from "vitest";
import {
  LIMITE_ARQUIVO_MESCLAGEM_BYTES,
  LIMITE_MULTIPART_ARQUIVO_MESCLAGEM_BYTES,
  LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES,
  lerRegistrosDelimitados,
  parseCsvTexto,
  validarExtensaoMesclagem,
  validarTamanhoArquivo,
} from "@/lib/mesclagem/parsing";

describe("Parsing", () => {
  it("valida extensões permitidas", () => {
    expect(validarExtensaoMesclagem("planilha.xlsx")).toBe(".xlsx");
    expect(validarExtensaoMesclagem("planilha.csv")).toBe(".csv");
    expect(validarExtensaoMesclagem("planilha.xlsm")).toBe(".xlsm");
    expect(validarExtensaoMesclagem("planilha.tsv")).toBe(".tsv");
    expect(validarExtensaoMesclagem("planilha.xls")).toBe(".xls");
    expect(validarExtensaoMesclagem("planilha.xlsb")).toBe(".xlsb");
    expect(validarExtensaoMesclagem("planilha.ods")).toBe(".ods");
    expect(() => validarExtensaoMesclagem("planilha.docx")).toThrow();
  });

  it("aceita até 80 MB e rejeita somente o que exceder esse limite", () => {
    expect(() => validarTamanhoArquivo({ size: 0 }))
      .toThrow(expect.objectContaining({ code: "EMPTY_FILE" }));
    expect(() => validarTamanhoArquivo({ size: LIMITE_ARQUIVO_MESCLAGEM_BYTES + 1 }))
      .toThrow(expect.objectContaining({ code: "FILE_TOO_LARGE", status: 413 }));
    expect(() => validarTamanhoArquivo({ size: LIMITE_ARQUIVO_MESCLAGEM_BYTES })).not.toThrow();
    expect(LIMITE_ARQUIVO_MESCLAGEM_BYTES).toBe(80 * 1024 * 1024);
    expect(LIMITE_MULTIPART_ARQUIVO_MESCLAGEM_BYTES).toBe(82 * 1024 * 1024);
    expect(LIMITE_MULTIPART_DUPLO_MESCLAGEM_BYTES).toBe(164 * 1024 * 1024);
  });

  it("inspeciona CSV com separador ponto-e-vírgula", () => {
    const texto = "CNPJ;Razão Social\n12.345.678/0001-95;Empresa LTDA";
    const resultado = parseCsvTexto(texto, "planilha.csv", ".csv");
    expect(resultado.abas).toHaveLength(1);
    expect(resultado.abas[0].colunas).toHaveLength(2);
    expect(resultado.abas[0].totalLinhas).toBe(1);
  });

  it("inspeciona CSV com aspas e vírgulas", () => {
    const texto = 'CNPJ;Razão Social\n"12.345.678/0001-95";"Empresa, LTDA"';
    const resultado = parseCsvTexto(texto, "planilha.csv", ".csv");
    expect(resultado.abas[0].totalLinhas).toBe(1);
  });

  it("não transforma vírgula interna em coluna quando o CSV usa ponto-e-vírgula", () => {
    const resultado = parseCsvTexto("CNPJ;Razão Social\n12.345.678/0001-95;Empresa, LTDA", "planilha.csv", ".csv");
    expect(resultado.abas[0].colunas).toHaveLength(2);
  });

  it("rejeita cabeçalhos equivalentes após normalização", () => {
    expect(() => parseCsvTexto("Razão Social;razao-social\nA;B", "planilha.csv", ".csv")).toThrow(/duplicado/i);
  });

  it("lê quebra de linha e aspas escapadas dentro de campo CSV", () => {
    const registros = lerRegistrosDelimitados(
      'CNPJ;Razão Social;Observação\r\n12.345.678/0001-95;"Empresa ""Alpha""";"linha 1\r\nlinha 2"',
      ".csv",
    );
    expect(registros).toEqual([
      ["CNPJ", "Razão Social", "Observação"],
      ["12.345.678/0001-95", 'Empresa "Alpha"', "linha 1\nlinha 2"],
    ]);
    expect(parseCsvTexto(
      'CNPJ;Razão Social;Observação\n12.345.678/0001-95;Empresa;"linha 1\nlinha 2"',
      "planilha.csv",
      ".csv",
    ).abas[0].totalLinhas).toBe(1);
  });

  it("rejeita aspas não fechadas", () => {
    expect(() => lerRegistrosDelimitados('CNPJ;Nome\n1;"Empresa', ".csv"))
      .toThrow(/aspas não fechadas/i);
  });

  it("rejeita 201 colunas já na inspeção", () => {
    const cabecalho = Array.from({ length: 201 }, (_, indice) => `Coluna ${indice + 1}`).join(";");
    const linha = Array.from({ length: 201 }, () => "x").join(";");
    expect(() => parseCsvTexto(`${cabecalho}\n${linha}`, "grande.csv", ".csv"))
      .toThrow(/limite de 200 colunas/i);
  });

  it("aborta incrementalmente na 201ª coluna sem processar o restante inválido", () => {
    const prefixo = `${Array.from({ length: 201 }, () => "x").join(";")};`;
    try {
      lerRegistrosDelimitados(`${prefixo}\n"aspas não fechadas`, ".csv");
      throw new Error("O parser deveria rejeitar o orçamento estrutural");
    } catch (error) {
      expect(error).toMatchObject({ code: "TOO_MANY_COLUMNS", status: 413 });
    }
  });

  it("interrompe incrementalmente ao exceder 50 mil linhas de dados", () => {
    const texto = `CNPJ\n${Array.from({ length: 50_001 }, () => "12345678000195").join("\n")}`;
    expect(() => lerRegistrosDelimitados(texto, ".csv"))
      .toThrow(expect.objectContaining({ code: "TOO_MANY_ROWS", status: 413 }));
  });
});
