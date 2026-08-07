import type { AssetApresentacao } from "./assets";
import type { CanvasConfig } from "./canvas";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

/** Puro (sem API de browser) — também usado pela Route Handler de exportação HTML no servidor. */
export function nomeDownloadSeguro(nome: string): string {
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

const PREFIXO_ERRO_POR_STATUS: Record<number, string> = {
  401: "Sessão expirada — recarregue a página e faça login novamente. ",
  403: "Sem permissão para exportar esta apresentação. ",
  404: "Apresentação não encontrada (pode ter sido excluída). ",
  413: "",
  502: "",
};

/**
 * Busca o HTML autocontido de `GET /api/apresentacoes/[id]/exportar-html` como texto — usado
 * tanto pro download (`exportarApresentacaoComoHtml`) quanto pela prévia embutida no editor
 * (`ModalVisualizadorHtml.tsx`, que mostra o MESMO html num iframe em vez de baixar).
 */
export async function buscarHtmlApresentacao(apresentacaoId: string): Promise<string> {
  const resposta = await fetch(`/api/apresentacoes/${apresentacaoId}/exportar-html`);
  if (!resposta.ok) {
    const mensagem = await resposta.text().catch(() => "");
    const prefixo = PREFIXO_ERRO_POR_STATUS[resposta.status] ?? "";
    throw new Error(`${prefixo}${mensagem || `Falha ao exportar (HTTP ${resposta.status}).`}`);
  }
  return resposta.text();
}

/** Baixa o arquivo `.html` autocontido gerado por `GET /api/apresentacoes/[id]/exportar-html`. */
export async function exportarApresentacaoComoHtml(apresentacaoId: string, titulo: string): Promise<void> {
  const html = await buscarHtmlApresentacao(apresentacaoId);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  baixarUrl(url, `${nomeDownloadSeguro(titulo)}.html`);
  setTimeout(() => URL.revokeObjectURL(url), 0);
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
