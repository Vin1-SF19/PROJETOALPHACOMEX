import { NextResponse } from "next/server";

import { autorizarCron } from "@/lib/bpm/cron-auth";
import { materializarAutomacoesTempoBpm } from "@/lib/bpm/automacoes/fila";
import { processarFilaAutomacoesBpm } from "@/lib/bpm/automacoes/executor";
import { processarCadenciasBpm } from "@/lib/bpm/cadencias/executor";
import { materializarAgendasAutomacoesBpm, materializarGatilhosTemporaisBpm, sincronizarAgendasAutomacoesAtivasBpm } from "@/lib/bpm/automacoes/agenda";
import { materializarExecucoesEventosBpm } from "@/lib/bpm/automacoes/eventos";
import { processarFilaAutomacoesCentraisBpm } from "@/lib/bpm/automacoes/central-runtime";
import { reconciliarBlobsAnexosBpm } from "@/lib/bpm/anexos-lifecycle";
import { reconciliarCompensacoesGoogleBpm } from "@/lib/bpm/google-meet-compensacao";

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
    const anexos = await reconciliarBlobsAnexosBpm().catch((error) => {
      console.error("[AutomacoesBpmRoute] Reconciliação de anexos", error);
      return { examinados: 0, concluidos: 0, falhas: 1 };
    });
    const reunioes = await reconciliarCompensacoesGoogleBpm().catch((error) => {
      console.error("[AutomacoesBpmRoute] Reconciliação de reuniões", error);
      return { examinados: 0, concluidos: 0, falhas: 1 };
    });
    return NextResponse.json({ success: true, data: { agendasSincronizadas, agendasCentrais, gatilhosTemporais, eventosCentrais, filaCentral, tempo, fila, cadencias, anexos, reunioes } });
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
