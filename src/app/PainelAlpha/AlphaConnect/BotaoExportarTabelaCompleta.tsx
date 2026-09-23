"use client";

import { useState } from "react";
import { Download, X, Save, FileEdit, Loader2 } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toast } from "sonner";
import { salvarPlanilhaNoBancoAction } from "@/actions/HistoricoPlanilhaFiscal";
import type { RadarFiscalItem } from "./types";

type Cnae = { code?: string; codigo?: string };
type HistoricoRegime = { ano?: string | number; Ano?: string | number; periodo?: string; regime?: string; Regime?: string };

export function BotaoExportarTabelaCompleta({ dados }: { dados: RadarFiscalItem[] }) {
    const [modalAberto, setModalAberto] = useState(false);
    const [nomeArquivo, setNomeArquivo] = useState("RELATORIO_RADAR_COMPLETO");
    const [salvarBanco, setSalvarBanco] = useState(false);
    const [carregando, setCarregando] = useState(false);

    const gerarExcel = async () => {
        if (!dados || dados.length === 0) {
            toast.error("Nenhum dado para exportar");
            return;
        }
        setCarregando(true);

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Radar Fiscal");

            worksheet.columns = [
                { header: "CNPJ", key: "cnpj", width: 20 },
                { header: "RAZÃO SOCIAL", key: "razao", width: 40 },
                { header: "NOME FANTASIA", key: "fantasia", width: 40 },
                { header: "SITUAÇÃO", key: "situacao", width: 15 },
                { header: "ABERTURA", key: "abertura", width: 15 },
                { header: "CAPITAL SOCIAL", key: "capital", width: 20 },
                { header: "REGIME RECEITA", key: "regime_receita", width: 20 },
                { header: "REGIME EA", key: "regime_ea", width: 20 },
                { header: "PERSE", key: "perse", width: 10 },
                { header: "ANEXO PERSE", key: "anexo", width: 15 },
                { header: "DÍVIDA ATIVA", key: "divida", width: 20 },
                { header: "OPÇÃO SIMPLES", key: "opcao_simples", width: 15 },
                { header: "EXCLUSÃO SIMPLES", key: "exclusao_simples", width: 15 },
                { header: "CIDADE", key: "municipio", width: 25 },
                { header: "UF", key: "uf", width: 5 },
                { header: "CNAES", key: "cnaes", width: 60 },
                { header: "HISTÓRICO", key: "historico", width: 60 }
            ];

            dados.forEach(item => {
                const parseJSON = (val: unknown) => {
                    try { return typeof val === 'string' ? JSON.parse(val) : val; }
                    catch { return null; }
                };

                const cnaesObj = parseJSON(item.cnaes);
                const listaCnaes = [...(cnaesObj?.principal || []), ...(cnaesObj?.secundarios || [])]
                    .map((c: Cnae) => c.code || c.codigo).filter(Boolean).join(" | ");

                const histObj = parseJSON(item.historico_regime || item.historicoRegime);
                const listaHist = Array.isArray(histObj)
                    ? histObj.map((h: HistoricoRegime) => `${h.ano || h.periodo || h.Ano}: ${h.regime || h.Regime}`).join(" | ")
                    : "---";

                const row = worksheet.addRow({
                    cnpj: item.cnpj?.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"),
                    razao: (item.razao_social || item.razaoSocial || "").toUpperCase(),
                    fantasia: (item.nome_fantasia || item.nomeFantasia || "").toUpperCase(),
                    situacao: item.situacao_cadastral || item.situacao,
                    abertura: item.data_abertura || item.abertura,
                    capital: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.capital_social || item.capitalSocial || 0)),
                    regime_receita: item.regime_receita || item.regimeReceita,
                    regime_ea: item.regime_ea || item.regimeEA,
                    perse: item.perse,
                    anexo: item.perse_anexo,
                    divida: Number(item.divida_tributaria) > 0 ? `R$ ${Number(item.divida_tributaria).toLocaleString('pt-BR')}` : "NADA CONSTA",
                    opcao_simples: item.data_opcao_simples || item.dataOpcao || "---",
                    exclusao_simples: item.data_exclusao_simples || item.exclusao_simples || "---",
                    municipio: item.municipio,
                    uf: item.uf,
                    cnaes: listaCnaes ? `| ${listaCnaes} |` : "---",
                    historico: listaHist !== "---" ? `| ${listaHist} |` : "---"
                });

                row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
                row.getCell('cnpj').numFmt = '@';
            });

            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } };

            const buffer = await workbook.xlsx.writeBuffer();
            const finalFilename = `${nomeArquivo.toUpperCase()}.xlsx`;

            if (salvarBanco) {
                const uint8Array = new Uint8Array(buffer);
                const arrayParaEnviar = Array.from(uint8Array);
                const res = await salvarPlanilhaNoBancoAction(finalFilename, arrayParaEnviar);
                
                if (res.success) toast.success("Planilha arquivada com sucesso!");
                else toast.error("Erro ao salvar: " + res.error);
            }

            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            saveAs(blob, finalFilename);
            setModalAberto(false);
            toast.success("Download iniciado!");
        } catch (error) {
            toast.error("Falha ao gerar planilha");
        } finally {
            setCarregando(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setModalAberto(true)}
                className="cursor-pointer h-14 px-6 bg-blue-600/10 border border-blue-600/20 text-blue-500 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-xl"
            >
                <Download size={18} /> Exportar Base
            </button>

            {modalAberto && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-black italic text-white uppercase tracking-tighter">Exportar Dados</h2>
                            <button onClick={() => setModalAberto(false)} className="text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <FileEdit size={14}/> Nome do Arquivo
                                </label>
                                <input 
                                    type="text"
                                    value={nomeArquivo}
                                    onChange={(e) => setNomeArquivo(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all"
                                />
                            </div>

                            <button 
                                onClick={() => setSalvarBanco(!salvarBanco)}
                                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between group ${salvarBanco ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <Save size={18}/>
                                    <span className="text-[10px] font-black uppercase tracking-widest">Salvar no Histórico (Turso)</span>
                                </div>
                                <div className={`w-4 h-4 rounded-full border-2 transition-all ${salvarBanco ? 'bg-emerald-400 border-emerald-400' : 'border-slate-700'}`} />
                            </button>
                        </div>

                        <button 
                            onClick={gerarExcel}
                            disabled={carregando}
                            className="w-full h-14 bg-blue-600 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white hover:bg-blue-500 disabled:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-3"
                        >
                            {carregando ? <Loader2 className="animate-spin" size={20} /> : "Confirmar & Baixar"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
