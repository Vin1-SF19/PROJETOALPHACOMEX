import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notificarNovoChamado } from "@/lib/chamados/notificacoes-server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });

  try {
    const { titulo, descricao, prioridade, categoria } = await req.json();

    const novoChamado = await db.chamados.create({
      data: {
        titulo,
        descricao,
        categoria: categoria || "SUPORTE",
        prioridade: prioridade || "MEDIA",
        usuarioId: Number(session.user.id),
        status: "ABERTO",
      },
    });

    await notificarNovoChamado({
      chamadoId: novoChamado.id,
      titulo: novoChamado.titulo,
      usuario: session.user.nome || "Usuário",
      setor: session.user.role || "",
      urgencia: novoChamado.prioridade,
      createdAt: novoChamado.createdAt.toISOString(),
    });

    revalidatePath("/PainelAlpha/Chamados");
    return NextResponse.json({ success: true, id: novoChamado.id });
  } catch {
    return NextResponse.json({ error: "Erro ao criar via Bibble" }, { status: 500 });
  }
}
