import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Off" }, { status: 401 });

  try {
    // updateMany não lança P2025 quando o usuário não existe (ex.: sessão JWT
    // válida mas registro já removido/renomeado no banco) — retorna count: 0.
    const { count } = await db.usuarios.updateMany({
      where: { email: session.user.email },
      data: { ultimo_aviso: new Date().toISOString() }
    });

    if (count === 0) {
      // Sessão sem usuário correspondente no banco — não é erro de servidor.
      return NextResponse.json({ success: false, reason: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no sinal de vida:", error);
    return NextResponse.json({ error: "Erro no sinal" }, { status: 500 });
  }
}
