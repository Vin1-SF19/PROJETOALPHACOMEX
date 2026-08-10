import { describe, expect, it } from "vitest";
import { COMPONENTES_REGISTRY } from "@/components/Apresentacoes/Editor/registry/componentes-registry";
import { adaptarComponentesAoCanvas, CANVAS_PADRAO, canvasConfigSchema } from "@/lib/apresentacoes/canvas";
import { detectarTipoAsset, nomeArquivoSeguro, validarArquivoAsset } from "@/lib/apresentacoes/assets";
import { componenteSchema, dadosSlideSchema } from "@/lib/validations/slide-componentes";
import { calcularEscalaApresentacao } from "@/lib/apresentacoes/viewport";
import { gerarOffsetsContorno } from "@/lib/apresentacoes/remover-fundo";

describe("Central Criativa do Alpha Presentation Studio", () => {
  it("aceita os formatos de asset suportados e bloqueia executáveis", () => {
    expect(detectarTipoAsset({ name: "logo.png", type: "image/png" })).toBe("IMAGEM");
    expect(detectarTipoAsset({ name: "abertura.mp4", type: "video/mp4" })).toBe("VIDEO");
    expect(detectarTipoAsset({ name: "trilha.mp3", type: "audio/mpeg" })).toBe("AUDIO");
    expect(detectarTipoAsset({ name: "container.glb", type: "application/octet-stream" })).toBe("MODELO_3D");
    expect(validarArquivoAsset({ name: "programa.exe", type: "application/x-msdownload", size: 1200 })).toContain("Formato não permitido");
  });

  it("impõe limite de 50 MB e normaliza o nome do arquivo", () => {
    expect(validarArquivoAsset({ name: "video.mp4", type: "video/mp4", size: 51 * 1024 * 1024 })).toContain("50 MB");
    expect(nomeArquivoSeguro("Logo Comércio Exterior 2026.png")).toBe("Logo_Comercio_Exterior_2026.png");
  });

  it("registra o componente de áudio com defaults válidos", () => {
    const audio = COMPONENTES_REGISTRY.audio.criarComponentePadrao(100, 200);
    expect(audio).toMatchObject({ tipo: "audio", x: 100, y: 200, autoplay: false, controles: true });
    expect(componenteSchema.safeParse(audio).success).toBe(true);
  });

  it("persiste canvas novo e mantém compatibilidade com slides antigos", () => {
    expect(dadosSlideSchema.safeParse({ componentes: [] }).success).toBe(true);
    expect(dadosSlideSchema.safeParse({ componentes: [], canvas: { width: 1080, height: 1920, backgroundColor: "#0f172a" } }).success).toBe(true);
    expect(canvasConfigSchema.safeParse({ width: 100, height: 720, backgroundColor: "#000000" }).success).toBe(false);
  });

  it("redimensiona proporcionalmente e centraliza ao mudar para vertical", () => {
    const texto = COMPONENTES_REGISTRY.texto.criarComponentePadrao(100, 100);
    const [resultado] = adaptarComponentesAoCanvas([texto], CANVAS_PADRAO, { width: 1080, height: 1920, backgroundColor: "#0f172a" });
    expect(resultado.x).toBeCloseTo(84.375);
    expect(resultado.y).toBeCloseTo(740.625);
    expect(resultado.w / resultado.h).toBeCloseTo(texto.w / texto.h);
  });

  it("enquadra formatos quadrado e vertical sem corte no player", () => {
    expect(calcularEscalaApresentacao(900, 700, 1080, 1080)).toBeCloseTo(700 / 1080);
    expect(calcularEscalaApresentacao(900, 700, 1080, 1920)).toBeCloseTo(700 / 1920);
  });

  it("gera offsets circulares limitados para o contorno da imagem", () => {
    const offsets = gerarOffsetsContorno(8);
    expect(offsets.length).toBeGreaterThanOrEqual(8);
    expect(new Set(offsets.map((offset) => `${offset.x}:${offset.y}`)).size).toBe(offsets.length);
    expect(offsets.every((offset) => Math.abs(offset.x) <= 8 && Math.abs(offset.y) <= 8)).toBe(true);
    expect(gerarOffsetsContorno(100).every((offset) => Math.abs(offset.x) <= 32 && Math.abs(offset.y) <= 32)).toBe(true);
  });
});
