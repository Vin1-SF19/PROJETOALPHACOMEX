import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import db from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/onboarding/marcar-visto — marca o vídeo de introdução como visto p/ o usuário logado.
export async function POST() {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    await db.usuarios.update({
      where: { id: Number(session.user.id) },
      data: { onboarding_ialpha_visto: true },
    });
    return NextResponse.json({ success: true });
  } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError;
    return NextResponse.json({ error: "Falha ao registrar." }, { status: 500 });
  }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
