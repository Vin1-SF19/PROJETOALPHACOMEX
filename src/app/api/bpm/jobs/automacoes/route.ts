import { NextResponse } from "next/server";

import { autorizarCron } from "@/lib/bpm/cron-auth";
import { materializarAutomacoesTempoBpm } from "@/lib/bpm/automacoes/fila";
import { processarFilaAutomacoesBpm } from "@/lib/bpm/automacoes/executor";
import { processarCadenciasBpm } from "@/lib/bpm/cadencias/executor";
import { materializarAgendasAutomacoesBpm, materializarGatilhosTemporaisBpm, sincronizarAgendasAutomacoesAtivasBpm } from "@/lib/bpm/automacoes/agenda";
import { materializarExecucoesEventosBpm } from "@/lib/bpm/automacoes/eventos";
import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";

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
      { success: false, error: "O job de automações já está em execução." },
      { status: 409 },
    );
  }

  jobEmAndamento = true;
  try {
    const agendasSincronizadas = await sincronizarAgendasAutomacoesAtivasBpm();
    const agendasCentrais = await materializarAgendasAutomacoesBpm();
    const gatilhosTemporais = await materializarGatilhosTemporaisBpm();
    const eventosCentrais = await materializarExecucoesEventosBpm();
    const filaCentral = await processarFilaAutomacoesCentraisBpm();
    const tempo = await materializarAutomacoesTempoBpm();
    const fila = await processarFilaAutomacoesBpm();
    const cadencias = await processarCadenciasBpm();
    return NextResponse.json({ success: true, data: { agendasSincronizadas, agendasCentrais, gatilhosTemporais, eventosCentrais, filaCentral, tempo, fila, cadencias } });
  } catch (error) {
    console.error("[AutomacoesBpmRoute] Falha no lote", error);
    return NextResponse.json(
      { success: false, error: "Falha ao processar automações do CRM." },
      { status: 500 },
    );
  } finally {
    jobEmAndamento = false;
  }
}
