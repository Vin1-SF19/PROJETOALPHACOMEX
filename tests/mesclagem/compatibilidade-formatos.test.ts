import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { inspecionarArquivoMesclagem } from "@/lib/mesclagem/processamento";
import { lerLinhasEntradaXlsx } from "@/lib/mesclagem/input-adapter";

describe("Compatibilidade de formatos de planilha", () => {
  it("lê o formato XLS legado e preserva cabeçalho e dados", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["CNPJ", "DDD1", "FONE1"],
      ["12.345.678/0001-90", "11", "999999999"],
    ]), "Template");
    const bytes = XLSX.write(workbook, { bookType: "xls", type: "array" });
    const arquivo = new File([bytes], "template-antigo.xls");

    const inspecao = await inspecionarArquivoMesclagem(arquivo);
    expect(inspecao.abas[0].colunas.map((coluna) => coluna.nome)).toEqual(["CNPJ", "DDD1", "FONE1"]);
    const linhas = await lerLinhasEntradaXlsx(await arquivo.arrayBuffer(), "Template");
    expect(linhas[0].valores).toMatchObject({ 1: "12.345.678/0001-90", 2: "11", 3: "999999999" });
  });
});
