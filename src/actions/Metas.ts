"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";

const ROLE_LIDER_COMERCIAL = "Lider Comercial";
const ROLES_EQUIPE_COMERCIAL = ["COMERCIAL", ROLE_LIDER_COMERCIAL];

function metasValidas(metaMensal: number, superMetaMensal: number) {
    return Number.isInteger(metaMensal)
        && Number.isInteger(superMetaMensal)
        && metaMensal >= 0
        && superMetaMensal >= 0
        && (superMetaMensal === 0 || superMetaMensal >= metaMensal);
}

export interface ColaboradorMeta {
    colaboradoraId: string;
    nome: string;
    usuario: string;
    imagemUrl: string | null;
    tema: string;
    vendas: number;
    meta: number;
    superMeta: number;
    liderComercial: boolean;
}

export interface DadosMetasResult {
    success: true;
    colaboradores: ColaboradorMeta[];
    metaEquipe: number;
    superMetaEquipe: number;
    /** Alvo do termômetro "Total geral". */
    metaAlphaEquipe: number;
    /** Vendas das closers — alimenta o termômetro principal e as celebrações da equipe. */
    totalVendas: number;
    /** Vendas de todo o time visível, incluindo líderes comerciais. */
    totalVendasGeral: number;
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
                where: {
                    role: { in: ROLES_EQUIPE_COMERCIAL },
                    meta_visivel_painel: true,
                },
                select: { id: true, nome: true, usuario: true, imagemUrl: true, tema_interface: true, role: true },
                orderBy: { nome: "asc" },
            }),
            db.contratoComercial.groupBy({
                by: ["usuarioId"],
                _count: { id: true },
                where: {
                    status: "FECHADO",
                    contaComVenda: true,
                    pagamentoConfirmadoEm: {
                        gte: new Date(ano, mes - 1, 1),
                        lt: new Date(ano, mes, 1),
                    },
                },
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
                usuario: usuario.usuario,
                imagemUrl: usuario.imagemUrl ?? null,
                tema: usuario.tema_interface ?? "blue",
                vendas: fechados?._count?.id ?? 0,
                meta: metaReg?.metaMensal ?? 0,
                superMeta: metaReg?.superMetaMensal ?? 0,
                liderComercial: usuario.role === ROLE_LIDER_COMERCIAL,
            };
        });

        colaboradores.sort((a, b) => b.vendas - a.vendas);

        return {
            success: true,
            colaboradores,
            metaEquipe: metaEquipe?.metaMensal ?? 0,
            superMetaEquipe: metaEquipe?.superMetaMensal ?? 0,
            metaAlphaEquipe: metaEquipe?.metaAlphaMensal ?? 0,
            totalVendas: colaboradores
                .filter((c) => !c.liderComercial)
                .reduce((acc, c) => acc + c.vendas, 0),
            totalVendasGeral: colaboradores.reduce((acc, c) => acc + c.vendas, 0),
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
    if (!session || !podeGerenciarMetas(session.user.role ?? ""))
        return { success: false as const, error: "Não autorizado" };

    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();

    try {
        const [comerciais, metas, metaEquipe] = await Promise.all([
            db.usuarios.findMany({
                where: { role: { in: ROLES_EQUIPE_COMERCIAL } },
                select: { id: true, nome: true, usuario: true, meta_visivel_painel: true },
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
                usuario: c.usuario,
                meta: metas.find((m) => m.colaboradoraId === c.nome)?.metaMensal ?? 0,
                superMeta: metas.find((m) => m.colaboradoraId === c.nome)?.superMetaMensal ?? 0,
                visivelNoPainel: c.meta_visivel_painel,
            })),
            metaEquipe: metaEquipe?.metaMensal ?? 0,
            superMetaEquipe: metaEquipe?.superMetaMensal ?? 0,
            metaAlphaEquipe: metaEquipe?.metaAlphaMensal ?? 0,
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
    if (!session || !podeGerenciarMetas(session.user.role ?? ""))
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
    superMetaMensal: number,
    mes: number,
    ano: number,
) {
    const session = await auth();
    if (!session || !podeGerenciarMetas(session.user.role ?? ""))
        return { success: false, error: "Não autorizado" };
    if (!metasValidas(metaMensal, superMetaMensal))
        return { success: false, error: "Super meta inválida" };

    try {
        await db.metaUsuario.upsert({
            where: { colaboradoraId_mes_ano: { colaboradoraId, mes, ano } },
            update: { metaMensal, superMetaMensal },
            create: { colaboradoraId, metaMensal, superMetaMensal, mes, ano },
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar meta:", error);
        return { success: false, error: "Erro ao salvar meta" };
    }
}

export async function upsertMetaEquipe(
    metaMensal: number,
    superMetaMensal: number,
    metaAlphaMensal: number,
    mes: number,
    ano: number,
) {
    const session = await auth();
    if (!session || !podeGerenciarMetas(session.user.role ?? ""))
        return { success: false, error: "Não autorizado" };
    if (!metasValidas(metaMensal, superMetaMensal))
        return { success: false, error: "Super meta inválida" };
    if (!Number.isInteger(metaAlphaMensal) || metaAlphaMensal < 0)
        return { success: false, error: "Meta Alpha inválida" };

    try {
        await db.metaEquipe.upsert({
            where: { mes_ano: { mes, ano } },
            update: { metaMensal, superMetaMensal, metaAlphaMensal },
            create: { metaMensal, superMetaMensal, metaAlphaMensal, mes, ano },
        });
        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar meta da equipe:", error);
        return { success: false, error: "Erro ao salvar meta da equipe" };
    }
}
