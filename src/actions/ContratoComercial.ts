"use server";

import { z } from "zod";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { revalidatePath } from "next/cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAdminOrCeo(role: string) {
    return role === "Admin" || role === "CEO";
}

function isComercialOrAdmin(role: string) {
    return role === "COMERCIAL" || role === "Lider Comercial" || role === "Admin" || role === "CEO";
}

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const SocioSchema = z.object({
    nome: z.string().min(1),
    telefone: z.string().optional().default(""),
    dataNascimento: z.string().optional().default(""),
    vinculo: z.string().optional().default(""),
    obs: z.string().optional().default(""),
});

const CriarContratoSchema = z.object({
    cnpj: z.string().min(14).max(18),
    razaoSocial: z.string().min(1),
    nomeFantasia: z.string().optional(),
    valorContrato: z.number().positive(),
    formaPagamento: z.enum(["ENTRADA_EXITO", "PARCELADO_CC", "INTEGRAL_PIX", "OUTRO"]),
    servico: z.string().min(1),
    canalAquisicao: z.string().min(1),
    closerNome: z.string().min(1),
    mes: z.number().int().min(1).max(12),
    ano: z.number().int().min(2024).max(2099),
    socios: z.array(SocioSchema).optional(),
});

const ConfirmarFechamentoSchema = z.object({
    id: z.string().cuid(),
    pagamentoConfirmado: z.boolean(),
    pagamentoConfirmadoEm: z.string().optional(),
    contratoAssinado: z.boolean(),
    contratoUrl: z.string().url().optional().or(z.literal("")),
});

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function criarContrato(raw: unknown) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const userId = (session.user as { id?: string }).id;
    if (!userId) return { success: false as const, error: "Não autorizado" };

    // Busca role do DB — evita role stale no JWT
    const dbUser = await db.usuarios.findUnique({ where: { id: Number(userId) }, select: { role: true } });
    const role = dbUser?.role ?? "";

    if (!isComercialOrAdmin(role)) {
        return { success: false as const, error: "Sem permissão" };
    }

    const parsed = CriarContratoSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0].message };
    }

    const d = parsed.data;

    try {
        const contrato = await db.contratoComercial.create({
            data: {
                cnpj: d.cnpj.replace(/\D/g, ""),
                razaoSocial: d.razaoSocial,
                nomeFantasia: d.nomeFantasia ?? null,
                valorContrato: d.valorContrato,
                formaPagamento: d.formaPagamento,
                servico: d.servico,
                canalAquisicao: d.canalAquisicao,
                closerNome: d.closerNome,
                mes: d.mes,
                ano: d.ano,
                socios: d.socios ?? [],
                usuarioId: Number(userId),
            },
        });

        revalidatePath("/PainelAlpha/Metas");
        return { success: true as const, contrato };
    } catch (err) {
        console.error("criarContrato:", err);
        return { success: false as const, error: "Erro ao criar contrato" };
    }
}

export async function confirmarFechamento(raw: unknown) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const userId = Number((session.user as { id?: string }).id);
    if (!userId) return { success: false as const, error: "Não autorizado" };

    // Busca role do DB — evita role stale no JWT
    const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    const role = dbUser?.role ?? "";

    const parsed = ConfirmarFechamentoSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0].message };
    }

    const d = parsed.data;

    if (!d.pagamentoConfirmado) {
        return { success: false as const, error: "Pagamento deve ser confirmado" };
    }

    if (d.contratoAssinado && !d.contratoUrl) {
        return { success: false as const, error: "Upload do contrato obrigatório quando assinado" };
    }

    try {
        const contrato = await db.contratoComercial.findUnique({ where: { id: d.id } });
        if (!contrato) return { success: false as const, error: "Contrato não encontrado" };

        // IDOR: comercial só fecha o próprio
        if (!isAdminOrCeo(role) && contrato.usuarioId !== userId) {
            return { success: false as const, error: "Sem permissão" };
        }

        const atualizado = await db.contratoComercial.update({
            where: { id: d.id },
            data: {
                status: "FECHADO",
                pagamentoConfirmado: d.pagamentoConfirmado,
                pagamentoConfirmadoEm: d.pagamentoConfirmadoEm
                    ? new Date(d.pagamentoConfirmadoEm)
                    : new Date(),
                contratoAssinado: d.contratoAssinado,
                contratoUrl: d.contratoUrl || null,
            },
        });

        // Auto-cria cliente no painel CS/NPS se ainda não existir
        // CNPJ duplicado = não cria no CS/NPS mas SEMPRE conta como venda
        try {
            const existeCliente = await db.clientes.findFirst({
                where: { cnpj: atualizado.cnpj },
                select: { id: true },
            });

            if (!existeCliente) {
                type SocioJson = { nome?: string; telefone?: string; dataNascimento?: string; vinculo?: string; obs?: string };
                const sociosJson = ((atualizado.socios ?? []) as SocioJson[]).filter((s) => s.nome?.trim());

                // Busca dados complementares na Receita Federal
                let dataConstituicao = "";
                let uf = "";
                let regimeTributario = "";
                try {
                    const { getReceitaData } = await import("@/app/api/ReceitaFederal/route");
                    const receita = await getReceitaData(atualizado.cnpj);
                    if (receita) {
                        dataConstituicao = receita.dataConstituicao ?? "";
                        uf = receita.uf ?? "";
                        regimeTributario = receita.regimeTributario ?? "";
                    }
                } catch {
                    // dados complementares opcionais — falha silenciosa
                }

                await db.clientes.create({
                    data: {
                        cnpj: atualizado.cnpj,
                        razaoSocial: atualizado.razaoSocial,
                        nomeFantasia: atualizado.nomeFantasia ?? "",
                        servicos: atualizado.servico,
                        analistaResponsavel: "SEM ATRIBUIÇÃO",
                        origemLead: atualizado.canalAquisicao || null,
                        dataConstituicao: dataConstituicao || null,
                        uf: uf || null,
                        regimeTributario: regimeTributario || null,
                        dataContratacao: atualizado.pagamentoConfirmadoEm
                            ? atualizado.pagamentoConfirmadoEm.toISOString()
                            : new Date().toISOString(),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        socios: {
                            create: sociosJson.map((s) => ({
                                nome: s.nome!,
                                telefone: s.telefone ?? "",
                                obs: s.obs ?? "",
                                dataNascimento: s.dataNascimento ?? "",
                                vinculo: s.vinculo ?? "",
                            })),
                        },
                    },
                });
                revalidatePath("/PainelAlpha/CadastroClientes");
            }
        } catch (clienteErr) {
            console.error("auto-create cliente CS/NPS:", clienteErr);
        }

        revalidatePath("/PainelAlpha/Metas");
        return { success: true as const, contrato: atualizado };
    } catch (err) {
        console.error("confirmarFechamento:", err);
        return { success: false as const, error: "Erro ao confirmar fechamento" };
    }
}

export interface GetContratosOptions {
    mes: number;
    ano: number;
    adminView?: boolean;
    filtroUsuarioId?: number;
}

export async function getContratos(options: GetContratosOptions) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const role = (session.user as { role?: string }).role ?? "";
    const userId = Number((session.user as { id?: string }).id);

    const { mes, ano, adminView, filtroUsuarioId } = options;

    let whereUsuarioId: number | undefined;

    if (isAdminOrCeo(role) && adminView) {
        // admin vê todos — filtra por colaborador se filtroUsuarioId passado
        whereUsuarioId = filtroUsuarioId;
    } else {
        // comercial só vê o próprio
        whereUsuarioId = userId;
    }

    try {
        const contratos = await db.contratoComercial.findMany({
            where: {
                mes,
                ano,
                ...(whereUsuarioId !== undefined ? { usuarioId: whereUsuarioId } : {}),
            },
            include: {
                usuario: {
                    select: { id: true, nome: true, imagemUrl: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return { success: true as const, contratos };
    } catch (err) {
        console.error("getContratos:", err);
        return { success: false as const, error: "Erro ao buscar contratos" };
    }
}

export async function getColaboradoresComerciais() {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    try {
        const usuarios = await db.usuarios.findMany({
            where: { role: "COMERCIAL", status: "ATIVO" },
            select: { id: true, nome: true, imagemUrl: true },
            orderBy: { nome: "asc" },
        });
        return { success: true as const, usuarios };
    } catch (err) {
        console.error("getColaboradoresComerciais:", err);
        return { success: false as const, error: "Erro ao buscar colaboradores" };
    }
}

export async function getServicosComerciais() {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    try {
        const servicos = await db.servicosComerciais.findMany({
            where: { ativo: true },
            orderBy: { nome: "asc" },
        });
        return { success: true as const, servicos };
    } catch (err) {
        console.error("getServicosComerciais:", err);
        return { success: false as const, error: "Erro ao buscar serviços" };
    }
}

export async function criarServicoComercial(nome: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const role = (session.user as { role?: string }).role ?? "";

    if (!isComercialOrAdmin(role)) {
        return { success: false as const, error: "Sem permissão" };
    }

    const nomeParsed = z.string().min(2).max(80).safeParse(nome.trim());
    if (!nomeParsed.success) {
        return { success: false as const, error: "Nome inválido" };
    }

    try {
        const servico = await db.servicosComerciais.upsert({
            where: { nome: nomeParsed.data },
            update: { ativo: true },
            create: { nome: nomeParsed.data },
        });
        revalidatePath("/PainelAlpha/Metas");
        return { success: true as const, servico };
    } catch (err) {
        console.error("criarServicoComercial:", err);
        return { success: false as const, error: "Erro ao criar serviço" };
    }
}

export async function seedServicosIniciais() {
    const session = await auth();
    if (!session?.user) return;

    const role = (session.user as { role?: string }).role ?? "";
    if (!isAdminOrCeo(role)) return;

    const iniciais = [
        "Habilitação RADAR - 50K",
        "Revisão RADAR - 150K",
        "Revisão RADAR - ILIMITADO",
        "TTD 409",
        "Recuperação AFRMM",
        "Outras Recuperações Tributárias",
    ];

    for (const nome of iniciais) {
        await db.servicosComerciais.upsert({
            where: { nome },
            update: {},
            create: { nome },
        });
    }
}

export async function atualizarContratoUrl(id: string, contratoUrl: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const userId = Number((session.user as { id?: string }).id);
    const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    const role = dbUser?.role ?? "";

    if (!isComercialOrAdmin(role)) {
        return { success: false as const, error: "Sem permissão" };
    }

    const idParsed = z.string().cuid().safeParse(id);
    if (!idParsed.success) return { success: false as const, error: "ID inválido" };

    const urlParsed = z.string().url().safeParse(contratoUrl);
    if (!urlParsed.success) return { success: false as const, error: "URL inválida" };

    const contrato = await db.contratoComercial.findUnique({
        where: { id: idParsed.data },
        select: { usuarioId: true },
    });
    if (!contrato) return { success: false as const, error: "Contrato não encontrado" };
    if (!isAdminOrCeo(role) && contrato.usuarioId !== userId) {
        return { success: false as const, error: "Sem permissão" };
    }

    try {
        await db.contratoComercial.update({
            where: { id: idParsed.data },
            data: { contratoUrl: urlParsed.data, contratoAssinado: true },
        });
        return { success: true as const };
    } catch (err) {
        console.error("atualizarContratoUrl:", err);
        return { success: false as const, error: "Erro ao salvar" };
    }
}

export async function excluirContrato(id: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const userId = Number((session.user as { id?: string }).id);
    const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    const role = dbUser?.role ?? "";

    if (!isAdminOrCeo(role)) {
        return { success: false as const, error: "Sem permissão" };
    }

    const parsed = z.string().cuid().safeParse(id);
    if (!parsed.success) return { success: false as const, error: "ID inválido" };

    try {
        await db.contratoComercial.delete({ where: { id: parsed.data } });
        revalidatePath("/PainelAlpha/Metas");
        return { success: true as const };
    } catch (err) {
        console.error("excluirContrato:", err);
        return { success: false as const, error: "Erro ao excluir contrato" };
    }
}
