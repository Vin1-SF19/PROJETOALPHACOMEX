"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";



export async function salvarPlanilhaNoBancoAction(nome: string, bufferArray: number[]) {
    try {
        const buffer = Buffer.from(bufferArray);

        const tabela = db.historico_planilha_fiscal;

        if (!tabela) {
            throw new Error("Tabela historico_planilha_fiscal não encontrada no Prisma Client.");
        }

        await tabela.create({
            data: {
                nome: nome,
                arquivo: buffer,
                data: new Date()
            }
        });

        revalidatePath("/PainelAlpha/RadarFiscal");
        return { success: true };
    } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error);
        console.error("❌ ERRO AO SALVAR NO TURSO:", mensagem);
        return { success: false, error: mensagem };
    }
}


export async function getHistoricoPlanilhas() {
    try {


        return await db.historico_planilha_fiscal.findMany({
            select: { id: true, nome: true, data: true },
            orderBy: { data: 'desc' }
        });
    } catch {
        return [];
    }
}

export async function baixarPlanilhaDoBanco(id: number) {
    try {
        const registro = await db.historico_planilha_fiscal.findUnique({ where: { id } });
        if (!registro) return null;
        return {
            nome: registro.nome,
            base64: Buffer.from(registro.arquivo).toString('base64')
        };
    } catch {
        return null;
    }
}

export async function excluirPlanilhaBanco(id: number) {
    try {
        await db.historico_planilha_fiscal.delete({
            where: { id }
        });

        revalidatePath("/PainelAlpha/RadarFiscal");
        return { success: true };
    } catch (error) {
        const mensagem = error instanceof Error ? error.message : String(error);
        console.error("❌ ERRO AO EXCLUIR PLANILHA:", mensagem);
        return { success: false, error: mensagem };
    }
}
