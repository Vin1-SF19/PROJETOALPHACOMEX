import { NextResponse } from "next/server";

import { executarAutomacaoFollowUpBpm } from "@/lib/bpm/automacao-novos-leads";
import { autorizarCron } from "@/lib/bpm/cron-auth";
import { executarPollingTranscricoesBpm } from "@/lib/bpm/transcricao-reuniao-server";

export const dynamic = "force-dynamic";
let jobEmAndamento = false;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json(
      { success: false, error: "Automação indisponível: CRON_SECRET não configurado." },
      { status: 503 },
    );
  }

  if (!autorizarCron(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  if (jobEmAndamento) {
    return NextResponse.json(
      { success: false, error: "O job de follow-up já está em execução." },
      { status: 409 },
    );
  }

  jobEmAndamento = true;
  try {
    const transcricoes = await executarPollingTranscricoesBpm();
    const followUp = await executarAutomacaoFollowUpBpm();
    return NextResponse.json({ success: true, data: { transcricoes, followUp } });
  } catch (error) {
    console.error("[AutomacaoNovosLeadsRoute] Falha no lote", error);
    return NextResponse.json(
      { success: false, error: "Falha ao executar automação de follow-up do CRM." },
      { status: 500 },
    );
  } finally {
    jobEmAndamento = false;
  }
}
