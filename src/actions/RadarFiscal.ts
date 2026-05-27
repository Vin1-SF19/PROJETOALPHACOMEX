"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function verificarCnpjsNoRadarFiscal(cnpjs: string[]) {
    try {
        const registros = await db.radar_fiscal.findMany({
            where: { cnpj: { in: cnpjs } },
            select: { cnpj: true },
        });
        return { success: true as const, encontrados: registros.map((r) => r.cnpj) };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro desconhecido";
        return { success: false as const, error: msg, encontrados: [] as string[] };
    }
}

export async function protocolarNoRadarAction(dados: any) {
    try {
        const payload = {
            razao_social: dados.razao_social || dados.razaoSocial,
            nome_fantasia: dados.nome_fantasia || dados.nomeFantasia,
            qualificacao: dados.qualificacao || "NORMAL",
            situacao_cadastral: dados.situacao_cadastral || dados.situacao,
            municipio: dados.municipio,
            uf: dados.uf,
            data_abertura: dados.data_abertura || dados.abertura,
            capital_social: String(dados.capital_social || dados.capitalSocial || "0"),
            regime_receita: dados.regime_receita || dados.regimeReceita,
            regime_ea: dados.regime_ea || dados.regimeEA,
            divida_tributaria: Number(dados.divida_tributaria || 0),
            data_consulta: new Date().toISOString(),
            perse: dados.perse || "NÃO",
            perse_anexo: dados.perse_anexo || dados.anexo || "NENHUM",
            fonte: "MANUAL",
            perse_motivo: dados.cnae_perse || dados.cnaeEncontrado || dados.perse_motivo || "N/A",
            data_opcao_simples: dados.data_opcao_simples || dados.dataOpcao || null,
            data_exclusao_simples: dados.exclusao_simples || dados.dataExclusao || dados.data_exclusao_simples || null,
            
            historico_regime: typeof dados.historico_regime === 'string' ? dados.historico_regime : JSON.stringify(dados.historico_regime || dados.historicoRegime || []),
            cnaes: typeof dados.cnaes === 'string' ? dados.cnaes : JSON.stringify(dados.cnaes || []),
            qsa: typeof dados.qsa === 'string' ? dados.qsa : JSON.stringify(dados.qsa || [])
        };

        const cnpjLimpo = String(dados.cnpj).replace(/\D/g, "");

        await db.radar_fiscal.upsert({
            where: { cnpj: cnpjLimpo },
            update: payload,
            create: {
                cnpj: cnpjLimpo,
                ...payload
            }
        });

        revalidatePath("/PainelAlpha/RadarFiscal");
        return { success: true };
    } catch (error: any) {
        console.error("❌ ERRO NO BANCO:", error);
        return { success: false, error: error.message };
    }
}
