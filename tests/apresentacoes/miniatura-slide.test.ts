import { describe, expect, it } from "vitest";
import { criarMiniaturaSlide } from "@/lib/apresentacoes/miniatura-slide";

describe("Alpha Motion - miniatura do primeiro slide", () => {
  it("mantem o fallback quando o slide esta vazio ou invalido", () => {
    expect(criarMiniaturaSlide({ componentes: [] })).toBeNull();
    expect(criarMiniaturaSlide({ componentes: [{ tipo: "texto" }] })).toBeNull();
  });

  it("gera uma previa com o canvas e os elementos visuais do slide", () => {
    const miniatura = criarMiniaturaSlide({
      canvas: { width: 1024, height: 768, backgroundColor: "#112233" },
      componentes: [
        {
          id: "titulo",
          tipo: "texto",
          texto: "Slide 1",
          tag: "h1",
          x: 80,
          y: 60,
          w: 600,
          h: 120,
          zIndex: 2,
          rotacao: 0,
        },
        {
          id: "imagem",
          tipo: "imagem",
          url: "https://example.com/capa.png",
          x: 120,
          y: 220,
          w: 500,
          h: 300,
          zIndex: 1,
          rotacao: 0,
        },
      ],
    });

    expect(miniatura?.canvas).toMatchObject({ width: 1024, height: 768, backgroundColor: "#112233" });
    expect(miniatura?.componentes.map((componente) => componente.tipo)).toEqual(["texto", "imagem"]);
  });

  it("preserva os componentes reais e normaliza a pilha do mini visualizador", () => {
    const miniatura = criarMiniaturaSlide({
      componentes: [
        {
          id: "video",
          tipo: "video",
          url: "https://example.com/video.mp4",
          x: 0,
          y: 0,
          w: 640,
          h: 360,
          zIndex: 0,
          rotacao: 0,
        },
        {
          id: "fundo",
          tipo: "fundoAnimado",
          estilo: "estelar",
          x: 0,
          y: 0,
          w: 1280,
          h: 720,
          zIndex: -1,
          rotacao: 0,
          corPrimaria: "#111827",
          corSecundaria: "#4f46e5",
        },
      ],
    });

    expect(miniatura?.componentes.map((componente) => componente.tipo)).toEqual(["video", "fundoAnimado"]);
    expect(miniatura?.componentes[0].zIndex).toBe(1);
    expect(miniatura?.componentes[1]).toMatchObject({
      tipo: "fundoAnimado",
      estilo: "estelar",
      corPrimaria: "#111827",
      corSecundaria: "#4f46e5",
      zIndex: 0,
    });
  });
});
