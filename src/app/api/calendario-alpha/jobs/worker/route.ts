import { NextResponse } from "next/server";

import { autorizarCron } from "@/lib/bpm/cron-auth";
import { executarWorkerAgendaAlpha } from "@/lib/google-calendar/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

let workerEmAndamento = false;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { success: false, error: "Worker indisponível: CRON_SECRET não configurado." },
      { status: 503 },
    );
  }
  if (!autorizarCron(request.headers.get("authorization"), segredo)) {
    return NextResponse.json(
      { success: false, error: "Não autorizado." },
      { status: 401 },
    );
  }
  if (workerEmAndamento) {
    return NextResponse.json(
      { success: false, error: "O worker da Agenda Alpha já está em execução." },
      { status: 409 },
    );
  }

  workerEmAndamento = true;
  try {
    // Uma operação por invocação mantém o worker dentro da janela serverless.
    // Claims e leases persistentes tornam execuções concorrentes entre réplicas seguras.
    const resumo = await executarWorkerAgendaAlpha({ mode: "once", maxJobs: 1 });
    return NextResponse.json({
      success: resumo.operationalFailures === 0,
      data: resumo,
    }, { status: resumo.operationalFailures === 0 ? 200 : 500 });
  } catch (erro) {
    const configuracaoInvalida =
      erro instanceof Error && erro.name === "AgendaAlphaConfigError";
    return NextResponse.json(
      {
        success: false,
        error: configuracaoInvalida
          ? "Worker da Agenda Alpha com configuração inválida."
          : "Falha ao processar a fila da Agenda Alpha.",
      },
      { status: configuracaoInvalida ? 503 : 500 },
    );
  } finally {
    workerEmAndamento = false;
  }
}

export const POST = GET;
