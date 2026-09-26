import { NextResponse } from "next/server";

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

  return NextResponse.json({ success: true, data: { ignorado: true, motivo: "PIPELINES_EM_RECONSTRUCAO" } });
}
