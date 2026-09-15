import { NextResponse } from "next/server";

import { autorizarCron } from "@/lib/bpm/cron-auth";
import { executarMaintenanceAgendadaAgendaAlpha } from "@/lib/google-calendar/maintenance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

let maintenanceEmAndamento = false;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { success: false, error: "Manutenção indisponível: CRON_SECRET não configurado." },
      { status: 503 },
    );
  }
  if (!autorizarCron(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
  }
  if (maintenanceEmAndamento) {
    return NextResponse.json(
      { success: false, error: "A manutenção da Agenda Alpha já está em execução." },
      { status: 409 },
    );
  }

  maintenanceEmAndamento = true;
  try {
    const resumo = await executarMaintenanceAgendadaAgendaAlpha("apply");
    return NextResponse.json(
      { success: resumo.operationalFailures === 0, data: resumo },
      { status: resumo.operationalFailures === 0 ? 200 : 500 },
    );
  } catch (erro) {
    const configuracaoInvalida =
      erro instanceof Error && erro.name === "AgendaAlphaConfigError";
    return NextResponse.json(
      {
        success: false,
        error: configuracaoInvalida
          ? "Manutenção da Agenda Alpha com configuração inválida."
          : "Falha na manutenção da Agenda Alpha.",
      },
      { status: configuracaoInvalida ? 503 : 500 },
    );
  } finally {
    maintenanceEmAndamento = false;
  }
}

export const POST = GET;
