import { acessoEstaIndisponivel, mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextResponse } from "next/server";
import { getEmpresaAquiData } from "@/lib/cnpj/empresa-aqui";
import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const denied = await requirePreAnaliseAccess("tributario");
    if (denied) return denied;
    try {
        const { searchParams } = new URL(req.url);
        const cnpj = (searchParams.get("cnpj") || "").replace(/\D/g, "");

        if (!validarCnpj(cnpj)) {
            return NextResponse.json({ error: "CNPJ inválido ou ausente" }, { status: 400 });
        }

        const dados = await getEmpresaAquiData(cnpj);
        return NextResponse.json(dados);

    } catch (authError) {
    if (acessoEstaIndisponivel(authError)) throw authError;
        console.error("[EmpresaAqui] Falha na consulta");
        return NextResponse.json({ error: "EmpresaAqui indisponível" }, { status: 502 });
    }

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
