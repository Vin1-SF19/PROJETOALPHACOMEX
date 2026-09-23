import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("arquivo");

        if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name || `export_${Date.now()}.xlsx`;

        await db.historico_planilha_fiscal.create({
            data: {
                nome: filename,
                arquivo: buffer,
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Falha ao salvar planilha fiscal:", error);
        return NextResponse.json({ error: "Falha ao salvar planilha" }, { status: 500 });
    }
}
