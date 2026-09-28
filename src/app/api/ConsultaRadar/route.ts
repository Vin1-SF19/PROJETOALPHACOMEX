import { NextResponse } from "next/server";
import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";
import { consultarRadar, ErroConsultaRadar } from "@/lib/radar/consulta";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requirePreAnaliseAccess("tributario");
  if (denied) return denied;
  const cnpj = (new URL(req.url).searchParams.get("cnpj") || "").replace(/\D/g, "");
  if (!validarCnpj(cnpj)) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  try {
    return NextResponse.json(await consultarRadar(cnpj));
  } catch (error) {
    if (error instanceof ErroConsultaRadar) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Não foi possível consultar o RADAR" }, { status: 502 });
  }
}
