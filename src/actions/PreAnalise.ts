"use server";

import db from "@/lib/prisma";
import { auth } from "../../auth";
import { canAccessPreAnalise } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";
import type { Prisma } from "@prisma/client";
import { radarConfirmado } from "@/lib/radar/resultado";

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

    // Fallback é apenas leitura: não substitui o snapshot nem renova sua data.
    if (!radarConfirmado(radarDados) || radarDados.fonteHistorica || radarDados.consultadoEmHistorico) {
        return { success: true, preservado: true };
    }

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

/** Busca somente dados RADAR já persistidos, para fallback quando a publicação atual não contém o CNPJ. */
export async function buscarRadarSalvo(cnpj: string) {
    if (!await acessoPermitido()) return { error: "Não autorizado", data: null };
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (!validarCnpj(cnpjLimpo)) return { error: "CNPJ inválido", data: null };

    try {
        const registro = await db.consultas_radar.findUnique({
            where: { cnpj: cnpjLimpo },
            select: {
                razao_social: true,
                contribuinte: true,
                situacao_radar: true,
                submodalidade: true,
                fonte: true,
                data_consulta: true,
            },
        });
        if (!registro) return { data: null };

        const campoUtil = (valor: string | null) => {
            const normalizado = valor?.trim().toLocaleUpperCase("pt-BR") ?? "";
            return normalizado !== "" && ![
                "NÃO INFORMADO",
                "NÃO ENCONTRADO",
                "NÃO CONSTA",
                "NÃO CONSTA NO ARQUIVO CONSULTADO",
                "NÃO VERIFICADO NA PUBLICAÇÃO CSV",
                "ERRO NA CONSULTA",
                "N/A",
                "N/D",
            ].includes(normalizado);
        };
        const temSituacao = campoUtil(registro.situacao_radar);
        const temSubmodalidade = campoUtil(registro.submodalidade);
        if (!temSituacao && !temSubmodalidade) return { data: null };

        return {
            data: {
                ...(temSituacao ? { situacao: registro.situacao_radar?.trim() } : {}),
                ...(temSubmodalidade ? { submodalidade: registro.submodalidade?.trim() } : {}),
                razaoSocial: registro.razao_social ?? "",
                contribuinte: registro.contribuinte ?? "",
                fonteHistorica: registro.fonte,
                consultadoEmHistorico: registro.data_consulta.toISOString(),
            },
        };
    } catch (error) {
        console.error("Erro ao buscar RADAR salvo:", error);
        return { error: "Erro ao consultar RADAR salvo", data: null };
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
