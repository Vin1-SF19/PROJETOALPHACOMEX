"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import { canAccessPreAnalise } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";

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

export async function excluirEmpresasAction(ids: number[]) {
    try {
        await db.radar_fiscal.deleteMany({
            where: { id: { in: ids } }
        });
        revalidatePath("/PainelAlpha/RadarFiscal");
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function protocolarNoRadarAction(input: unknown) {
    if (!await canAccessPreAnalise(await auth(), "tributario")) return { success: false, error: "Não autorizado" };
    const dados = input && typeof input === "object" && !Array.isArray(input)
        ? input as Record<string, unknown>
        : null;
    if (!dados || dados.consultaStatus !== "completa" || !String(dados.qualificacao ?? "").trim() || !String(dados.regime_ea ?? dados.regimeEA ?? "").trim()) {
        return { success: false, error: "Consulta tributária incompleta; tente novamente antes de protocolar" };
    }
    const cnpjLimpo = String(dados.cnpj ?? "").replace(/\D/g, "");
    if (!validarCnpj(cnpjLimpo)) return { success: false, error: "CNPJ inválido" };
    const optionalString = (...values: unknown[]) => {
        const value = values.find(Boolean);
        return value == null ? null : String(value);
    };
    try {
        const payload = {
            razao_social: optionalString(dados.razao_social, dados.razaoSocial),
            nome_fantasia: optionalString(dados.nome_fantasia, dados.nomeFantasia),
            qualificacao: optionalString(dados.qualificacao),
            situacao_cadastral: optionalString(dados.situacao_cadastral, dados.situacao),
            municipio: optionalString(dados.municipio),
            uf: optionalString(dados.uf),
            data_abertura: optionalString(dados.data_abertura, dados.abertura),
            capital_social: String(dados.capital_social || dados.capitalSocial || "0"),
            regime_receita: optionalString(dados.regime_receita, dados.regimeReceita),
            regime_ea: optionalString(dados.regime_ea, dados.regimeEA),
            divida_tributaria: Number(dados.divida_tributaria || 0),
            data_consulta: new Date().toISOString(),
            perse: optionalString(dados.perse) || "NÃO",
            perse_anexo: optionalString(dados.perse_anexo, dados.anexo) || "NENHUM",
            fonte: "MANUAL",
            perse_motivo: optionalString(dados.cnae_perse, dados.cnaeEncontrado, dados.perse_motivo) || "N/A",
            data_opcao_simples: optionalString(dados.data_opcao_simples, dados.dataOpcao),
            data_exclusao_simples: optionalString(dados.exclusao_simples, dados.dataExclusao, dados.data_exclusao_simples),
            
            historico_regime: typeof dados.historico_regime === 'string' ? dados.historico_regime : JSON.stringify(dados.historico_regime || dados.historicoRegime || []),
            cnaes: typeof dados.cnaes === 'string' ? dados.cnaes : JSON.stringify(dados.cnaes || []),
            qsa: typeof dados.qsa === 'string' ? dados.qsa : JSON.stringify(dados.qsa || [])
        };

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
    } catch {
        console.error("Falha ao protocolar consulta no Radar Fiscal");
        return { success: false, error: "Não foi possível protocolar a consulta" };
    }
}
