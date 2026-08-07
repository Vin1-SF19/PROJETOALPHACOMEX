import { describe, expect, it } from "vitest";
import { COMPONENTES_REGISTRY } from "@/components/Apresentacoes/Editor/registry/componentes-registry";
import { coletarUrlsDeAssets, substituirUrlsDeAssets } from "@/lib/apresentacoes/percorrer-componentes";
import { ORCAMENTO_MAX_ASSETS_BYTES, OrcamentoAssetsExcedidoError, verificarOrcamentoAssets } from "@/lib/apresentacoes/embutir-assets";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

function criarImagem(url: string) {
  const base = COMPONENTES_REGISTRY.imagem.criarComponentePadrao(0, 0);
  return { ...base, url } as ComponenteSlide;
}

function criarCard(filhos: ComponenteSlide[]) {
  const base = COMPONENTES_REGISTRY.card.criarComponentePadrao(0, 0);
  return { ...base, filhos } as ComponenteSlide;
}

describe("percorrer-componentes (walker de assets)", () => {
  it("coleta URLs de imagem/video/audio no nível raiz, deduplicadas", () => {
    const video = { ...COMPONENTES_REGISTRY.video.criarComponentePadrao(0, 0), url: "https://blob/a.mp4" } as ComponenteSlide;
    const componentes = [criarImagem("https://blob/x.png"), criarImagem("https://blob/x.png"), video];
    expect(coletarUrlsDeAssets(componentes).sort()).toEqual(["https://blob/a.mp4", "https://blob/x.png"]);
  });

  it("entra em filhos de card/grid/container recursivamente", () => {
    const componentes = [criarCard([criarImagem("https://blob/dentro-do-card.png")])];
    expect(coletarUrlsDeAssets(componentes)).toEqual(["https://blob/dentro-do-card.png"]);
  });

  it("ignora componentes sem URL de asset (texto, botão, etc)", () => {
    const texto = COMPONENTES_REGISTRY.texto.criarComponentePadrao(0, 0) as ComponenteSlide;
    expect(coletarUrlsDeAssets([texto])).toEqual([]);
  });

  it("coleta modelo .glb (objeto3d.url) e textura opcional de globo (globo.texturaUrl)", () => {
    const objeto3d = { ...COMPONENTES_REGISTRY.objeto3d.criarComponentePadrao(0, 0), url: "https://blob/container.glb" } as ComponenteSlide;
    const globo = { ...COMPONENTES_REGISTRY.globo.criarComponentePadrao(0, 0), texturaUrl: "https://blob/terra.jpg" } as ComponenteSlide;
    expect(coletarUrlsDeAssets([objeto3d, globo]).sort()).toEqual(["https://blob/container.glb", "https://blob/terra.jpg"]);
  });

  it("não coleta nada de globo sem texturaUrl definida (campo opcional)", () => {
    const globoSemTextura = COMPONENTES_REGISTRY.globo.criarComponentePadrao(0, 0) as ComponenteSlide;
    expect(coletarUrlsDeAssets([globoSemTextura])).toEqual([]);
  });

  it("substitui URL de objeto3d e texturaUrl de globo pelos data: URI mapeados", () => {
    const objeto3d = { ...COMPONENTES_REGISTRY.objeto3d.criarComponentePadrao(0, 0), url: "https://blob/container.glb" } as ComponenteSlide;
    const globo = { ...COMPONENTES_REGISTRY.globo.criarComponentePadrao(0, 0), texturaUrl: "https://blob/terra.jpg" } as ComponenteSlide;
    const mapa = new Map([
      ["https://blob/container.glb", "data:model/gltf-binary;base64,AAA="],
      ["https://blob/terra.jpg", "data:image/jpeg;base64,BBB="],
    ]);
    const [objeto3dSubstituido, globoSubstituido] = substituirUrlsDeAssets([objeto3d, globo], mapa);
    expect(objeto3dSubstituido).toMatchObject({ url: "data:model/gltf-binary;base64,AAA=" });
    expect(globoSubstituido).toMatchObject({ texturaUrl: "data:image/jpeg;base64,BBB=" });
  });

  it("substitui URLs mapeadas sem mutar a árvore original", () => {
    const original = [criarCard([criarImagem("https://blob/x.png")])];
    const mapa = new Map([["https://blob/x.png", "data:image/png;base64,AAA="]]);
    const resultado = substituirUrlsDeAssets(original, mapa);

    expect((resultado[0] as { filhos: ComponenteSlide[] }).filhos[0]).toMatchObject({ url: "data:image/png;base64,AAA=" });
    expect((original[0] as { filhos: ComponenteSlide[] }).filhos[0]).toMatchObject({ url: "https://blob/x.png" });
  });

  it("mantém intacto o componente cuja URL não está no mapa", () => {
    const original = [criarImagem("https://blob/sem-mapa.png")];
    const resultado = substituirUrlsDeAssets(original, new Map());
    expect(resultado[0]).toMatchObject({ url: "https://blob/sem-mapa.png" });
  });
});

describe("verificarOrcamentoAssets", () => {
  const assets = [
    { url: "https://blob/a.png", tamanhoBytes: 10 * 1024 * 1024 },
    { url: "https://blob/b.mp4", tamanhoBytes: 10 * 1024 * 1024 },
  ];

  it("não lança quando a soma está dentro do limite", () => {
    expect(() => verificarOrcamentoAssets(["https://blob/a.png"], assets)).not.toThrow();
  });

  it("lança OrcamentoAssetsExcedidoError quando a soma ultrapassa o limite", () => {
    expect(() => verificarOrcamentoAssets(["https://blob/a.png", "https://blob/b.mp4"], assets, 15 * 1024 * 1024))
      .toThrow(OrcamentoAssetsExcedidoError);
  });

  it("trata URL referenciada sem registro conhecido como tamanho 0 (não bloqueia por falta de dado)", () => {
    expect(() => verificarOrcamentoAssets(["https://blob/desconhecida.png"], assets)).not.toThrow();
  });

  it("usa o orçamento padrão (25MB) quando nenhum limite é passado explicitamente", () => {
    const grandes = [{ url: "https://blob/grande.mp4", tamanhoBytes: ORCAMENTO_MAX_ASSETS_BYTES + 1 }];
    expect(() => verificarOrcamentoAssets(["https://blob/grande.mp4"], grandes)).toThrow(OrcamentoAssetsExcedidoError);
  });
});
