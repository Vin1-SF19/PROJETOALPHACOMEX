import type { AssetApresentacao } from "./assets";
import type { CanvasConfig } from "./canvas";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

function nomeDownloadSeguro(nome: string): string {
  return nome.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "apresentacao";
}

function baixarUrl(url: string, nome: string) {
  const link = document.createElement("a");
  link.download = nome;
  link.href = url;
  link.click();
}

export async function exportarCanvasComoPng(titulo: string, escala = 2): Promise<void> {
  const elemento = document.getElementById("alpha-presentation-canvas");
  if (!(elemento instanceof HTMLElement)) throw new Error("Canvas da apresentação não encontrado.");

  const { toPng } = await import("html-to-image");
  const url = await toPng(elemento, {
    cacheBust: true,
    pixelRatio: escala,
    backgroundColor: getComputedStyle(elemento).backgroundColor,
    width: elemento.offsetWidth,
    height: elemento.offsetHeight,
    style: { transform: "none", transformOrigin: "top left" },
    filter: (node) => !(node instanceof HTMLElement) || node.dataset.editorOnly !== "true",
  });
  baixarUrl(url, `${nomeDownloadSeguro(titulo)}-${escala}x.png`);
}

interface ExportacaoJsonInput {
  titulo: string;
  canvas: CanvasConfig;
  componentes: ComponenteSlide[];
  assets: AssetApresentacao[];
  temaId: string | null;
}

export function exportarSlideComoJson(input: ExportacaoJsonInput): void {
  const pacote = {
    schema: "alpha-presentation-slide",
    version: 1,
    exportedAt: new Date().toISOString(),
    presentation: { title: input.titulo, themeId: input.temaId },
    slide: { canvas: input.canvas, componentes: input.componentes },
    assets: input.assets.map(({ id, tipo, url, nomeOriginal, tamanhoBytes }) => ({ id, tipo, url, nomeOriginal, tamanhoBytes })),
  };
  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  baixarUrl(url, `${nomeDownloadSeguro(input.titulo)}.alpha-slide.json`);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
