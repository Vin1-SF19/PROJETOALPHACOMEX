import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { gerarFichaServer } from "@/lib/bibble/gerar-ficha-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface GerarFichaInput {
  cnpj: string;
  nomeResponsavel?: string;
  observacoes?: string;
  dataSituacao?: string;
  horaSituacao?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userTyped = session.user as { nome?: string; name?: string };
  const userName = userTyped.nome ?? userTyped.name ?? "Operador";

  const body = await req.json() as GerarFichaInput;

  try {
    const result = await gerarFichaServer({
      cnpj: body.cnpj,
      userName,
      nomeResponsavel: body.nomeResponsavel,
      observacoes: body.observacoes,
      dataSituacao: body.dataSituacao,
      horaSituacao: body.horaSituacao,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    const status = msg === "CNPJ inválido" ? 400 : msg.includes("não encontrada") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
