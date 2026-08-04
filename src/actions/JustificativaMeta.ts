"use server";

import db from "@/lib/prisma";
import { z } from "zod";
import { del } from "@vercel/blob";
import { auth } from "../../auth";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";

export interface JustificativaMetaItem {
    id: string;
    mes: number;
    ano: number;
    nomeArquivo: string;
    tamanhoBytes: number;
    enviadoPorNome: string;
    createdAt: string;
}

interface AcessoNegado {
    success: false;
    error: string;
}

async function checarAcessoLeitura(): Promise<
    { success: true; userId: number; role: string } | AcessoNegado
> {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : null;
    const role = session?.user?.role ?? "";
    if (!session || !userId) return { success: false, error: "Não autenticado" };

    if (podeGerenciarMetas(role)) return { success: true, userId, role };

    const permissoes = await getPermissoesEfetivas(userId);
    if (!permissoes.includes("metas")) return { success: false, error: "Não autorizado" };

    return { success: true, userId, role };
}

function mapItem(row: {
    id: string;
    mes: number;
    ano: number;
    nomeArquivo: string;
    tamanhoBytes: number;
    createdAt: Date;
    enviadoPor: { nome: string };
}): JustificativaMetaItem {
    return {
        id: row.id,
        mes: row.mes,
        ano: row.ano,
        nomeArquivo: row.nomeArquivo,
        tamanhoBytes: row.tamanhoBytes,
        enviadoPorNome: row.enviadoPor.nome,
        createdAt: row.createdAt.toISOString(),
    };
}

export async function ListarHistoricoJustificativas(): Promise<
    { success: true; data: JustificativaMetaItem[] } | AcessoNegado
> {
    const acesso = await checarAcessoLeitura();
    if (!acesso.success) return acesso;

    const registros = await db.justificativaMeta.findMany({
        orderBy: [{ ano: "desc" }, { mes: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            mes: true,
            ano: true,
            nomeArquivo: true,
            tamanhoBytes: true,
            createdAt: true,
            enviadoPor: { select: { nome: true } },
        },
        take: 200,
    });

    return { success: true, data: registros.map(mapItem) };
}

const periodoSchema = z.object({
    mes: z.number().int().min(1).max(12),
    ano: z.number().int().min(2020).max(2100),
});

export async function BuscarJustificativaVigente(
    mes: number,
    ano: number,
): Promise<{ success: true; data: JustificativaMetaItem | null } | AcessoNegado> {
    const acesso = await checarAcessoLeitura();
    if (!acesso.success) return acesso;

    const periodo = periodoSchema.safeParse({ mes, ano });
    if (!periodo.success) return { success: false, error: "Período inválido" };

    const registro = await db.justificativaMeta.findFirst({
        where: { mes: periodo.data.mes, ano: periodo.data.ano },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            mes: true,
            ano: true,
            nomeArquivo: true,
            tamanhoBytes: true,
            createdAt: true,
            enviadoPor: { select: { nome: true } },
        },
    });

    return { success: true, data: registro ? mapItem(registro) : null };
}

const registrarSchema = z.object({
    mes: z.number().int().min(1).max(12),
    ano: z.number().int().min(2020).max(2100),
    url: z
        .string()
        .url()
        .refine((url) => {
            try {
                return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
            } catch {
                return false;
            }
        }, "URL de arquivo inválida"),
    nomeArquivo: z.string().min(1).max(255),
    tamanhoBytes: z.number().int().positive(),
});

export async function RegistrarJustificativaMeta(
    input: z.infer<typeof registrarSchema>,
): Promise<{ success: true; data: JustificativaMetaItem } | AcessoNegado> {
    const session = await auth();
    const userId = session?.user?.id ? Number(session.user.id) : null;
    const role = session?.user?.role ?? "";
    if (!session || !userId) return { success: false, error: "Não autenticado" };
    if (!podeGerenciarMetas(role)) return { success: false, error: "Não autorizado" };

    const dados = registrarSchema.safeParse(input);
    if (!dados.success) return { success: false, error: "Dados inválidos" };

    try {
        const registro = await db.justificativaMeta.create({
            data: {
                mes: dados.data.mes,
                ano: dados.data.ano,
                arquivoUrl: dados.data.url,
                nomeArquivo: dados.data.nomeArquivo,
                tipoArquivo: "application/pdf",
                tamanhoBytes: dados.data.tamanhoBytes,
                enviadoPorId: userId,
            },
            select: {
                id: true,
                mes: true,
                ano: true,
                nomeArquivo: true,
                tamanhoBytes: true,
                createdAt: true,
                enviadoPor: { select: { nome: true } },
            },
        });

        return { success: true, data: mapItem(registro) };
    } catch (error) {
        console.error("Erro ao registrar justificativa de meta:", error);
        return { success: false, error: "Erro ao salvar justificativa" };
    }
}

export async function ExcluirJustificativaMeta(
    id: string,
): Promise<{ success: true } | AcessoNegado> {
    const session = await auth();
    const role = session?.user?.role ?? "";
    if (!session) return { success: false, error: "Não autenticado" };
    if (!podeGerenciarMetas(role)) return { success: false, error: "Não autorizado" };

    const registro = await db.justificativaMeta.findUnique({
        where: { id },
        select: { id: true, arquivoUrl: true },
    });
    if (!registro) return { success: false, error: "Justificativa não encontrada" };

    try {
        await db.justificativaMeta.delete({ where: { id } });
    } catch (error) {
        console.error("Erro ao excluir justificativa de meta:", error);
        return { success: false, error: "Erro ao excluir justificativa" };
    }

    const token = process.env.METAS_READ_WRITE_TOKEN;
    if (token) {
        await del(registro.arquivoUrl, { token }).catch((error: unknown) => {
            console.error("[ExcluirJustificativaMeta:blob]", error);
        });
    }

    return { success: true };
}
