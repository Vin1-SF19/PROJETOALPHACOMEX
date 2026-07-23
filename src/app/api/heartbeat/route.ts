import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { authComEstadoAcesso } from "../../../../auth";
import { STATUS_USUARIO_ATIVO } from "@/lib/auth/acesso-painel";

export async function POST() {
  const session = await authComEstadoAcesso();

  if (session?.acessoBloqueado) {
    return NextResponse.json({ error: "Acesso bloqueado" }, { status: 403 });
  }

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Off" }, { status: 401 });
  }

  try {
    const { count } = await db.usuarios.updateMany({
      where: {
        email: session.user.email,
        status: STATUS_USUARIO_ATIVO,
      },
      data: { ultimo_aviso: new Date().toISOString() },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Acesso bloqueado" }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no sinal de vida:", error);
    return NextResponse.json({ error: "Erro no sinal" }, { status: 500 });
  }
}
