import { NextResponse } from "next/server";
import { autorizarCron } from "@/lib/bpm/cron-auth";
import { executarJobDesenvolvimentoParceiros } from "@/lib/parceiros/desenvolvimento";

export const dynamic = "force-dynamic";
let jobEmAndamento = false;

// CRM de Canais e Parcerias — Fase 03: reconciliação diária do ciclo de vida de Desenvolvimento
// do Parceiro (onboarding concluído → Ativado sem Indicação; inatividade → Inativo). Reaproveita
// o mesmo padrão de autorização/lock dos demais jobs de cron do projeto (ver vercel.json).
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
      { success: false, error: "O job de desenvolvimento de parceiros já está em execução." },
      { status: 409 },
    );
  }

  jobEmAndamento = true;
  try {
    const resultado = await executarJobDesenvolvimentoParceiros();
    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    console.error("[ParceirosJobDesenvolvimento] Falha no lote", error);
    return NextResponse.json(
      { success: false, error: "Falha ao executar a reconciliação de desenvolvimento de parceiros." },
      { status: 500 },
    );
  } finally {
    jobEmAndamento = false;
  }
}
