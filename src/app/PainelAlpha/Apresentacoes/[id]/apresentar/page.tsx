import { auth } from "../../../../../../auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/prisma";
import { ModoApresentacaoClient } from "@/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { isAdminRole } from "@/lib/roles";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";

export const dynamic = "force-dynamic";

function isAdmin(role?: string) {
  return isAdminRole(role);
}

export default async function ModoApresentacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      tema: {
        select: { id: true, nome: true, corPrimaria: true, corSecundaria: true, corAccent: true },
      },
      colaboradores: { where: { userId }, select: { id: true } },
      slides: {
        orderBy: { ordem: "asc" },
        select: { id: true, ordem: true, dadosJson: true, transicaoEntrada: true },
      },
    },
  });

  if (!apresentacao) notFound();

  const autorizado = isAdmin(session.user.role) || apresentacao.autorId === userId || apresentacao.colaboradores.length > 0;
  if (!autorizado) redirect("/PainelAlpha/Apresentacoes");

  if (apresentacao.slides.length === 0) notFound(); // não deve acontecer — toda apresentação sempre tem >= 1 slide

  const slides = apresentacao.slides.map((s) => ({
    id: s.id,
    transicaoEntrada: s.transicaoEntrada,
    componentes: (s.dadosJson as { componentes: ComponenteSlide[] } | null)?.componentes ?? [],
    canvas: obterCanvasSeguro((s.dadosJson as { canvas?: CanvasConfig } | null)?.canvas),
    animacaoConfig: (s.dadosJson as { animacaoConfig?: SlideAnimationConfig } | null)?.animacaoConfig,
  }));

  return (
    <ModoApresentacaoClient
      apresentacaoId={apresentacao.id}
      slides={slides}
      tema={apresentacao.tema}
    />
  );
}
