import { notFound } from "next/navigation";
import db from "@/lib/prisma";
import { PublicPresentationPlayer } from "@/components/Apresentacoes/PublicPresentationPlayer";
import { apresentacaoPublicaDisponivel, slugPublicoEhValido } from "@/lib/apresentacoes/publicacao";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import type { DadosApresentacaoExportada } from "@/apresentacoes-player/dados-tipos";
import { normalizarFontesPersonalizadas, type FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function ApresentacaoPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugPublicoEhValido(slug)) notFound();

  const apresentacao = await db.apresentacao.findUnique({
    where: { slugPublico: slug },
    select: {
      titulo: true,
      status: true,
      expiraEm: true,
      tema: { select: { corPrimaria: true, corSecundaria: true, corAccent: true } },
      slides: {
        orderBy: { ordem: "asc" },
        select: { id: true, ordem: true, transicaoEntrada: true, dadosJson: true },
      },
    },
  });
  if (!apresentacao || !apresentacaoPublicaDisponivel(apresentacao)) notFound();

  const dados: DadosApresentacaoExportada = {
    titulo: apresentacao.titulo,
    tema: apresentacao.tema,
    fontesPersonalizadas: normalizarFontesPersonalizadas(
      apresentacao.slides
        .map((slide) => (slide.dadosJson as { fontesPersonalizadas?: FontePersonalizada[] } | null)?.fontesPersonalizadas)
        .find(Array.isArray),
    ),
    slides: apresentacao.slides.map((slide) => ({
      id: slide.id,
      ordem: slide.ordem,
      transicaoEntrada: slide.transicaoEntrada,
      componentes: (slide.dadosJson as { componentes?: ComponenteSlide[] } | null)?.componentes ?? [],
      canvas: obterCanvasSeguro((slide.dadosJson as { canvas?: CanvasConfig } | null)?.canvas),
      animacaoConfig: (slide.dadosJson as { animacaoConfig?: SlideAnimationConfig } | null)?.animacaoConfig ?? null,
    })),
  };

  return <PublicPresentationPlayer dados={dados} />;
}
