"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { canAccessPreAnalise } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";
import type { Prisma } from "@prisma/client";

type CadastroConsulta = {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string | null;
    situacao?: string | null;
    uf?: string | null;
    municipio?: string | null;
    capitalSocial?: string | number | null;
};

type ConsultaPayload = {
    rfb: { dados: CadastroConsulta };
    empresaqui?: { dados?: { cnpj?: string | null; regimeEA?: string | null; qualificacao?: string | null } | null };
    radar?: { dados?: { submodalidade?: string | null } | null };
    extra?: { nomeResponsavel?: string; telefone?: string; observacoes?: string };
};

async function acessoPermitido() {
    return await canAccessPreAnalise(await auth(), "tributario");
}

export async function upsertConsulta(payload: unknown) {
    if (!await acessoPermitido()) return { error: "Não autorizado" };
    if (!payload || typeof payload !== "object") return { error: "Dados inválidos" };
    const input = payload as ConsultaPayload;
    const { rfb, empresaqui, radar, extra } = input;

    if (typeof rfb?.dados?.cnpj !== "string" || typeof rfb.dados.razaoSocial !== "string") {
        return { error: "Dados cadastrais incompletos" };
    }

    const cnpjLimpo = rfb.dados.cnpj.replace(/\D/g, "");
    if (!validarCnpj(cnpjLimpo)) return { error: "CNPJ inválido" };
    const cnpjTributario = String(empresaqui?.dados?.cnpj ?? "").replace(/\D/g, "");
    if (cnpjTributario && cnpjTributario !== cnpjLimpo) return { error: "CNPJ divergente na consulta tributária" };

    try {
        // Fase 3.4 do Cliente Master — resolve o Cliente já cadastrado por CNPJ,
        // se existir. `clienteId` é nullable: consultar um CNPJ que ainda não é
        // Cliente continua funcionando normalmente, sem bloquear (mesma regra
        // de snapshot próprio — esta tabela não depende de Cliente existir).
        const cliente = await db.cliente.findUnique({ where: { cnpj: cnpjLimpo }, select: { id: true } });

        const registro = await db.consultaPreAnalise.upsert({
            where: { cnpj: cnpjLimpo },
            update: {
                razaoSocial: rfb.dados.razaoSocial,
                nomeFantasia: rfb.dados.nomeFantasia,
                situacao: rfb.dados.situacao,
                uf: rfb.dados.uf,
                municipio: rfb.dados.municipio,
                regimeEA: empresaqui?.dados?.regimeEA ?? null,
                qualificacao: empresaqui?.dados?.qualificacao ?? null,
                submodalidade: radar?.dados?.submodalidade,
                capitalSocial: Number(rfb.dados.capitalSocial) || 0,
                dadosBrutos: payload as Prisma.InputJsonValue,
                nomeResponsavel: extra?.nomeResponsavel,
                telefoneContato: extra?.telefone,
                observacoes: extra?.observacoes,
                clienteId: cliente?.id ?? null,
            },
            create: {
                cnpj: cnpjLimpo,
                razaoSocial: rfb.dados.razaoSocial,
                nomeFantasia: rfb.dados.nomeFantasia,
                situacao: rfb.dados.situacao,
                uf: rfb.dados.uf,
                municipio: rfb.dados.municipio,
                regimeEA: empresaqui?.dados?.regimeEA ?? null,
                qualificacao: empresaqui?.dados?.qualificacao ?? null,
                submodalidade: radar?.dados?.submodalidade,
                capitalSocial: Number(rfb.dados.capitalSocial) || 0,
                dadosBrutos: payload as Prisma.InputJsonValue,
                nomeResponsavel: extra?.nomeResponsavel,
                telefoneContato: extra?.telefone,
                observacoes: extra?.observacoes,
                clienteId: cliente?.id ?? null,
            },
        });

        return { success: true, id: registro.id };
    } catch (error) {
        console.error("Erro ao salvar consulta:", error);
        return { error: "Erro interno no banco de dados" };
    }
}

export async function atualizarRadar(cnpj: string, radarDados: Record<string, unknown> & { submodalidade?: string | null }) {
    if (!await acessoPermitido()) return { error: "Não autorizado" };
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (!validarCnpj(cnpjLimpo)) return { error: "CNPJ inválido" };

    try {
        const existing = await db.consultaPreAnalise.findUnique({
            where: { cnpj: cnpjLimpo },
        });

        if (!existing) {
            console.error(`atualizarRadar: registro não encontrado para CNPJ ${cnpjLimpo}`);
            return { error: "Consulta não encontrada no banco" };
        }

        const dadosAtuais = existing.dadosBrutos && typeof existing.dadosBrutos === "object" && !Array.isArray(existing.dadosBrutos)
            ? existing.dadosBrutos as Record<string, unknown>
            : {};
        const novosDados = {
            ...dadosAtuais,
            radar: { dados: radarDados, consultadoEm: new Date().toISOString() },
        };

        await db.consultaPreAnalise.update({
            where: { cnpj: cnpjLimpo },
            data: {
                submodalidade: radarDados?.submodalidade ?? null,
                dadosBrutos: novosDados as Prisma.InputJsonValue,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar radar:", error);
        return { error: "Erro ao salvar dados do Radar" };
    }
}

export async function buscarHistorico() {
    if (!await acessoPermitido()) return { error: "Não autorizado" };
    try {
        const consultas = await db.consultaPreAnalise.findMany({
            take: 20,
            orderBy: { updatedAt: "desc" }
        });
        return { success: true, data: consultas };
    } catch {
        return { error: "Erro ao carregar histórico" };
    }
}
