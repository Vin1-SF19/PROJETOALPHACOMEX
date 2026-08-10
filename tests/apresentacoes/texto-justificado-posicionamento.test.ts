import { describe, expect, it } from "vitest";
import { textoComponenteSchema } from "@/lib/validations/slide-componentes-basicos";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";

describe("Alpha Motion — texto justificado e fundo fixo", () => {
  it("aceita alinhamento justificado no componente e nos parágrafos ricos", () => {
    const texto = textoComponenteSchema.parse({
      id: "texto-1",
      tipo: "texto",
      texto: "Uma frase longa para justificar.",
      tag: "p",
      x: 0,
      y: 0,
      w: 400,
      h: 100,
      zIndex: 1,
      rotacao: 0,
      alinhamento: "justify",
      richText: { paragraphs: [{ alignment: "justify", runs: [{ text: "Uma frase longa para justificar." }] }] },
    });

    expect(texto.alinhamento).toBe("justify");
    expect(texto.richText?.paragraphs[0].alignment).toBe("justify");
  });

  it("posiciona qualquer fundo em tela cheia no player e na exportação", () => {
    const estilo = stylePosicaoAbsoluta({
      tipo: "fundoAnimado",
      x: 120,
      y: 80,
      w: 300,
      h: 200,
      zIndex: 0,
      rotacao: 30,
    });

    expect(estilo).toMatchObject({ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 });
    expect(estilo.transform).toBeUndefined();
  });
});
