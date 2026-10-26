import { sessaoEstaIndisponivel } from "@/lib/auth/estado-acesso";
import { mapearIndisponibilidadeAuth, respostaAcessoIndisponivel } from "@/lib/auth/indisponibilidade";
import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { authComEstadoAcesso } from "../../../../auth";
import { STATUS_USUARIO_ATIVO } from "@/lib/auth/acesso-painel";
import { erroTransporteBanco } from "@/lib/db-transport-error";
import { registrarMetricaBanco } from "@/lib/db-observability";

export async function POST() {
  try {
  const session = await authComEstadoAcesso();

  if (sessaoEstaIndisponivel(session)) return respostaAcessoIndisponivel();

  if (session?.acessoBloqueado) {
    return NextResponse.json({ error: "Acesso bloqueado" }, { status: 403 });
  }

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Off" }, { status: 401 });
  }

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
    const authUnavailable = mapearIndisponibilidadeAuth(error);
    if (authUnavailable) return authUnavailable;
    const transient = erroTransporteBanco(error);
    registrarMetricaBanco({ component: "heartbeat", phase: "complete", outcome: "unavailable" });
    return NextResponse.json(
      { error: "Sinal de presença temporariamente indisponível", code: "HEARTBEAT_UNAVAILABLE", retryable: transient },
      { status: transient ? 503 : 500, headers: { "Cache-Control": "private, no-store", ...(transient ? { "Retry-After": "30" } : {}) } },
    );
  }
}
