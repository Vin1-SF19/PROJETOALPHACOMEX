"use server";

import db from "@/lib/prisma";

export async function upsertConsulta(payload: any) {
    const { rfb, empresaqui, radar, extra } = payload;

    if (!rfb?.dados?.cnpj) return { error: "CNPJ não identificado" };

    const cnpjLimpo = rfb.dados.cnpj.replace(/\D/g, "");

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
                regimeEA: empresaqui?.dados?.regimeEA,
                qualificacao: empresaqui?.dados?.qualificacao,
                submodalidade: radar?.dados?.submodalidade,
                capitalSocial: Number(rfb.dados.capitalSocial) || 0,
                dadosBrutos: payload,
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
                regimeEA: empresaqui?.dados?.regimeEA,
                qualificacao: empresaqui?.dados?.qualificacao,
                submodalidade: radar?.dados?.submodalidade,
                capitalSocial: Number(rfb.dados.capitalSocial) || 0,
                dadosBrutos: payload,
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

export async function atualizarRadar(cnpj: string, radarDados: any) {
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    if (!cnpjLimpo) return { error: "CNPJ inválido" };

    try {
        const existing = await db.consultaPreAnalise.findUnique({
            where: { cnpj: cnpjLimpo },
        });

        if (!existing) {
            console.error(`atualizarRadar: registro não encontrado para CNPJ ${cnpjLimpo}`);
            return { error: "Consulta não encontrada no banco" };
        }

        const dadosAtuais = (existing.dadosBrutos as any) || {};
        const novosDados = {
            ...dadosAtuais,
            radar: { dados: radarDados, consultadoEm: new Date().toISOString() },
        };

        await db.consultaPreAnalise.update({
            where: { cnpj: cnpjLimpo },
            data: {
                submodalidade: radarDados?.submodalidade ?? null,
                dadosBrutos: novosDados,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Erro ao salvar radar:", error);
        return { error: "Erro ao salvar dados do Radar" };
    }
}

export async function buscarHistorico() {
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
