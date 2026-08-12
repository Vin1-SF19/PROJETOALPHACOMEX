import { NextResponse } from "next/server";

import { executarAutomacaoNovosLeads } from "@/lib/bpm/automacao-novos-leads";
import { autorizarCron } from "@/lib/bpm/cron-auth";

export const dynamic = "force-dynamic";

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

  try {
    const resumo = await executarAutomacaoNovosLeads();
    return NextResponse.json({ success: true, data: resumo });
  } catch (error) {
    console.error("[AutomacaoNovosLeadsRoute] Falha no lote", error);
    return NextResponse.json(
      { success: false, error: "Falha ao executar automação de Novos leads." },
      { status: 500 },
    );
  }
}

