import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { auth } from "../../../../auth";
import { isAdminRole } from "@/lib/roles";
import { resumirMensagemChamado } from "@/lib/chamados/notificacoes";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ notificacoes: [], feedbacksPendentes: [] });
  }

  const userId = Number(session.user.id);
  const isAdmin = isAdminRole(session.user.role);

  try {
    const [mensagens, feedbacksPendentes] = await Promise.all([
      db.mensagensChamado.findMany({
        where: {
          autorId: { not: userId },
          chamado: {
            status: { in: ["ABERTO", "EM_ATENDIMENTO"] },
            ...(!isAdmin && { usuarioId: userId }),
          },
          ...(isAdmin ? { lida_admin: false } : { lida_usuario: false }),
        },
        select: {
          id: true,
          autorId: true,
          texto: true,
          arquivoTipo: true,
          createdAt: true,
          autor: { select: { nome: true } },
          chamado: { select: { titulo: true, id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.chamadoFeedback.findMany({
        where: {
          status: "PENDENTE",
          chamado: {
            usuarioId: userId,
            status: "CONCLUIDO",
            closedAt: { not: null },
          },
        },
        select: {
          chamadoId: true,
          chamado: { select: { titulo: true, closedAt: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      notificacoes: mensagens.map((mensagem) => ({
        mensagemId: mensagem.id,
        chamadoId: mensagem.chamado.id,
        titulo: mensagem.chamado.titulo,
        autorId: mensagem.autorId,
        autorNome: mensagem.autor.nome,
        texto: resumirMensagemChamado(mensagem.texto, mensagem.arquivoTipo),
        createdAt: mensagem.createdAt.toISOString(),
      })),
      feedbacksPendentes: feedbacksPendentes.flatMap((feedback) =>
        feedback.chamado.closedAt
          ? [{
              chamadoId: feedback.chamadoId,
              titulo: feedback.chamado.titulo,
              closedAt: feedback.chamado.closedAt.toISOString(),
            }]
          : [],
      ),
    });
  } catch (error) {
    console.error("[notificacoes] Falha ao recuperar notificações e feedbacks pendentes", {
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
    return NextResponse.json(
      { notificacoes: [], feedbacksPendentes: [] },
      { status: 500 },
    );
  }
}
