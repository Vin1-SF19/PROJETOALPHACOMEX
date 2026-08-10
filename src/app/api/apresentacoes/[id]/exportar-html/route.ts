import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { checarOwnershipApresentacao } from "@/lib/apresentacoes/ownership";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { embutirAssetsNosSlides, OrcamentoAssetsExcedidoError } from "@/lib/apresentacoes/embutir-assets";
import { nomeDownloadSeguro } from "@/lib/apresentacoes/exportacao";
import { PLAYER_JS, PLAYER_CSS } from "@/generated/apresentacoes-player-bundle";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Escapa texto pra uso seguro dentro de conteúdo de tag HTML (ex: `<title>`) — nunca dentro de atributo. */
function escaparTextoHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Exportação HTML autocontida. `embutirAssetsNosSlides` cobre todos os tipos de asset
 * (imagem/video/audio/objeto3d/.glb/textura de globo — mesmo walker, mesma pré-checagem de
 * orçamento de bytes) e o Container Alpha aparece fechado até o 1º gesto do usuário
 * (`PlayerStandalone.tsx`).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autenticado", { status: 401 });

  const userId = Number(session.user.id);
  const { id } = await context.params;
  const ownershipOk = await checarOwnershipApresentacao(id, userId, session.user.role);
  if (!ownershipOk) return new Response("Sem permissão", { status: 403 });

  const apresentacao = await db.apresentacao.findUnique({
    where: { id },
    select: {
      titulo: true,
      tema: { select: { corPrimaria: true, corSecundaria: true, corAccent: true } },
      slides: {
        orderBy: { ordem: "asc" },
        select: { id: true, ordem: true, transicaoEntrada: true, dadosJson: true },
      },
      assets: { select: { url: true, tamanhoBytes: true } },
    },
  });
  if (!apresentacao) return new Response("Apresentação não encontrada", { status: 404 });

  const slidesBase = apresentacao.slides.map((slide) => ({
    id: slide.id,
    ordem: slide.ordem,
    transicaoEntrada: slide.transicaoEntrada,
    componentes: (slide.dadosJson as { componentes?: ComponenteSlide[] } | null)?.componentes ?? [],
    canvas: obterCanvasSeguro((slide.dadosJson as { canvas?: CanvasConfig } | null)?.canvas),
    animacaoConfig: (slide.dadosJson as { animacaoConfig?: SlideAnimationConfig } | null)?.animacaoConfig ?? null,
  }));

  let slidesComAssets: typeof slidesBase;
  try {
    slidesComAssets = await embutirAssetsNosSlides(slidesBase, apresentacao.assets);
  } catch (erro) {
    if (erro instanceof OrcamentoAssetsExcedidoError) {
      return new Response(erro.message, { status: 413 });
    }
    console.error("[exportar-html] falha ao embutir assets", { apresentacaoId: id, erro });
    return new Response("Falha ao preparar os arquivos da apresentação para exportação.", { status: 502 });
  }

  const dados = {
    titulo: apresentacao.titulo,
    tema: apresentacao.tema,
    slides: slidesComAssets,
  };

  const dadosSerializados = JSON.stringify(dados).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
<title>${escaparTextoHtml(apresentacao.titulo)}</title>
<style>${PLAYER_CSS}</style>
</head>
<body>
<div id="root"></div>
<script>window.__ALPHA_APRESENTACAO_DADOS__ = ${dadosSerializados};</script>
<script>${PLAYER_JS}</script>
</body>
</html>`;

  const nomeArquivo = `${nomeDownloadSeguro(apresentacao.titulo)}.html`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}
