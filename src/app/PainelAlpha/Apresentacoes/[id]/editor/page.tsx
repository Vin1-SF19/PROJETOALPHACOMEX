import { auth } from "../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/prisma";
import { ApresentacaoEditor } from "@/components/Apresentacoes/Editor/ApresentacaoEditor";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { obterEntradaApresentacaoSegura } from "@/lib/apresentacoes/entrada-apresentacao";

export const dynamic = "force-dynamic";

function isAdmin(role?: string) {
  return role === "Admin" || role === "CEO";
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
      tema: {
        select: { id: true, nome: true, corPrimaria: true, corSecundaria: true, corAccent: true },
      },
      colaboradores: { where: { userId }, select: { id: true } },
      slides: {
        orderBy: { ordem: "asc" },
        select: { id: true, ordem: true, nome: true, dadosJson: true },
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

  const dadosPrimeiroSlide = primeiroSlide.dadosJson as {
    componentes: ComponenteSlide[];
    canvas?: CanvasConfig;
    entradaApresentacao?: unknown;
  } | null;
  const componentesIniciais = dadosPrimeiroSlide?.componentes ?? [];

  return (
    <ApresentacaoEditor
      apresentacaoId={apresentacao.id}
      titulo={apresentacao.titulo}
      slidesIniciais={apresentacao.slides.map((s) => ({
        id: s.id,
        ordem: s.ordem,
        nome: s.nome,
        componentes: (s.dadosJson as { componentes: ComponenteSlide[] } | null)?.componentes ?? [],
        canvas: obterCanvasSeguro((s.dadosJson as { canvas?: CanvasConfig } | null)?.canvas),
        entradaApresentacao: obterEntradaApresentacaoSegura(
          (s.dadosJson as { entradaApresentacao?: unknown } | null)?.entradaApresentacao,
        ),
      }))}
      slideAtivoIdInicial={primeiroSlide.id}
      componentesIniciais={componentesIniciais}
      canvasInicial={obterCanvasSeguro(dadosPrimeiroSlide?.canvas)}
      entradaApresentacaoInicial={obterEntradaApresentacaoSegura(dadosPrimeiroSlide?.entradaApresentacao)}
      assetsIniciais={apresentacao.assets.map((asset) => ({
        ...asset,
        tipo: asset.tipo as "IMAGEM" | "VIDEO" | "AUDIO" | "MODELO_3D",
        createdAt: asset.createdAt.toISOString(),
      }))}
      temaInicial={apresentacao.tema}
    />
  );
}
