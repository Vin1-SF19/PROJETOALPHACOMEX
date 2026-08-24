import { auth } from "../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/prisma";
import { ApresentacaoEditor } from "@/components/Apresentacoes/Editor/ApresentacaoEditor";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import { isAdminRole } from "@/lib/roles";
import { normalizarPresetsAnimacaoPersonalizados, type PresetAnimacaoPersonalizado } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { apresentacaoPublicaDisponivel } from "@/lib/apresentacoes/publicacao";
import { mesclarFontesPersonalizadas, normalizarFontesPersonalizadas, type FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";
import { listarFontesGlobais } from "@/lib/apresentacoes/fontes-globais";

export const dynamic = "force-dynamic";

function isAdmin(role?: string) {
  return isAdminRole(role);
}

export default async function ApresentacaoEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const userId = Number(session.user.id);

  const apresentacao = await db.apresentacao.findUnique({
    where: { id },
    select: {
      id: true,
      titulo: true,
      autorId: true,
      temaId: true,
      slugPublico: true,
      status: true,
      expiraEm: true,
      tema: {
        select: { id: true, nome: true, corPrimaria: true, corSecundaria: true, corAccent: true },
      },
      colaboradores: { where: { userId }, select: { id: true } },
      slides: {
        orderBy: { ordem: "asc" },
        select: { id: true, ordem: true, nome: true, dadosJson: true, transicaoEntrada: true, oculto: true },
      },
      assets: {
        orderBy: { createdAt: "desc" },
        select: { id: true, tipo: true, url: true, nomeOriginal: true, tamanhoBytes: true, createdAt: true },
      },
    },
  });

  if (!apresentacao) notFound();

  const autorizado = isAdmin(session.user.role) || apresentacao.autorId === userId || apresentacao.colaboradores.length > 0;
  if (!autorizado) redirect("/PainelAlpha/Apresentacoes");

  const primeiroSlide = apresentacao.slides[0];
  if (!primeiroSlide) notFound(); // não deve acontecer — toda apresentação sempre tem >= 1 slide (CriarApresentacao garante)

  type DadosSlidePersistidos = {
    componentes: ComponenteSlide[];
    canvas?: CanvasConfig;
    animacaoConfig?: SlideAnimationConfig;
    presetsAnimacao?: PresetAnimacaoPersonalizado[];
    fontesPersonalizadas?: FontePersonalizada[];
  };
  const dadosPrimeiroSlide = primeiroSlide.dadosJson as DadosSlidePersistidos | null;
  const componentesIniciais = dadosPrimeiroSlide?.componentes ?? [];
  const presetsAnimacaoIniciais = apresentacao.slides
    .map((slide) => (slide.dadosJson as DadosSlidePersistidos | null)?.presetsAnimacao)
    .find((presets) => Array.isArray(presets));
  const fontesPersonalizadasIniciais = apresentacao.slides
    .map((slide) => (slide.dadosJson as DadosSlidePersistidos | null)?.fontesPersonalizadas)
    .find((fontes) => Array.isArray(fontes));
  const fontesGlobais = await listarFontesGlobais();

  return (
    <ApresentacaoEditor
      apresentacaoId={apresentacao.id}
      titulo={apresentacao.titulo}
      slugPublicoInicial={apresentacao.slugPublico && apresentacaoPublicaDisponivel(apresentacao) ? apresentacao.slugPublico : null}
      presetsAnimacaoIniciais={normalizarPresetsAnimacaoPersonalizados(presetsAnimacaoIniciais)}
      fontesPersonalizadasIniciais={mesclarFontesPersonalizadas(
        fontesGlobais,
        normalizarFontesPersonalizadas(fontesPersonalizadasIniciais),
      )}
      slidesIniciais={apresentacao.slides.map((s) => ({
        id: s.id,
        ordem: s.ordem,
        nome: s.nome,
        transicaoEntrada: s.transicaoEntrada,
        componentes: (s.dadosJson as DadosSlidePersistidos | null)?.componentes ?? [],
        canvas: obterCanvasSeguro((s.dadosJson as DadosSlidePersistidos | null)?.canvas),
        animacaoConfig: (s.dadosJson as DadosSlidePersistidos | null)?.animacaoConfig,
        oculto: s.oculto,
      }))}
      slideAtivoIdInicial={primeiroSlide.id}
      componentesIniciais={componentesIniciais}
      canvasInicial={obterCanvasSeguro(dadosPrimeiroSlide?.canvas)}
      animacaoConfigInicial={dadosPrimeiroSlide?.animacaoConfig}
      transicaoEntradaInicial={primeiroSlide.transicaoEntrada}
      assetsIniciais={apresentacao.assets.map((asset) => ({
        ...asset,
        tipo: asset.tipo as "IMAGEM" | "VIDEO" | "AUDIO" | "MODELO_3D",
        createdAt: asset.createdAt.toISOString(),
      }))}
      temaInicial={apresentacao.tema}
    />
  );
}
