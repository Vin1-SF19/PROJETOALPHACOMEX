import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/bpm/cron-auth";
import { executarAlertasCompromissosCalendarioAlpha } from "@/lib/google-calendar/alertas-compromissos";

export const dynamic = "force-dynamic";
let jobEmAndamento = false;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ success: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  if (!autorizarCron(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }
  if (jobEmAndamento) return NextResponse.json({ success: false, error: "Job já está em execução." }, { status: 409 });

  jobEmAndamento = true;
  try {
    return NextResponse.json({ success: true, data: await executarAlertasCompromissosCalendarioAlpha() });
  } catch (error) {
    console.error("[AlertasCompromissosRoute] Falha no lote", error);
    return NextResponse.json({ success: false, error: "Falha ao processar alertas de compromissos." }, { status: 500 });
  } finally {
    jobEmAndamento = false;
  }
}
