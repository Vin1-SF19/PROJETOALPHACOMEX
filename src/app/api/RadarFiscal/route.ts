import { NextResponse } from "next/server";
import { getReceitaData } from "../ReceitaFederal/route"; 
import { getEmpresaAquiData } from "../EmpresaAqui/route";

import db from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const cnpj = (searchParams.get("cnpj") || "").replace(/\D/g, "");

        if (!cnpj || cnpj.length !== 14) return NextResponse.json({ error: "CNPJ obrigatório" }, { status: 400 });

        const receita: any = await getReceitaData(cnpj);

        let ea: any = {};
        try {
            ea = await getEmpresaAquiData(cnpj);
        } catch (e) { 
            console.log("Falha ao obter dados do EmpresaAqui via função interna"); 
        }

        const anexo1 = [
            "18.13-0-01", "43.30-4-02", "46.89-3-99", "52.11-7-99", "55.10-8-01", "55.10-8-02", "55.90-6-01", "55.90-6-02",
            "55.90-6-03", "55.90-6-99", "56.20-1-01", "56.20-1-02", "59.11-1-02", "59.14-6-00", "73.12-2-00", "73.19-0-01",
            "74.20-0-01", "74.20-0-04", "74.90-1-01", "74.90-1-04", "74.90-1-05", "77.21-7-00", "77.29-2-02", "77.33-1-00",
            "77.39-0-03", "77.39-0-99", "78.10-8-00", "80.11-1-01", "81.11-7-00", "82.30-0-01", "82.30-0-02", "85.92-9-01",
            "90.01-9-01", "90.01-9-02", "90.01-9-03", "90.01-9-04", "90.01-9-06", "90.01-9-99", "90.03-5-00", "93.11-5-00",
            "93.12-3-00", "93.19-1-01", "93.29-8-01"
        ];

        const anexo2 = [
            "03.11-6-04", "03.12-4-04", "11.12-7-00", "28.69-1-00", "33.17-1-01", "33.17-1-02", "47.63-6-05", "47.89-0-01",
            "49.23-0-02", "49.29-9-01", "49.29-9-02", "49.29-9-03", "49.29-9-04", "50.11-4-02", "50.12-2-02", "50.99-8-01",
            "50.30-1-01", "50.30-1-02", "50.30-1-03", "51.12-9-99", "52.31-1-01", "52.31-1-02", "56.11-2-01", "56.11-2-03",
            "56.11-2-04", "56.11-2-05", "70.20-4-00", "73.19-0-04", "74.90-1-02", "74.90-1-99", "77.11-0-00", "77.19-5-99",
            "79.11-2-00", "79.12-1-00", "79.90-2-00", "85.91-1-00", "85.92-9-99", "90.02-7-01", "91.02-3-01", "91.03-1-00",
            "93.19-1-99", "93.21-2-00", "93.29-8-04", "93.29-8-99", "94.93-6-00"
        ];

        const todosCnaesBrutos = [
            ...(receita?.atividade_principal || []),
            ...(receita?.atividades_secundarias || [])
        ].map(item => item?.code || "").filter(Boolean);

        const temAnexo1 = todosCnaesBrutos.some(cnae => anexo1.includes(cnae));
        const temAnexo2 = todosCnaesBrutos.some(cnae => anexo2.includes(cnae));

        let anexoPertencente = "NÃO PERTENCE";
        if (temAnexo1 && temAnexo2) anexoPertencente = "ANEXO 1 / ANEXO 2";
        else if (temAnexo1) anexoPertencente = "ANEXO 1";
        else if (temAnexo2) anexoPertencente = "ANEXO 2";

        const parseData = (d: string) => {
            if (!d || d === "null" || d === "00/00/0000") return null;
            const [day, month, year] = d.split("/").map(Number);
            return new Date(year, month - 1, day);
        };

        const dataAbertura = parseData(receita.abertura_bruta || receita.dataConstituicao);
        
        const dataExclusaoSimples = receita.simples?.data_exclusao || ea?.data_exc_simples || null;
        const dataExclusao = parseData(dataExclusaoSimples);

        const limiteAbertura = new Date(2022, 2, 18);
        const limiteExclusao = new Date(2023, 0, 31);
        const hoje = new Date();
        const anosEmpresa = dataAbertura ? (hoje.getFullYear() - dataAbertura.getFullYear()) : 0;

        let isPerse = "NÃO";
        const aberturaOk = dataAbertura && dataAbertura <= limiteAbertura;
        const isSimples = receita.optante_simples === true;

        let regimeOk = false;
        if (!isSimples) {
            if (!receita.data_opcao || receita.data_opcao === "null") {
                regimeOk = true;
            } else if (dataExclusao && dataExclusao <= limiteExclusao) {
                regimeOk = true;
            }
        }

        if (anexoPertencente !== "NÃO PERTENCE" && aberturaOk && regimeOk) {
            isPerse = "SIM";
        }

        let totalDivida = 0;
        if (ea) {
            Object.keys(ea).forEach(key => {
                if (!isNaN(Number(key)) && ea[key]?.dividas_valor) {
                    const v = parseFloat(String(ea[key].dividas_valor).replace(",", "."));
                    if (!isNaN(v)) totalDivida += v;
                }
            });
        }

        const isSimplesEA = String(ea?.opcao_simples || "").toUpperCase() === "S";

        let regimeLimpo: string;
        if (isSimplesEA) {
            // opcao_simples é a fonte autoritativa para Simples Nacional
            regimeLimpo = "SIMPLES NACIONAL";
        } else {
            const regimeEAraw = String(ea?.regime_tributario || "NÃO INFORMADO");
            const stripAno = (s: string) => s.replace(/ANO\s+\d{4}\s+/i, "").trim();

            if (regimeEAraw.includes(";")) {
                const partes = regimeEAraw.split(";").map((p: string) => p.trim()).filter(Boolean);
                // Ordena por ano desc para garantir que pegamos o regime mais recente
                const comAno = partes.map(p => {
                    const m = p.match(/ANO\s+(\d{4})\s+/i);
                    return { ano: m ? parseInt(m[1]) : 0, regime: stripAno(p) };
                });
                comAno.sort((a, b) => b.ano - a.ano);
                regimeLimpo = comAno[0]?.regime || stripAno(partes[partes.length - 1]);
            } else {
                regimeLimpo = stripAno(regimeEAraw);
            }
        }

        const regimeEA = String(regimeLimpo).toUpperCase();

        let qualificacaoFinal = "DESQUALIFICADO";
        if (isSimplesEA || anosEmpresa < 3) {
            qualificacaoFinal = "DESQUALIFICADO";
        } else if (anosEmpresa >= 5 && regimeEA.includes("REAL")) {
            qualificacaoFinal = "PREMIUM";
        } else if (anosEmpresa >= 3 && (regimeEA.includes("PRESUMIDO") || regimeEA.includes("REAL") || !isSimplesEA)) {
            qualificacaoFinal = "QUALIFICADO";
        }

        return NextResponse.json({
            cnpj,
            qualificacao: qualificacaoFinal,
            razaoSocial: (receita.razaoSocial || "").toUpperCase(),
            nomeFantasia: (receita.nomeFantasia || "SEM NOME FANTASIA").toUpperCase(),
            perse: isPerse,
            perse_anexo: anexoPertencente,
            todosCnaesBrutos: todosCnaesBrutos,
            situacao: (receita.situacao || "N/A").toUpperCase(),
            municipio: (receita.municipio || "").toUpperCase(),
            uf: (receita.uf || "").toUpperCase(),
            abertura: receita.dataConstituicao || "",
            capitalSocial: receita.capitalSocial,
            dataOpcao: receita.data_opcao,
            
            dataExclusao: dataExclusaoSimples && dataExclusaoSimples.length === 8 && !dataExclusaoSimples.includes("/")
                ? `${dataExclusaoSimples.substring(6, 8)}/${dataExclusaoSimples.substring(4, 6)}/${dataExclusaoSimples.substring(0, 4)}`
                : dataExclusaoSimples || "---",

            regimeReceita: (receita.regimeTributario || "N/A").toUpperCase(),
            regimeEA: regimeLimpo.toUpperCase(),
            divida_tributaria: totalDivida,
            historicoRegime: ea?.historicoRegimePorAno || [],
            cnaes: { 
                principal: receita.atividade_principal || [], 
                secundarios: receita.atividades_secundarias || [] 
            }
        });

    } catch (err: any) {
        console.error("ERRO RADAR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}