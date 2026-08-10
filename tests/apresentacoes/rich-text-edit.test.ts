import { describe, expect, it } from "vitest";
import {
  aplicarEstiloNoIntervaloRichText,
  atualizarRunRichText,
  criarRichTextDoTexto,
  sincronizarRichTextComTexto,
  textoPlanoDoRichText,
  type RichTextAlpha,
} from "@/lib/apresentacoes/rich-text-edit";

const RICH_TEXT: RichTextAlpha = {
  paragraphs: [
    {
      runs: [
        { text: "Texto ", fontFamily: "Arial", fontSize: 20 },
        { text: "forte", fontFamily: "Arial", fontSize: 20, bold: true },
      ],
    },
    { runs: [{ text: "Segunda linha", italic: true }] },
  ],
};

describe("edição de rich text do Alpha Motion", () => {
  it("aplica cor e fonte somente ao trecho selecionado", () => {
    const original = criarRichTextDoTexto("Alpha Motion", { color: "#ffffff", fontFamily: "Inter" });
    const resultado = aplicarEstiloNoIntervaloRichText(original, 6, 12, { color: "#ff0000", fontFamily: "Oswald", bold: true });

    expect(resultado.paragraphs[0].runs).toEqual([
      expect.objectContaining({ text: "Alpha ", color: "#ffffff", fontFamily: "Inter" }),
      expect.objectContaining({ text: "Motion", color: "#ff0000", fontFamily: "Oswald", bold: true }),
    ]);
  });

  it("aplica estilo através de parágrafos sem perder a quebra", () => {
    const original = criarRichTextDoTexto("Um\nDois", { color: "#ffffff" });
    const resultado = aplicarEstiloNoIntervaloRichText(original, 1, 5, { italic: true });
    expect(textoPlanoDoRichText(resultado)).toBe("Um\nDois");
    expect(resultado.paragraphs[0].runs.at(-1)).toMatchObject({ text: "m", italic: true });
    expect(resultado.paragraphs[1].runs[0]).toMatchObject({ text: "Do", italic: true });
  });

  it("mantém o negrito de um trecho inalterado ao editar o texto completo", () => {
    const resultado = sincronizarRichTextComTexto(RICH_TEXT, "Novo Texto forte\nSegunda linha");

    expect(textoPlanoDoRichText(resultado)).toBe("Novo Texto forte\nSegunda linha");
    expect(resultado.paragraphs[0].runs.some((run) => run.text.includes("forte") && run.bold)).toBe(true);
    expect(resultado.paragraphs[1].runs[0].italic).toBe(true);
  });

  it("permite editar e formatar um run individual sem juntar os parágrafos", () => {
    const resultado = atualizarRunRichText(RICH_TEXT, 0, 1, { text: "destacado", bold: false });

    expect(textoPlanoDoRichText(resultado)).toBe("Texto destacado\nSegunda linha");
    expect(resultado.paragraphs[0].runs[1]).toMatchObject({ text: "destacado", bold: false });
  });

  it("preserva uma estrutura editável ao adicionar e remover parágrafos", () => {
    const comTerceiro = sincronizarRichTextComTexto(RICH_TEXT, "Primeiro\nSegundo\nTerceiro");
    const apenasUm = sincronizarRichTextComTexto(comTerceiro, "Único");

    expect(comTerceiro.paragraphs).toHaveLength(3);
    expect(textoPlanoDoRichText(comTerceiro)).toBe("Primeiro\nSegundo\nTerceiro");
    expect(apenasUm.paragraphs).toHaveLength(1);
    expect(textoPlanoDoRichText(apenasUm)).toBe("Único");
  });

  it("preserva o estilo depois de caracteres Unicode compostos", () => {
    const richText: RichTextAlpha = {
      paragraphs: [{
        runs: [
          { text: "Olá 😀 ", bold: false },
          { text: "mundo", bold: true },
        ],
      }],
    };

    const resultado = sincronizarRichTextComTexto(richText, "Olá 😀 novo mundo");

    expect(textoPlanoDoRichText(resultado)).toBe("Olá 😀 novo mundo");
    expect(resultado.paragraphs[0].runs.some((run) => run.text.endsWith("mundo") && run.bold)).toBe(true);
  });
});
