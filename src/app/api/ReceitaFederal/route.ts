import { NextResponse } from "next/server";
import { getReceitaData } from "@/lib/cnpj/receita-federal";
import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const denied = await requirePreAnaliseAccess("cadastro");
    if (denied) return denied;
    try {
        const { searchParams } = new URL(req.url);
        const cnpj = (searchParams.get("cnpj") || "").replace(/\D/g, "");

        if (!validarCnpj(cnpj)) {
            return NextResponse.json(
                { error: "CNPJ obrigatório e deve conter 14 dígitos" },
                { status: 400 }
            );
        }

        const data = await getReceitaData(cnpj);

        return NextResponse.json({
            ...data,
            capitalSocialFormatado: data.capitalSocial
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(data.capitalSocial))
                : "R$ 0,00",
            cnaes: {
                principal: data.atividade_principal,
                secundarios: data.atividades_secundarias
            }
        });

    } catch {
        console.error("[ReceitaFederal] Falha na consulta cadastral");
        return NextResponse.json(
            { error: "Não foi possível consultar o CNPJ" },
            { status: 502 }
        );
    }
}
