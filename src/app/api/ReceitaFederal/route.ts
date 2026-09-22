import { NextResponse } from "next/server";
import { getReceitaData } from "@/lib/cnpj/receita-federal";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const cnpj = (searchParams.get("cnpj") || "").replace(/\D/g, "");

        if (!cnpj || cnpj.length !== 14) {
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

    } catch (err: any) {
        console.error("ReceitaFederal ERROR:", err.message);
        return NextResponse.json(
            { error: err.message || "Erro interno ao consultar CNPJ" },
            { status: 500 }
        );
    }
}
