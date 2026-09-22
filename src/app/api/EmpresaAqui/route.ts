import { NextResponse } from "next/server";
import { getEmpresaAquiData } from "@/lib/cnpj/empresa-aqui";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const cnpj = (searchParams.get("cnpj") || "").replace(/\D/g, "");

        if (!cnpj || cnpj.length !== 14) {
            return NextResponse.json({ error: "CNPJ inválido ou ausente" }, { status: 400 });
        }

        const dados = await getEmpresaAquiData(cnpj);
        return NextResponse.json(dados);

    } catch (err: any) {
        console.error("🔥 [EA] ERRO:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
