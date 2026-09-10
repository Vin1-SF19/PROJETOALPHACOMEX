import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { auth } from "../../../../auth";
import { isAdminRole } from "@/lib/roles";
import { resumirMensagemChamado } from "@/lib/chamados/notificacoes";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.id) return NextResponse.json({ notificacoes: [] });

  const userId = Number(session.user.id);
  const isAdmin = isAdminRole(session.user.role);

  try {
    const mensagens = await db.mensagensChamado.findMany({
      where: {
        autorId: { not: userId },
        chamado: {
          status: { in: ["ABERTO", "EM_ATENDIMENTO"] },
          ...(!isAdmin && { usuarioId: userId }),
        },
        ...(isAdmin ? { lida_admin: false } : { lida_usuario: false }),
      },
      include: {
        autor: { select: { nome: true } },
        chamado: { select: { titulo: true, id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

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
    });
  } catch {
    return NextResponse.json({ notificacoes: [] });
  }
}
