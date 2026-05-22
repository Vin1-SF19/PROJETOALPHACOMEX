"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";

export interface ColaboradorMeta {
    colaboradoraId: string;
    nome: string;
    imagemUrl: string | null;
    tema: string;
    vendas: number;
    meta: number;
}

export interface DadosMetasResult {
    success: true;
    colaboradores: ColaboradorMeta[];
    metaEquipe: number;
    totalVendas: number;
    mes: number;
    ano: number;
}

export interface DadosMetasError {
    success: false;
    error: string;
}

export async function getDadosMetas(
    mesParam?: number,
    anoParam?: number,
): Promise<DadosMetasResult | DadosMetasError> {
    const agora = new Date();
    const mes = mesParam ?? agora.getMonth() + 1;
    const ano = anoParam ?? agora.getFullYear();

    try {
        // Fonte de verdade: ContratoComercial.status = FECHADO (desacoplado de ComercialPerformance)
        const [comerciais, contratosFechados, metas, metaEquipe] = await Promise.all([
            db.usuarios.findMany({
                where: { role: "COMERCIAL", meta_visivel_painel: true },
                select: { id: true, nome: true, imagemUrl: true, tema_interface: true },
                orderBy: { nome: "asc" },
            }),
            db.contratoComercial.groupBy({
                by: ["usuarioId"],
                _count: { id: true },
                where: { status: "FECHADO", contaComVenda: true, mes, ano },
            }),
            db.metaUsuario.findMany({ where: { mes, ano } }),
            db.metaEquipe.findFirst({ where: { mes, ano } }),
        ]);

        const colaboradores: ColaboradorMeta[] = comerciais.map((usuario) => {
            const fechados = contratosFechados.find((c) => c.usuarioId === usuario.id);
            const metaReg = metas.find((m) => m.colaboradoraId === usuario.nome);
            return {
                colaboradoraId: usuario.nome,
                nome: usuario.nome,
                imagemUrl: usuario.imagemUrl ?? null,
                tema: usuario.tema_interface ?? "blue",
                vendas: fechados?._count?.id ?? 0,
                meta: metaReg?.metaMensal ?? 0,
            };
        });

        colaboradores.sort((a, b) => b.vendas - a.vendas);

        return {
            success: true,
            colaboradores,
            metaEquipe: metaEquipe?.metaMensal ?? 0,
            totalVendas: colaboradores.reduce((acc, c) => acc + c.vendas, 0),
            mes,
            ano,
        };
    } catch (error) {
        console.error("Erro ao buscar metas:", error);
        return { success: false, error: "Erro ao carregar dados" };
    }
}

export async function getColaboradoresParaConfigurar() {
    const session = await auth();
    if (!session || session.user.role !== "Admin")
        return { success: false as const, error: "Não autorizado" };

    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();

    try {
        const [comerciais, metas, metaEquipe] = await Promise.all([
            db.usuarios.findMany({
                where: { role: "COMERCIAL" },
                select: { id: true, nome: true, meta_visivel_painel: true },
                orderBy: { nome: "asc" },
            }),
            db.metaUsuario.findMany({ where: { mes, ano } }),
            db.metaEquipe.findFirst({ where: { mes, ano } }),
        ]);

        return {
            success: true as const,
            colaboradores: comerciais.map((c) => ({
                id: c.id,
                colaboradoraId: c.nome,
                meta: metas.find((m) => m.colaboradoraId === c.nome)?.metaMensal ?? 0,
                visivelNoPainel: c.meta_visivel_painel,
            })),
            metaEquipe: metaEquipe?.metaMensal ?? 0,
            mes,
            ano,
        };
    } catch (error) {
        console.error("Erro ao buscar colaboradores:", error);
        return { success: false as const, error: "Erro ao buscar dados" };
    }
}

export async function toggleMetaVisibilidade(userId: number, visivel: boolean) {
    const session = await auth();
    if (!session || session.user.role !== "Admin")
        return { success: false, error: "Não autorizado" };

    try {
        await db.usuarios.update({
            where: { id: userId },
            data: { meta_visivel_painel: visivel },
        });
        return { success: true };
    } catch {
        return { success: false, error: "Erro ao atualizar visibilidade" };
    }
}

export async function upsertMetaUsuario(
    colaboradoraId: string,
    metaMensal: number,
    mes: number,
    ano: number,
) {
    const session = await auth();
    if (!session || session.user.role !== "Admin")
        return { success: false, error: "Não autorizado" };

    try {
        await db.metaUsuario.upsert({
            where: { colaboradoraId_mes_ano: { colaboradoraId, mes, ano } },
            update: { metaMensal },
            create: { colaboradoraId, metaMensal, mes, ano },
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar meta:", error);
        return { success: false, error: "Erro ao salvar meta" };
    }
}

export async function upsertMetaEquipe(metaMensal: number, mes: number, ano: number) {
    const session = await auth();
    if (!session || session.user.role !== "Admin")
        return { success: false, error: "Não autorizado" };

    try {
        await db.metaEquipe.upsert({
            where: { mes_ano: { mes, ano } },
            update: { metaMensal },
            create: { metaMensal, mes, ano },
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar meta da equipe:", error);
        return { success: false, error: "Erro ao salvar meta da equipe" };
    }
}
