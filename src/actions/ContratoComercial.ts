"use server";

import { z } from "zod";
import db from "@/lib/prisma";
import { auth } from "../../auth";
import { isAdminRole } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { criarRegistroClienteAPartirDeContrato } from "./Clientes";
import { SERVICOS_COMERCIAIS_PADRAO } from "@/lib/comercial/servicos";
import { pusherServer } from "@/lib/pusher-server.ts";
import {
    CANAL_INDICACAO_PARCEIRO,
    ParceiroNaoCadastradoInputSchema,
    serializarParceiroNaoCadastrado,
    type ParceiroNaoCadastradoInput,
} from "@/lib/comercial/parceiro-nao-cadastrado";
import {
    CANAL_PROSPECCAO_ATIVA,
    normalizarCatalogoProspeccoes,
    ProspeccaoAtivaSchema,
} from "@/lib/comercial/prospeccao-ativa";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAdminOrCeo(role: string) {
    return isAdminRole(role) || role === "FINANCEIRO" || role === "Lider Comercial" || role === "COMERCIAL";
}

/**
 * Regra de negócio: APENAS Revisão RADAR 150K e Revisão RADAR ILIMITADO
 * contabilizam venda no módulo de Metas. Habilitação RADAR 50K (e quaisquer
 * outros serviços) NÃO contam. Match tolerante a acento/caixa/separador.
 */
function servicoContaComoVenda(servico: string | null | undefined): boolean {
    // Remove acentos (ã→a, ç→c…) ANTES de filtrar, senão "revisão"→"reviso" e nada casa.
    const s = (servico ?? "")
        .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira diacríticos (ã→a, ç→c)
        .toLowerCase();
    const ehRevisaoRadar = s.includes("revisao") && s.includes("radar");
    return ehRevisaoRadar && (s.includes("150k") || s.includes("ilimitad"));
}

function isComercialOrAdmin(role: string) {
    return isAdminRole(role) || role === "FINANCEIRO" || role === "Lider Comercial" || role === "COMERCIAL";
}

// ─── Schemas Zod ─────────────────────────────────────────────────────────────

const SocioSchema = z.object({
    nome: z.string().min(1),
    telefone: z.string().optional().default(""),
    dataNascimento: z.string().optional().default(""),
    vinculo: z.string().optional().default(""),
    obs: z.string().optional().default(""),
});

// Fase 3.6 do Cliente Master (2026-08-14): identificação da empresa passa a ser
// resolução/criação de `Cliente` por CNPJ — cnpj/razaoSocial/nomeFantasia/etc não
// são mais gravados como campos próprios de ContratoComercial. Duas formas de
// identificar a empresa: (1) `cnpj` real, resolvido OU CRIADO em `Cliente` (o BPM
// ainda não é a porta de entrada real de Cliente novo — time comercial usa CRM
// externo hoje; bloquear quebraria o fluxo diário, diferente de Extratos/Operacional);
// (2) `clienteId` explícito, usado pelo fluxo "Empresa em Constituição" — sempre um
// `Cliente` já existente com `cnpj: null` (criado no BPM), NUNCA cria um novo.
const IdentificacaoEmpresaSchema = z.union([
    z.object({
        cnpj: z.string().min(14).max(18),
        razaoSocial: z.string().min(1),
        nomeFantasia: z.string().optional(),
        dataConstituicao: z.string().optional(),
        regimeTributario: z.string().optional(),
        uf: z.string().optional(),
    }),
    z.object({
        clienteId: z.number().int().positive(),
    }),
]);

const CriarContratoSchema = z.object({
    valorContrato: z.number().positive(),
    formaPagamento: z.string().min(1),
    servico: z.string().min(1),
    canalAquisicao: z.string().min(1),
    canalOutro: z.string().trim().max(200).optional(),
    indicadoPorParceiroId: z.number().int().positive().optional(),
    parceiroNaoCadastrado: ParceiroNaoCadastradoInputSchema.optional(),
    closerNome: z.string().min(1),
    mes: z.number().int().min(1).max(12),
    ano: z.number().int().min(2024).max(2099),
    socios: z.array(SocioSchema).optional(),
}).and(IdentificacaoEmpresaSchema);

const AtualizarContratoSchema = z.object({
    id: z.string().cuid(),
    valorContrato: z.number().positive(),
    formaPagamento: z.string().min(1),
    servico: z.string().min(1),
    canalAquisicao: z.string().min(1),
    canalOutro: z.string().trim().max(200).optional(),
    indicadoPorParceiroId: z.number().int().positive().optional(),
    parceiroNaoCadastrado: ParceiroNaoCadastradoInputSchema.optional(),
    closerNome: z.string().min(1),
    socios: z.array(SocioSchema).optional(),
}).and(IdentificacaoEmpresaSchema);

/**
 * Resolve o `Cliente` master a partir da identificação recebida no formulário —
 * por `clienteId` explícito (fluxo "Empresa em Constituição": Cliente já existe,
 * cnpj null, NUNCA cria) ou por `cnpj` (resolve OU CRIA, ver nota acima do schema).
 */
async function resolverClienteDoContrato(
    d: { cnpj: string; razaoSocial: string; nomeFantasia?: string; dataConstituicao?: string; regimeTributario?: string; uf?: string }
    | { clienteId: number },
): Promise<{ success: true; clienteId: number } | { success: false; error: string }> {
    if ("clienteId" in d) {
        const cliente = await db.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } });
        if (!cliente) return { success: false, error: "Empresa em constituição não encontrada" };
        return { success: true, clienteId: cliente.id };
    }

    const cnpjNormalizado = d.cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const existente = await db.cliente.findUnique({ where: { cnpj: cnpjNormalizado }, select: { id: true } });
    if (existente) return { success: true, clienteId: existente.id };

    try {
        const novo = await db.cliente.create({
            data: {
                cnpj: cnpjNormalizado,
                razaoSocial: d.razaoSocial,
                nomeFantasia: d.nomeFantasia ?? null,
                dataConstituicao: d.dataConstituicao ?? null,
                regimeTributario: d.regimeTributario ?? null,
                uf: d.uf ?? null,
            },
            select: { id: true },
        });
        return { success: true, clienteId: novo.id };
    } catch (err) {
        // Corrida rara entre o findUnique e o create (P2002) — resolve de novo por CNPJ.
        const fallback = await db.cliente.findUnique({ where: { cnpj: cnpjNormalizado }, select: { id: true } });
        if (fallback) return { success: true, clienteId: fallback.id };
        console.error("resolverClienteDoContrato:", err);
        return { success: false, error: "Erro ao identificar a empresa" };
    }
}

const ConfirmarFechamentoSchema = z.object({
    id: z.string().cuid(),
    pagamentoConfirmado: z.boolean(),
    pagamentoConfirmadoEm: z.string().optional(),
    contratoAssinado: z.boolean(),
    contratoUrl: z.string().url().optional().or(z.literal("")),
});

function resolverOrigemParceiro(d: {
    canalAquisicao: string;
    canalOutro?: string;
    indicadoPorParceiroId?: number;
    parceiroNaoCadastrado?: ParceiroNaoCadastradoInput;
}) {
    if (d.canalAquisicao === CANAL_PROSPECCAO_ATIVA) {
        const prospeccao = ProspeccaoAtivaSchema.safeParse(d.canalOutro ?? "");
        if (!prospeccao.success) {
            return { success: false as const, error: prospeccao.error.issues[0].message };
        }

        return {
            success: true as const,
            canalOutro: prospeccao.data,
            indicadoPorParceiroId: null,
        };
    }

    if (d.canalAquisicao === "Outro" && !d.canalOutro?.trim()) {
        return { success: false as const, error: "Descreva o canal de aquisição" };
    }

    if (d.canalAquisicao !== CANAL_INDICACAO_PARCEIRO) {
        return {
            success: true as const,
            canalOutro: d.canalAquisicao === "Outro" ? d.canalOutro!.trim() : null,
            indicadoPorParceiroId: null,
        };
    }

    const temCadastrado = Boolean(d.indicadoPorParceiroId);
    const temPendente = Boolean(d.parceiroNaoCadastrado);
    if (temCadastrado === temPendente) {
        return { success: false as const, error: "Selecione um parceiro cadastrado ou informe o parceiro não cadastrado" };
    }

    return {
        success: true as const,
        canalOutro: d.parceiroNaoCadastrado
            ? serializarParceiroNaoCadastrado(d.parceiroNaoCadastrado)
            : null,
        indicadoPorParceiroId: d.parceiroNaoCadastrado ? null : d.indicadoPorParceiroId!,
    };
}

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
    const origem = resolverOrigemParceiro(d);
    if (!origem.success) return origem;

    const clienteResolvido = await resolverClienteDoContrato(d);
    if (!clienteResolvido.success) return { success: false as const, error: clienteResolvido.error };

    try {
        const contrato = await db.contratoComercial.create({
            data: {
                clienteId: clienteResolvido.clienteId,
                valorContrato: d.valorContrato,
                formaPagamento: d.formaPagamento,
                servico: d.servico,
                canalAquisicao: d.canalAquisicao,
                canalOutro: origem.canalOutro,
                indicadoPorParceiroId: origem.indicadoPorParceiroId,
                closerNome: d.closerNome,
                mes: d.mes,
                ano: d.ano,
                socios: d.socios ?? [],
                usuarioId: Number(userId),
            },
        });

        // Sincronização com o CS&NPS NÃO acontece na criação do contrato — só na
        // confirmação de pagamento (`confirmarFechamento`), decisão de 2026-07-13
        // (ver decisions.md, "sincronização move de criação do contrato para
        // confirmação de pagamento").

        revalidatePath("/PainelAlpha/Metas");
        return { success: true as const, contrato };
    } catch (err) {
        console.error("criarContrato:", err);
        return { success: false as const, error: "Erro ao criar contrato" };
    }
}

export async function atualizarContrato(raw: unknown) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };
    const userId = Number((session.user as { id?: string }).id);
    const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    const role = dbUser?.role ?? "";
    if (!isComercialOrAdmin(role)) return { success: false as const, error: "Sem permissão" };

    const parsed = AtualizarContratoSchema.safeParse(raw);
    if (!parsed.success) return { success: false as const, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const origem = resolverOrigemParceiro(d);
    if (!origem.success) return origem;

    const contrato = await db.contratoComercial.findUnique({ where: { id: d.id } });
    if (!contrato) return { success: false as const, error: "Contrato não encontrado" };
    if (!isAdminOrCeo(role) && contrato.usuarioId !== userId) {
        return { success: false as const, error: "Sem permissão" };
    }

    const clienteResolvido = await resolverClienteDoContrato(d);
    if (!clienteResolvido.success) return { success: false as const, error: clienteResolvido.error };

    try {
        const atualizado = await db.contratoComercial.update({
            where: { id: d.id },
            data: {
                clienteId: clienteResolvido.clienteId,
                valorContrato: d.valorContrato,
                formaPagamento: d.formaPagamento,
                servico: d.servico,
                canalAquisicao: d.canalAquisicao,
                canalOutro: origem.canalOutro,
                indicadoPorParceiroId: origem.indicadoPorParceiroId,
                closerNome: d.closerNome,
                socios: d.socios ?? [],
            },
        });
        revalidatePath("/PainelAlpha/Metas");
        return { success: true as const, contrato: atualizado };
    } catch (err) {
        console.error("atualizarContrato:", err);
        return { success: false as const, error: "Erro ao atualizar contrato" };
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
                // Só Revisão RADAR 150K/ILIMITADO contam como venda; 50K (e outros) não.
                contaComVenda: servicoContaComoVenda(contrato.servico),
                pagamentoConfirmado: d.pagamentoConfirmado,
                pagamentoConfirmadoEm: d.pagamentoConfirmadoEm
                    ? new Date(d.pagamentoConfirmadoEm)
                    : new Date(),
                contratoAssinado: d.contratoAssinado,
                contratoUrl: d.contratoUrl || null,
            },
            include: { cliente: { select: { indicacoes: { where: { status: "ATIVA" }, select: { parceiroId: true } } } } },
        });

        // Sincroniza com o CS&NPS na confirmação de pagamento (efeito colateral
        // resiliente — nunca reverte o fechamento do contrato). Ver decisions.md
        // 2026-07-13 ("sincronização move de criação do contrato para confirmação
        // de pagamento"). Fase 3.6 do Cliente Master (2026-08-14): `criarRegistroClienteAPartirDeContrato`
        // recebe `clienteId` já resolvido — cuida só do `ClienteServico`, `Cliente`
        // já existe (resolvido/criado na criação do contrato). Funciona igual para
        // empresa "em constituição" (clienteId sempre existe, com ou sem CNPJ).
        try {
            const resultadoSync = await criarRegistroClienteAPartirDeContrato({
                clienteId: atualizado.clienteId,
                servico: atualizado.servico,
                dataContratacao: atualizado.pagamentoConfirmadoEm
                    ? atualizado.pagamentoConfirmadoEm.toISOString()
                    : new Date().toISOString(),
            });

            // Vínculo de indicação de parceiro: só faz sentido na PRIMEIRA criação real
            // do registro (não em reativação nem quando já existia ativo). Fase 3.6 do
            // Cliente Master — `atualizado.clienteId` já é o id certo direto (não precisa
            // mais buscar `Cliente` por CNPJ como bridge temporário, e elimina a
            // normalização incorreta que descartava letras de CNPJ alfanumérico).
            if (resultadoSync.criado && atualizado.indicadoPorParceiroId) {
                try {
                    if (atualizado.cliente.indicacoes.length === 0) {
                        await db.indicacao.create({
                            data: {
                                parceiroId: atualizado.indicadoPorParceiroId,
                                clienteId: atualizado.clienteId,
                                criadoPorId: userId,
                            },
                        });
                        const { recalcularNivel } = await import("@/actions/parceiros");
                        await recalcularNivel(atualizado.indicadoPorParceiroId);
                        revalidatePath("/PainelAlpha/Parceiros");
                    }
                } catch (indErr) {
                    console.error("vincular indicação parceiro:", indErr);
                }
            }

            revalidatePath("/PainelAlpha/CadastroClientes");
        } catch (clienteErr) {
            console.error("sincronizar cliente CS/NPS na confirmação:", clienteErr);
        }

        revalidatePath("/PainelAlpha/Metas");

        await pusherServer
            .trigger("private-metas-alpha", "venda-confirmada", {
                usuarioId: atualizado.usuarioId,
                contaComVenda: atualizado.contaComVenda,
            })
            .catch((err) => console.error("[confirmarFechamento:pusher]", err));

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

const SELECT_CLIENTE_CONTRATO = {
    cnpj: true,
    razaoSocial: true,
    nomeFantasia: true,
    dataConstituicao: true,
    regimeTributario: true,
    uf: true,
} as const;

/**
 * Achata `ContratoComercial` + `Cliente` no shape que os componentes já esperavam
 * (campos cadastrais direto no objeto, ex: `contrato.razaoSocial`) — Fase 3.6 do
 * Cliente Master: os campos migraram para `Cliente`, mas a UI não precisa mudar.
 */
function achatarContrato<T extends { cliente: { cnpj: string | null; razaoSocial: string; nomeFantasia: string | null; dataConstituicao: string | null; regimeTributario: string | null; uf: string | null } }>(
    contrato: T,
) {
    const { cliente, ...resto } = contrato;
    return { ...resto, ...cliente };
}

export async function getContratos(options: GetContratosOptions) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const role = (session.user as { role?: string }).role ?? "";
    const userId = Number((session.user as { id?: string }).id);

    const { mes, ano, adminView, filtroUsuarioId } = options;

    let whereUsuarioId: number | undefined;

    const podeVerTodos = isAdminOrCeo(role) || role === "FINANCEIRO";
    if (podeVerTodos && adminView) {
        // admin/financeiro vê todos — filtra por colaborador se filtroUsuarioId passado
        whereUsuarioId = filtroUsuarioId;
    } else {
        // comercial só vê o próprio
        whereUsuarioId = userId;
    }

    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 1);
    const usuarioFilter = whereUsuarioId !== undefined ? { usuarioId: whereUsuarioId } : {};

    try {
        const [enviados, fechados, arquivados] = await Promise.all([
            // Enviados: sem filtro de mês — aparecem independente do mês selecionado
            db.contratoComercial.findMany({
                where: { status: "ENVIADO", arquivado: false, ...usuarioFilter },
                include: {
                    usuario: { select: { id: true, nome: true, imagemUrl: true } },
                    observacoes: { orderBy: { criadoEm: "desc" } },
                    cliente: { select: SELECT_CLIENTE_CONTRATO },
                },
                orderBy: { createdAt: "desc" },
            }),
            // Fechados: filtrados pelo mês selecionado via pagamentoConfirmadoEm
            db.contratoComercial.findMany({
                where: {
                    status: "FECHADO",
                    arquivado: false,
                    pagamentoConfirmadoEm: { gte: inicioMes, lt: fimMes },
                    ...usuarioFilter,
                },
                include: {
                    usuario: { select: { id: true, nome: true, imagemUrl: true } },
                    observacoes: { orderBy: { criadoEm: "desc" } },
                    cliente: { select: SELECT_CLIENTE_CONTRATO },
                },
                orderBy: { pagamentoConfirmadoEm: "desc" },
            }),
            // Arquivados: sem filtro de mês — mesmo comportamento dos enviados
            db.contratoComercial.findMany({
                where: { status: "ENVIADO", arquivado: true, ...usuarioFilter },
                include: {
                    usuario: { select: { id: true, nome: true, imagemUrl: true } },
                    observacoes: { orderBy: { criadoEm: "desc" } },
                    cliente: { select: SELECT_CLIENTE_CONTRATO },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        return {
            success: true as const,
            enviados: enviados.map(achatarContrato),
            fechados: fechados.map(achatarContrato),
            arquivados: arquivados.map(achatarContrato),
        };
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

/**
 * Busca um `Cliente` já cadastrado no CRM pelo CNPJ, para pré-visualização no
 * formulário de novo contrato — Fase 3.6 do Cliente Master. Não bloqueia (ver
 * `resolverClienteDoContrato`, que resolve OU CRIA na hora de salvar); serve só
 * para o usuário ver se a empresa já existe antes de confirmar.
 */
export async function buscarClienteParaContrato(cnpj: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const cnpjNormalizado = cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cnpjNormalizado.length < 11) return { success: false as const, error: "CNPJ incompleto" };

    try {
        const cliente = await db.cliente.findUnique({
            where: { cnpj: cnpjNormalizado },
            select: { cnpj: true, razaoSocial: true, nomeFantasia: true, dataConstituicao: true, regimeTributario: true, uf: true },
        });
        return { success: true as const, cliente };
    } catch (err) {
        console.error("buscarClienteParaContrato:", err);
        return { success: false as const, error: "Erro ao consultar o CRM" };
    }
}

/**
 * Lista `Cliente`s "em constituição" (cnpj null) já cadastrados no BPM — Fase 3.6
 * do Cliente Master. O fluxo "Empresa em Constituição" do Metas NUNCA cria um
 * `Cliente` novo, só vincula um já existente (única porta de entrada é o BPM).
 */
export async function listarClientesEmConstituicao() {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    try {
        const clientes = await db.cliente.findMany({
            where: { cnpj: null },
            select: { id: true, razaoSocial: true },
            orderBy: { razaoSocial: "asc" },
        });
        return { success: true as const, clientes };
    } catch (err) {
        console.error("listarClientesEmConstituicao:", err);
        return { success: false as const, error: "Erro ao listar empresas em constituição" };
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

export async function getProspeccoesAtivas() {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    const userId = Number((session.user as { id?: string }).id);
    if (!Number.isInteger(userId) || userId <= 0) {
        return { success: false as const, error: "Não autorizado" };
    }

    const usuario = await db.usuarios.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    if (!isComercialOrAdmin(usuario?.role ?? "")) {
        return { success: false as const, error: "Sem permissão" };
    }

    try {
        const contratos = await db.contratoComercial.findMany({
            where: {
                canalAquisicao: CANAL_PROSPECCAO_ATIVA,
                canalOutro: { not: null },
            },
            select: { canalOutro: true },
            orderBy: { updatedAt: "desc" },
            take: 500,
        });

        return {
            success: true as const,
            prospeccoes: normalizarCatalogoProspeccoes(contratos.map((contrato) => contrato.canalOutro)),
        };
    } catch (err) {
        console.error("getProspeccoesAtivas:", err);
        return { success: false as const, error: "Erro ao buscar prospecções ativas" };
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

    for (const nome of SERVICOS_COMERCIAIS_PADRAO) {
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


// ─── Arquivar / Restaurar ─────────────────────────────────────────────────────

export async function arquivarContrato(id: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };
    const userId = Number((session.user as { id?: string }).id);
    const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    if (!isAdminOrCeo(dbUser?.role ?? "")) return { success: false as const, error: "Sem permissão" };

    try {
        await db.contratoComercial.update({
            where: { id },
            data: { arquivado: true, arquivadoEm: new Date() },
        });
        return { success: true as const };
    } catch {
        return { success: false as const, error: "Erro ao arquivar" };
    }
}

export async function restaurarContrato(id: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };
    const userId = Number((session.user as { id?: string }).id);
    const dbUser = await db.usuarios.findUnique({ where: { id: userId }, select: { role: true } });
    if (!isAdminOrCeo(dbUser?.role ?? "")) return { success: false as const, error: "Sem permissão" };

    try {
        await db.contratoComercial.update({
            where: { id },
            data: { arquivado: false, arquivadoEm: null },
        });
        return { success: true as const };
    } catch {
        return { success: false as const, error: "Erro ao restaurar" };
    }
}

// ─── Observações ─────────────────────────────────────────────────────────────

export async function criarObservacaoContrato(
    contratoId: string,
    texto: string,
    tipo: "POSITIVO" | "NEGATIVO" | "NA",
) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };
    if (!texto.trim()) return { success: false as const, error: "Observação vazia" };

    try {
        const obs = await db.observacaoContrato.create({
            data: { contratoId, texto: texto.trim(), tipo },
        });
        return { success: true as const, obs };
    } catch {
        return { success: false as const, error: "Erro ao salvar observação" };
    }
}

export async function getObservacoesContrato(contratoId: string) {
    const session = await auth();
    if (!session?.user) return { success: false as const, error: "Não autorizado" };

    try {
        const observacoes = await db.observacaoContrato.findMany({
            where: { contratoId },
            orderBy: { criadoEm: "desc" },
        });
        return { success: true as const, observacoes };
    } catch {
        return { success: false as const, error: "Erro ao buscar observações" };
    }
}
