import { describe, expect, it } from "vitest";
import {
  TAMANHO_MAXIMO_EXTRATO,
  validarArquivosExtrato,
} from "@/components/Extratos/lib/upload-extrato";

function arquivo(
  name: string,
  size = 1024,
  lastModified = 1,
): { name: string; size: number; lastModified: number } {
  return { name, size, lastModified };
}

describe("validação de arquivos de extrato", () => {
  it("aceita PDF e DOCX sem depender do MIME informado pelo navegador", () => {
    const resultado = validarArquivosExtrato([
      arquivo("extrato.pdf"),
      arquivo("extrato.DOCX", 2048, 2),
    ]);

    expect(resultado.validos).toHaveLength(2);
    expect(resultado.erros).toEqual([]);
  });

  it("mantém arquivos válidos quando parte da seleção é inválida", () => {
    const resultado = validarArquivosExtrato([
      arquivo("valido.pdf"),
      arquivo("imagem.png", 100, 2),
      arquivo("vazio.docx", 0, 3),
      arquivo("grande.pdf", TAMANHO_MAXIMO_EXTRATO + 1, 4),
    ]);

    expect(resultado.validos.map((item) => item.name)).toEqual(["valido.pdf"]);
    expect(resultado.erros).toHaveLength(3);
  });

  it("rejeita duplicados já enfileirados e também no mesmo lote", () => {
    const duplicado = arquivo("extrato.pdf", 500, 10);
    const resultado = validarArquivosExtrato(
      [duplicado, duplicado, arquivo("novo.docx", 600, 11)],
      [duplicado],
    );

    expect(resultado.validos.map((item) => item.name)).toEqual(["novo.docx"]);
    expect(resultado.erros).toEqual([
      "extrato.pdf: arquivo duplicado.",
      "extrato.pdf: arquivo duplicado.",
    ]);
  });
});
