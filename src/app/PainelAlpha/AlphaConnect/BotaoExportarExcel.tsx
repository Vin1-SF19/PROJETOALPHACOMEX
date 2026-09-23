"use client";

import { FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { RadarFiscalItem } from "./types";

type HistoricoRegime = { ano?: string | number; Ano?: string | number; periodo?: string; regime?: string; Regime?: string };

export function BotaoExportarExcel({ item }: { item: RadarFiscalItem }) {
    const exportar = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Dados Fiscais");

        worksheet.columns = [
            { header: "CAMPO", key: "campo", width: 25 },
            { header: "INFORMAÇÃO", key: "valor", width: 60 }
        ];

        const cnaesBrutos = typeof item.cnaes === 'string' ? JSON.parse(item.cnaes) : item.cnaes;

        const listaCnaes = [
            ...(cnaesBrutos?.principal || []),
            ...(cnaesBrutos?.secundarios || [])
        ].map(c => `${c.code || c.codigo}: ${c.text || c.descricao}`).join("\n");

        const historicoRaw = typeof item.historico_regime === 'string'
            ? JSON.parse(item.historico_regime)
            : (item.historico_regime || item.historicoRegime || []);

        const listaHistorico = Array.isArray(historicoRaw) 
            ? historicoRaw.map((h: HistoricoRegime) => `${h.ano || h.Ano || h.periodo}: ${h.regime || h.Regime}`).join("\n")
            : "N/A";

        const capitalSocialFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.capital_social || item.capitalSocial || 0));
        const dividaFormatada = Number(item.divida_tributaria) > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.divida_tributaria)) : "Sem Dividas";
        const cnpjFormatado = String(item.cnpj).replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

        const dados = [
            ["RAZÃO SOCIAL", (item.razao_social || item.razaoSocial || "").toUpperCase()],
            ["CNPJ", cnpjFormatado],
            ["DATA DE ABERTURA", item.data_abertura || item.abertura || "---"],
            ["SITUAÇÃO", (item.situacao_cadastral || item.situacao || "").toUpperCase()],
            ["CAPITAL SOCIAL", capitalSocialFormatado],
            ["DÍVIDA TRIBUTÁRIA", dividaFormatada],
            ["REGIME RECEITA", (item.regime_receita || item.regimeReceita || "N/A").toUpperCase()],
            ["REGIME EmpresaAqui", (item.regime_ea || item.regimeEA || "N/A").toUpperCase()],
            ["DATA OPÇÃO SIMPLES", item.data_opcao_simples || item.dataOpcao || "---"],
            ["DATA EXCLUSÃO SIMPLES", item.data_exclusao_simples || item.exclusao_simples || "---"],
            ["PERSE", item.perse || "NÃO"],
            ["ANEXO PERSE", item.perse_anexo || "N/A"],
            ["LOCALIZAÇÃO", `${item.municipio} - ${item.uf}`],
            ["CNAES", listaCnaes],
            ["HISTÓRICO TRIBUTÁRIO", listaHistorico]
        ];

        dados.forEach(d => {
            const row = worksheet.addRow({ campo: d[0], valor: d[1] });
            row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            
            if (d[0] === "CNPJ") {
                row.getCell(2).numFmt = '@';
            }
        });

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
        headerRow.alignment = { horizontal: 'center' };

        worksheet.eachRow((row) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const nomeArquivo = `${(item.razao_social || item.razaoSocial || "EMPRESA").toUpperCase()} - DADOS.xlsx`;
        saveAs(new Blob([buffer]), nomeArquivo);
    };

    return (
        <button
            onClick={exportar}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-[10px] font-black uppercase hover:bg-emerald-500/20 transition-all"
        >
            <FileSpreadsheet size={16} />
            Exportar Excel
        </button>
    );
}
