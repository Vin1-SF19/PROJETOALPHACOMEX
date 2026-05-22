"use client";

import { Search, FileUp, Filter, Download, Trash2, RefreshCcw, History, Eraser, Plus, X } from "lucide-react";
import { useState } from "react";
import { ModalConsultarCNPJ } from "./ModalPesquisa";
import { BotaoUploadExcel } from "./BotaoUploadExcel";
import { BotaoExportarTabelaCompleta } from "./BotaoExportarTabelaCompleta";
import { FiltroRadar } from "./FiltroRadar";
import { ModalHistorico } from "./Historico";


interface HeaderRadarProps {
    style: any;
    dados: any[];
    filtro: string;
    onFilter: (val: string) => void;
    onDelete: () => Promise<void>;
    totalSelecionados: number;
}

export function HeaderRadar({
    style,
    dados,
    filtro,
    onFilter,
    onDelete,
    totalSelecionados
}: HeaderRadarProps) {
    const [modalAberto, setModalAberto] = useState(false);
    const [historicoAberto, setHistoricoAberto] = useState(false);

    const listaOpcoesFixas = ["todos", "az", "za", "novos", "antigos", "divida_maior", "divida_minima", "anexo1", "anexo2", "premium", "qualificado", "desqualificado", "presumido", "real", "simples"];

    return (
        <>
            <header className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black uppercase italic tracking-tighter flex items-center gap-4">
                            <Search className={style.text} size={40} /> Radar <span className={style.text}>Fiscal</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2 italic">Data Intelligence & Leads Alpha</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => setModalAberto(true)}
                            className={`cursor-pointer h-14 px-8 ${style.bg} rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-95 shadow-2xl`}
                        >
                            <Plus size={18} /> Consultar CNPJ
                        </button>

                        <BotaoUploadExcel />
                        <BotaoExportarTabelaCompleta dados={dados} />
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-white/5 p-3 rounded-[1.8rem] flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px] relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="PROCURAR POR CNPJ OU RAZÃO SOCIAL..."
                            value={(listaOpcoesFixas.includes(filtro) ? "" : filtro) || ""}
                            onChange={(e) => onFilter(e.target.value)}
                            className="w-full h-12 bg-white/5 border border-white/5 rounded-xl pl-12 pr-10 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                        />
                        {(!listaOpcoesFixas.includes(filtro) && filtro !== "") && (
                            <button
                                onClick={() => onFilter("todos")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full text-slate-500 hover:text-white transition-all"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="h-8 w-px bg-white/10 hidden md:block" />

                    <div className="flex items-center gap-2">
                        <FiltroRadar onFilterChange={onFilter} />

                        <button
                            onClick={() => setHistoricoAberto(true)}
                            className="cursor-pointer p-4 bg-white/5 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
                            title="Histórico"
                        >
                            <History size={18} />
                        </button>

                        <div className="h-8 w-px bg-white/10 mx-1" />

                        <button
                            onClick={() => onFilter("todos")}
                            className="cursor-pointer p-4 bg-white/5 border border-white/5 rounded-xl text-slate-500 hover:text-amber-500 transition-all"
                            title="Limpar Filtros"
                        >
                            <Eraser size={18} />
                        </button>

                        <button
                            onClick={onDelete}
                            disabled={totalSelecionados === 0}
                            className={`p-4 rounded-xl transition-all flex items-center gap-3 ${totalSelecionados > 0
                                ? 'bg-red-600/10 text-red-500 cursor-pointer hover:bg-red-600 hover:text-white cursor-pointer'
                                : 'bg-white/5 text-slate-700 cursor-not-allowed opacity-50'
                                }`}
                            title="Excluir Selecionados"
                        >
                            <Trash2 size={18} />
                            {totalSelecionados > 0 && (
                                <span className="text-[10px] font-black">{totalSelecionados}</span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <ModalConsultarCNPJ
                isOpen={modalAberto}
                onClose={() => setModalAberto(false)}
                style={style}
            />

            <ModalHistorico
                isOpen={historicoAberto}
                onClose={() => setHistoricoAberto(false)}
            />
        </>
    );
}
