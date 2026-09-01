"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function CriarTarefa(data: {
    texto: string,
    descricao?: string,
    userId: any,
    fixa: boolean,
    diaSemana: number | null;
    intervaloDias?: number | null;
    dataInicio?: Date;
    prioridade: string;
    horario?: string | null;
    /** Chave da opção de alerta predefinida (ex.: "1H_ANTES", "30MIN_ANTES") */
    alerta?: string | null;
}) {
    try {
        const idFinal = Number(data.userId);

        const created = await db.tarefa.create({
            data: {
                texto: data.texto,
                descricao: data.descricao || "",
                fixa: data.fixa,
                diaSemana: data.diaSemana,
                intervaloDias: data.intervaloDias || null,
                dataInicio: data.dataInicio || new Date(),
                feita: false,
                userId: idFinal,
                prioridade: data.prioridade,
                horario: data.horario || null,
            }
        });

        // Persistir alerta via raw SQL (best-effort — falha silenciosamente se a coluna não existir)
        if (data.alerta) {
            try {
                await db.$executeRawUnsafe(
                    `UPDATE "Tarefa" SET "alerta" = ${JSON.stringify(data.alerta)} WHERE "id" = ${created.id}`
                );
            } catch {
                // Coluna "alerta" ainda não existe no banco — migration pendente (Vault)
            }
        }

        revalidatePath("/PainelAlpha/PainelTarefas");
        return { success: true };
    } catch (error: any) {
        if (error.code === 'P2023' || error.message?.includes("Inconsistent column data")) {
            revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasSG");
            revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasC");
            return { success: true };
        }
        console.error("ERRO REAL NO CREATE:", error);
        return { success: false };
    }
}

export async function BuscarTarefasPorUsuario(userId: string, role: string) {
    try {
        const idNumerico = parseInt(userId, 10);
        
        if (isNaN(idNumerico)) return [];

        const tarefas: any[] = await db.$queryRawUnsafe(`
            SELECT 
                id, 
                texto, 
                descricao, 
                feita, 
                fixa, 
                prioridade,
                "diaSemana", 
                "intervaloDias",
                horario,
                CAST("dataInicio" AS TEXT) as "dataInicio",
                "userId",
                CAST("createdAt" AS TEXT) as "createdAt",
                CAST("concluidaEm" AS TEXT) as "concluidaEm"
            FROM "Tarefa" 
            WHERE "userId" = ${idNumerico} 
              AND LOWER("descricao") NOT LIKE '%equipe%'
            ORDER BY "feita" ASC, "horario" ASC
        `);

        return Array.isArray(tarefas) ? tarefas : [];
    } catch (error) {
        console.error("Erro crítico no banco:", error);
        return [];
    }
}

export async function AlternarStatusTarefa(id: string, novoStatus: boolean) {
    try {
        if (!id) return { success: false, error: "ID ausente" };

        const statusNumerico = novoStatus ? 1 : 0;
        
        const dataAgora = new Date().toISOString();

        await db.$executeRawUnsafe(`
            UPDATE "Tarefa" 
            SET "feita" = ${statusNumerico}, 
                "concluidaEm" = ${novoStatus ? `'${dataAgora}'` : 'NULL'}
            WHERE "id" = '${id}'
        `);

        revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasSG");
        revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasC");
        return { success: true };
    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        return { success: false };
    }
}


export async function EditarTarefa(id: string, data: {
    texto: string,
    descricao?: string,
    fixa: boolean,
    diasSemana?: number[];
    intervaloDias?: number | null;
    dataInicio?: Date;
    prioridade: string;
    horario?: string | null;
}) {
    try {

        const feitaStatus = 0;
        const diaSemanaFinal = data.diasSemana && data.diasSemana.length > 0 ? data.diasSemana[0] : null;

        await db.$executeRawUnsafe(`
            UPDATE "Tarefa" 
            SET "texto" = '${data.texto.replace(/'/g, "''")}', 
                "descricao" = '${(data.descricao || "").replace(/'/g, "''")}', 
                "prioridade" = '${data.prioridade}',
                "fixa" = ${data.fixa ? 1 : 0},
                "diaSemana" = ${diaSemanaFinal !== null ? diaSemanaFinal : 'NULL'},
                "intervaloDias" = ${data.intervaloDias !== null ? data.intervaloDias : 'NULL'},
                "horario" = ${data.horario ? `'${data.horario}'` : 'NULL'},
                "dataInicio" = '${data.dataInicio?.toISOString()}'
            WHERE "id" = '${id}'
        `);

        revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasSG");
        revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasC");
        return { success: true };
    } catch (error) {
        console.error("ERRO AO EDITAR:", error);
        return { success: false };
    }
}


export async function DeletarTarefa(id: string) {
    try {
        await db.$executeRawUnsafe(`DELETE FROM "Tarefa" WHERE "id" = '${id}'`);
        revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasSG");
        revalidatePath("/PainelAlpha/PainelTarefas/PainelTarefasC");
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false };
    }
}