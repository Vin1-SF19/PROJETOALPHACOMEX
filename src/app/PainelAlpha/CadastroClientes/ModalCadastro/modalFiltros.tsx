"use client";
import React from 'react';
import { X, SortAsc, Calendar, User, ShieldCheck, CheckCircle2 } from "lucide-react";
import { CsNpsModal3DShell } from "../CsNpsMotion";

export default function ModalFiltros({ isOpen, onClose, ordenacao, setOrdenacao }: any) {
    if (!isOpen) return null;

    const opcoes = [
        { label: "Razão Social", campo: "razaoSocial", icon: SortAsc },
        { label: "Nome Fantasia", campo: "nomeFantasia", icon: SortAsc },
        { label: "Data Contratação", campo: "dataContratacao", icon: Calendar },
        { label: "Data Êxito", campo: "dataExito", icon: Calendar },
        { label: "Status", campo: "status", icon: ShieldCheck },
        { label: "Analista", campo: "analistaResponsavel", icon: User },
        { label: "Feedback Google", campo: "feedbackGoogle", icon: CheckCircle2 }, 
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <CsNpsModal3DShell className="relative bg-[#0b1220] border border-white/10 w-full max-w-md rounded-[2rem] shadow-3xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Filtros Avançados</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {opcoes.map((item) => (
                        <div key={item.campo} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                            <div className="flex items-center gap-3 text-slate-300">
                                <item.icon size={16} className="text-indigo-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setOrdenacao({ campo: item.campo, direcao: 'desc' })}
                                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${ordenacao.campo === item.campo && ordenacao.direcao === 'desc' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                >
                                    {item.campo === 'feedbackGoogle' ? 'Com Feedback' : item.campo.includes('data') ? 'Recentes' : 'Z-A'}
                                </button>
                                <button 
                                    onClick={() => setOrdenacao({ campo: item.campo, direcao: 'asc' })}
                                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${ordenacao.campo === item.campo && ordenacao.direcao === 'asc' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                >
                                    {item.campo === 'feedbackGoogle' ? 'Sem Feedback' : item.campo.includes('data') ? 'Antigos' : 'A-Z'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-slate-900/20">
                    <button onClick={onClose} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95">
                        Aplicar Filtros
                    </button>
                </div>
            </CsNpsModal3DShell>
        </div>
    );
}
