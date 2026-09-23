"use client";

import { useState } from "react";
import ModalDetalhesCNPJ from "./ModalDetalhesCNPJ";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RadarFiscalItem } from "./types";
import type { TemaAlpha } from "@/lib/temas";

interface TabelaRadarProps {
    dados: RadarFiscalItem[];
    style: TemaAlpha;
    selecionados: number[];
    onSelectionChange: (ids: number[]) => void;
}

export function TabelaRadar({ dados, style, selecionados, onSelectionChange }: TabelaRadarProps) {
    const [detalheSelecionado, setDetalheSelecionado] = useState<RadarFiscalItem | null>(null);
    const [pagina, setPagina] = useState(1);
    const itensPorPagina = 20;

    const totalPaginas = Math.ceil(dados.length / itensPorPagina);
    const inicio = (pagina - 1) * itensPorPagina;
    const dadosExibidos = dados.slice(inicio, inicio + itensPorPagina);

    const handleToggleSelect = (id: number) => {
        const novos = selecionados.includes(id)
            ? selecionados.filter(i => i !== id)
            : [...selecionados, id];
        onSelectionChange(novos);
    };

    const handleToggleAll = () => {
        const novos = selecionados.length === dados.length ? [] : dados.map(item => item.id);
        onSelectionChange(novos);
    };

    const formatarCNPJ = (cnpj: string) => {
        return cnpj?.replace(/\D/g, "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") || "";
    };

    return (
        <>
            <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-black/40 border-b border-white/5 text-slate-500">
                            <th className="p-6 w-10">
                                <input
                                    type="checkbox"
                                    checked={dados.length > 0 && selecionados.length === dados.length}
                                    onChange={handleToggleAll}
                                    className="w-4 h-4 rounded border-white/10 bg-white/5 accent-emerald-500 cursor-pointer"
                                />
                            </th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">Qualificação</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">CNPJ</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">Razão Social</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">Nome Fantasia</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">Regime</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">Dívida</th>
                            <th className="p-6 text-[10px] font-black uppercase tracking-widest">Perse</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dadosExibidos.map((item) => (
                            <tr
                                key={item.id}
                                className={`border-b border-white/5 transition-colors ${selecionados.includes(item.id) ? 'bg-emerald-500/10' : 'hover:bg-white/[0.02]'}`}
                            >
                                <td className="p-6">
                                    <input
                                        type="checkbox"
                                        checked={selecionados.includes(item.id)}
                                        onChange={() => handleToggleSelect(item.id)}
                                        className="w-4 h-4 rounded border-white/10 bg-white/5 accent-emerald-500 cursor-pointer"
                                    />
                                </td>
                                <td className="p-6">
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${!item.qualificacao ? "text-slate-400 border-slate-400/30" : item.qualificacao === "PREMIUM" ? "text-amber-400 border-amber-400/30" : "text-emerald-400 border-emerald-400/30"}`}>
                                        {item.qualificacao || "NÃO INFORMADO"}
                                    </span>
                                </td>
                                <td onClick={() => setDetalheSelecionado(item)} className="p-6 text-[11px] font-black text-white font-mono cursor-pointer hover:text-emerald-400 underline decoration-emerald-500/30 underline-offset-4">
                                    {formatarCNPJ(item.cnpj)}
                                </td>
                                <td className="p-6 text-[10px] font-black uppercase text-white truncate max-w-[250px]">{item.razao_social || item.razaoSocial}</td>
                                <td className="p-6 text-[10px] font-bold uppercase text-slate-500 italic">{item.nome_fantasia || item.nomeFantasia}</td>
                                <td className="p-6">
                                    <span className="px-3 py-1 bg-blue-600/10 border border-blue-600/20 text-blue-500 rounded-lg text-[9px] font-black uppercase">
                                        {item.regime_ea || item.regimeEA || "N/A"}
                                    </span>
                                </td>
                                <td className="p-6">
                                    <span className={`text-[11px] font-black ${Number(item.divida_tributaria) > 0 ? "text-red-500" : "text-gray-500"}`}>
                                        {Number(item.divida_tributaria) > 0 ? Number(item.divida_tributaria).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : "SEM DÍVIDAS"}
                                    </span>
                                </td>
                                <td className="p-6">
                                    <span className={`text-[10px] font-black uppercase italic ${item.perse === "SIM"
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                        }`}>
                                        {item.perse === "SIM" ? (item.perse_anexo) : "NÃO"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Controles de Paginação */}
            {totalPaginas > 1 && (
                <div className="p-6 flex items-center justify-between border-t border-white/5 bg-black/20">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Página {pagina} de {totalPaginas} ({dados.length} registros)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPagina(p => Math.max(1, p - 1))}
                            disabled={pagina === 1}
                            className="p-2 bg-white/5 rounded-lg disabled:opacity-20 hover:bg-white/10"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                            disabled={pagina === totalPaginas}
                            className="p-2 bg-white/5 rounded-lg disabled:opacity-20 hover:bg-white/10"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {detalheSelecionado && (
                <ModalDetalhesCNPJ key={detalheSelecionado.id} item={detalheSelecionado} onClose={() => setDetalheSelecionado(null)} />
            )}
        </>
    );
}
