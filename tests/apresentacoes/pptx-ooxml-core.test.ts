import { afterEach, describe, expect, it, vi } from "vitest";
import { resolverCorOoxml } from "@/lib/apresentacoes/pptx/color-resolver";
import { aplicarMatriz, matrizDoGrupo, transformarRetangulo } from "@/lib/apresentacoes/pptx/matriz-transformacao";
import { extrairTextBody, pilhaCssDaFonte, resolverFontesNoDocumento, textoTemConteudoVisual } from "@/lib/apresentacoes/pptx/texto";
import { lerFundo, type ContextoTema } from "@/lib/apresentacoes/pptx/tema";
import { resolverCaminhoRelativo } from "@/lib/apresentacoes/pptx/xml-utils";
import { mapearSlideExtraido } from "@/lib/apresentacoes/pptx/mapear";

const colorContext = {
  scheme: { lt1: "#FFFFFF", accent1: "#336699" },
  colorMap: { bg1: "lt1", tx1: "accent1" },
};

afterEach(() => vi.unstubAllGlobals());

describe("ColorResolver OOXML", () => {
  it("resolve schemeClr pelo clrMap e aplica alpha/luminosidade", () => {
    const color = resolverCorOoxml({
      "a:schemeClr": { "@_val": "tx1", "a:lumMod": { "@_val": "50000" }, "a:alpha": { "@_val": "50000" } },
    }, colorContext);
    expect(color).toMatchObject({ source: "scheme", alpha: 0.5 });
    expect(color?.hex).not.toBe("#336699");
    expect(color?.css).toMatch(/^rgba\(/);
  });

  it("suporta sysClr/lastClr, scrgbClr, prstClr e hslClr", () => {
    expect(resolverCorOoxml({ "a:sysClr": { "@_val": "window", "@_lastClr": "FEFEFE" } }, colorContext)?.hex).toBe("#FEFEFE");
    expect(resolverCorOoxml({ "a:scrgbClr": { "@_r": "100000", "@_g": "0", "@_b": "0" } }, colorContext)?.hex).toBe("#FF0000");
    expect(resolverCorOoxml({ "a:prstClr": { "@_val": "orange" } }, colorContext)?.hex).toBe("#FFA500");
    expect(resolverCorOoxml({ "a:hslClr": { "@_hue": "7200000", "@_sat": "100000", "@_lum": "50000" } }, colorContext)?.hex).toBe("#00FF00");
  });
});

describe("matrizes de grupos", () => {
  it("preserva o centro do filho quando o grupo é escalado e rotacionado", () => {
    const matrix = matrizDoGrupo({
      off: { x: 100, y: 200 }, ext: { cx: 200, cy: 100 },
      chOff: { x: 0, y: 0 }, chExt: { cx: 100, cy: 100 }, rotation: 90,
    });
    expect(aplicarMatriz(matrix, { x: 20, y: 25 })).toMatchObject({ x: 225, y: 190 });
    const rectangle = transformarRetangulo(matrix, { x: 10, y: 20 }, { cx: 20, cy: 10 });
    expect(rectangle.off.x).toBeCloseTo(205);
    expect(rectangle.off.y).toBeCloseTo(185);
    expect(rectangle.ext).toMatchObject({ cx: 40, cy: 10 });
    expect(rectangle.rotation).toBeCloseTo(90);
  });

  it("decompõe flip sem deslocar o bounding box", () => {
    const matrix = matrizDoGrupo({
      off: { x: 0, y: 0 }, ext: { cx: 100, cy: 100 },
      chOff: { x: 0, y: 0 }, chExt: { cx: 100, cy: 100 }, flipH: true,
    });
    const rectangle = transformarRetangulo(matrix, { x: 10, y: 20 }, { cx: 30, cy: 40 });
    expect(rectangle.off).toMatchObject({ x: 60, y: 20 });
    expect(rectangle.flipV).toBe(true);
  });
});

describe("texto PPTX", () => {
  it("mantém runs distintos e herda estilo do placeholder sem sobrescrever estilo direto", () => {
    const inherited = {
      "a:lstStyle": { "a:lvl1pPr": { "@_algn": "ctr", "a:defRPr": { "@_sz": "3200", "a:latin": { "@_typeface": "Open Sans" } } } },
    };
    const body = extrairTextBody({
      "a:bodyPr": { "@_anchor": "ctr" },
      "a:p": [{
        "a:pPr": { "@_lvl": "0" },
        "a:r": [
          { "a:rPr": { "@_b": "1" }, "a:t": "Preto " },
          { "a:rPr": { "a:solidFill": { "a:srgbClr": { "@_val": "FF0000" } } }, "a:t": "vermelho" },
        ],
      }],
    }, colorContext, [inherited]);
    expect(body?.paragraphs[0].runs).toHaveLength(2);
    expect(body?.paragraphs[0].runs[0].style).toMatchObject({ fontFamily: "Open Sans", fontSizePt: 32, bold: true });
    expect(body?.paragraphs[0].runs[1].style.color?.hex).toBe("#FF0000");
  });

  it("classifica whitespace/NBSP como ausência deliberada de conteúdo visual", () => {
    const body = extrairTextBody({ "a:bodyPr": {}, "a:p": [{ "a:r": [{ "a:t": " \u00A0 " }] }] }, colorContext);
    expect(body && textoTemConteudoVisual(body)).toBe(false);
  });

  it("preserva a ordem intercalada de runs e quebras de linha", () => {
    const body = extrairTextBody({
      "a:bodyPr": {},
      "a:p": [{ "a:r": [{ "a:t": "A" }, { "a:t": "B" }], "a:br": [{}] }],
    }, colorContext, [], "<p:txBody><a:p><a:r><a:t>A</a:t></a:r><a:br/><a:r><a:t>B</a:t></a:r></a:p></p:txBody>");
    expect(body?.paragraphs[0].runs.map((run) => run.text)).toEqual(["A", "\n", "B"]);
  });

  it("expõe pilha CSS explícita para fallback de fonte", () => {
    expect(pilhaCssDaFonte("SF Pro Display Heavy")).toContain("Inter");
  });

  it("carrega explicitamente @font-face antes de decidir que a fonte está ausente", async () => {
    const disponiveis = new Set<string>();
    const load = vi.fn(async (font: string) => {
      disponiveis.add(font);
      return [];
    });
    const check = vi.fn((font: string) => disponiveis.has(font));
    vi.stubGlobal("document", { fonts: { ready: Promise.resolve(), load, check } });

    const [fonte] = await resolverFontesNoDocumento(["Montserrat"]);
    expect(load).toHaveBeenCalledWith('16px "Montserrat"', "Alpha Motion");
    expect(fonte).toEqual({ original: "Montserrat", substitute: "Montserrat", available: true });
  });
});

describe("background e segurança", () => {
  const themeContext = {
    esquemaCores: colorContext.scheme,
    mapaCores: colorContext.colorMap,
  } as unknown as ContextoTema;

  it("preserva gradiente de background e resolve seus stops", () => {
    const background = lerFundo({
      "p:bgPr": { "a:gradFill": { "a:gsLst": { "a:gs": [
        { "@_pos": "0", "a:schemeClr": { "@_val": "bg1" } },
        { "@_pos": "100000", "a:srgbClr": { "@_val": "000000" } },
      ] }, "a:lin": { "@_ang": "0" } } },
    }, themeContext, "slide");
    expect(background?.tipoCor).toBe("#FFFFFF");
    expect(background?.gradientCss).toContain("linear-gradient(90deg");
    expect(background?.gradient?.stops).toHaveLength(2);
  });

  it("bloqueia relacionamentos externos e traversal acima da raiz", () => {
    expect(() => resolverCaminhoRelativo("ppt/slides/slide1.xml", "https://example.com/a.png")).toThrow(/externo/i);
    expect(() => resolverCaminhoRelativo("ppt.xml", "../../evil.xml")).toThrow(/raiz/i);
  });
});

describe("adaptador Alpha Motion", () => {
  it("usa stretch exato e preserva crop/flip/origem da imagem", async () => {
    const [component] = await mapearSlideExtraido({
      backgroundColor: "#FFFFFF",
      formas: [{
        tipo: "imagem", x: 1, y: 2, w: 300, h: 200, rotacao: 15,
        bytes: new Uint8Array([1]), mimeType: "image/png", nomeArquivo: "a.png",
        crop: { left: 0.1, top: 0.2, right: 0.1, bottom: 0 }, flipH: true,
        source: { slide: 1, xmlPath: "ppt/slides/slide1.xml", level: "slide", shapeId: "7" },
      }],
    }, async () => "data:image/png;base64,AQ==");
    expect(component).toMatchObject({ tipo: "imagem", objectFit: "fill", flipH: true, crop: { left: 0.1 }, pptxOrigem: { shapeId: "7" } });
  });
});
