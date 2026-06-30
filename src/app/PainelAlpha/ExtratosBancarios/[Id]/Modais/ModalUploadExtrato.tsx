"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Upload, Loader2, Check,
    ChevronRight, Save, Search,
    Files, Trash2, Minus, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { SalvarTransacoesLote } from '@/actions/transacao';

interface Transacao {
    id: string;
    data: string;
    descricao: string;
    valor: number;
    selecionado: boolean;
    origem?: string;
}

export default function ModalUploadExtrato({ isOpen, onClose, dadosContexto, onSucesso }: any) {
    const [arquivos, setArquivos] = useState<File[]>([]);
    const [status, setStatus] = useState<'idle' | 'scanning' | 'reviewing'>('idle');
    const [linhasExtraidas, setLinhasExtraidas] = useState<Transacao[]>([]);
    const [filtro, setFiltro] = useState("");
    const [ordenacao, setOrdenacao] = useState("data-desc");
    const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setArquivos([]);
            setLinhasExtraidas([]);
            setStatus('idle');
            setProgresso({ atual: 0, total: 0 });
            setFiltro("");
        }
    }, [isOpen]);

    const parseMoeda = (valor: any): number => {
        if (typeof valor === 'number') return valor;
        if (!valor) return 0;
        const apenasNumeros = String(valor).replace(/[^\d.,-]/g, '');
        const valorLimpo = apenasNumeros.replace(/\./g, '').replace(',', '.');
        return parseFloat(valorLimpo) || 0;
    };

    const processarLote = async () => {
        if (arquivos.length === 0) return;

        setStatus('scanning');
        setProgresso({ atual: 0, total: arquivos.length });

        let todasAsLinhas: any[] = [];

        try {
            for (let i = 0; i < arquivos.length; i++) {
                setProgresso(prev => ({ ...prev, atual: i + 1 }));

                const formData = new FormData();
                formData.append("file", arquivos[i]);
                formData.append("bancoId", String(dadosContexto?.bancoId));

                const res = await fetch("/api/onyx/extrato", {
                    method: "POST",
                    body: formData,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({})) as { error?: string };
                    throw new Error(err.error || `Erro ${res.status}`);
                }

                const dados = await res.json() as { success: boolean; data?: any[]; error?: string };

                if (dados.success && Array.isArray(dados.data)) {
                    const formatados = dados.data.map((item: any, idx: number) => ({
                        id: `new-${i}-${idx}-${Date.now()}-${Math.random()}`,
                        data: item.data ? String(item.data).trim() : "",
                        descricao: item.descricao?.trim() || "LANÇAMENTO",
                        valor: parseMoeda(item.valor),
                        selecionado: true,
                        origem: arquivos[i].name,
                    }));
                    todasAsLinhas = [...todasAsLinhas, ...formatados];
                }
            }

            setLinhasExtraidas(todasAsLinhas);
            setStatus('reviewing');
            setArquivos([]);
        } catch (error) {
            toast.error((error as Error).message || "Erro no processamento");
            setStatus('idle');
        }
    };

    const confirmarImportacao = async () => {
        const selecionados = linhasExtraidas.filter(l => l.selecionado);
        if (selecionados.length === 0) return toast.error("Nenhuma transação selecionada.");

        toast.promise(SalvarTransacoesLote(selecionados, dadosContexto.bancoId), {
            loading: 'Salvando no banco...',
            success: () => {
                if (onSucesso) onSucesso();
                onClose();
                return 'Dados importados com sucesso!';
            },
            error: 'Erro ao salvar dados'
        });
    };

    const atualizarCampo = (id: string, campo: keyof Transacao, valor: any) => {
        setLinhasExtraidas(prev => prev.map(l =>
            l.id === id ? { ...l, [campo]: campo === 'valor' ? parseMoeda(valor) : valor } : l
        ));
    };

    const toggleSelecionarTodos = () => {
        const todosAtuaisSelecionados = linhasFiltradas.every(l => l.selecionado);
        const idsFiltrados = new Set(linhasFiltradas.map(l => l.id));
        setLinhasExtraidas(prev => prev.map(l =>
            idsFiltrados.has(l.id) ? { ...l, selecionado: !todosAtuaisSelecionados } : l
        ));
    };

    const linhasFiltradas = useMemo(() => {
        return [...linhasExtraidas]
            .filter(l => {
                const termo = filtro.toLowerCase();
                const descricaoMatch = l.descricao?.toLowerCase().includes(termo);

                const valorString = l.valor?.toString() || "";
                const valorFormatado = l.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || "";

                const valorMatch = valorString.includes(termo) || valorFormatado.includes(termo);

                return descricaoMatch || valorMatch;
            })
            .sort((a, b) => {
                if (ordenacao === 'valor-desc') return b.valor - a.valor;
                if (ordenacao === 'valor-asc') return a.valor - b.valor;

                if (ordenacao === 'data-desc' || ordenacao === 'data-asc') {
                    const parseData = (d: string) => {
                        if (!d || !d.includes('/')) return 0;
                        const [dia, mes] = d.split('/').map(Number);
                        return (mes * 100) + dia;
                    };

                    const valA = parseData(a.data);
                    const valB = parseData(b.data);

                    return ordenacao === 'data-desc' ? valB - valA : valA - valB;
                }
                return 0;
            });
    }, [linhasExtraidas, filtro, ordenacao]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#020617] border border-white/10 w-full max-w-6xl h-[85vh] rounded-[3rem] overflow-hidden flex flex-col shadow-2xl"
                >
                    {/* Header */}
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-slate-900/20">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <Files size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Novo Upload em Lote</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{dadosContexto?.banco || 'BANCO'} • {dadosContexto?.mes || 'PERÍODO'}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-all"><X size={24} /></button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {status === 'idle' && (
                            <div className="h-full grid grid-cols-1 lg:grid-cols-2">
                                <div className="p-12 flex flex-col items-center justify-center border-r border-white/5">
                                    <div onClick={() => fileInputRef.current?.click()} className="group w-full aspect-square max-w-[320px] border-2 border-dashed border-white/10 rounded-[3rem] bg-white/5 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-indigo-500/50 transition-all">
                                        <input type="file" ref={fileInputRef} className="hidden" multiple accept=".pdf,application/pdf" onChange={(e) => e.target.files && setArquivos(prev => [...prev, ...Array.from(e.target.files!)])} />
                                        <div className="h-20 w-20 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all"><Upload size={32} /></div>
                                        <div className="text-center px-6">
                                            <h3 className="text-sm font-black text-white uppercase italic">Selecionar PDFs</h3>
                                            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mt-2">Arraste os PDFs do extrato aqui</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-12 bg-black/20 flex flex-col overflow-hidden">
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Fila de Arquivos ({arquivos.length})</h4>
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                                        {arquivos.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 text-[10px] font-black italic">{i + 1}º</div>
                                                    <span className="text-[11px] font-bold text-slate-300 truncate max-w-[300px]">{f.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <button onClick={() => {
                                                            const n = [...arquivos];
                                                            if (i > 0) [n[i], n[i - 1]] = [n[i - 1], n[i]];
                                                            setArquivos(n);
                                                        }} className="p-1 hover:text-indigo-400 text-slate-600"><Plus size={12} /></button>
                                                        <button onClick={() => {
                                                            const n = [...arquivos];
                                                            if (i < n.length - 1) [n[i], n[i + 1]] = [n[i + 1], n[i]];
                                                            setArquivos(n);
                                                        }} className="p-1 hover:text-indigo-400 text-slate-600"><Minus size={12} /></button>
                                                    </div>
                                                    <button onClick={() => setArquivos(prev => prev.filter((_, idx) => idx !== i))} className="p-2 text-slate-600 hover:text-rose-500"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {arquivos.length > 0 && (
                                        <button onClick={processarLote} className="mt-8 w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg">
                                            Processar com Agentes IA <ChevronRight size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {status === 'scanning' && (
                            <div className="h-full flex flex-col items-center justify-center gap-6">
                                <Loader2 size={80} className="text-indigo-500 animate-spin" />
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">Processando arquivo {progresso.atual} de {progresso.total} via IA</p>
                            </div>
                        )}

                        {status === 'reviewing' && (
                            <div className="h-full flex flex-col">
                                <div className="p-4 bg-white/5 border-b border-white/5 flex gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                        <input type="text" placeholder="FILTRAR RESULTADOS..." value={filtro} onChange={(e) => setFiltro(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-[10px] font-bold text-white uppercase outline-none focus:border-indigo-500 transition-all" />

                                    </div>

                                    <select
                                        value={ordenacao}
                                        onChange={(e) => setOrdenacao(e.target.value)}
                                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[12px] font-bold text-white uppercase outline-none cursor-pointer hover:border-indigo-500/50 transition-all"
                                    >
                                        <option value="data-desc">📅 Mais Recentes</option>
                                        <option value="data-asc">📅 Mais Antigos</option>
                                        <option value="valor-desc">💰 Maiores Valores</option>
                                        <option value="valor-asc">💰 Menores Valores</option>
                                    </select>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-black/20 rounded-3xl border border-white/5 m-4">
                                    <div className="grid grid-cols-12 gap-4 px-9 py-4 border-b border-white/5 bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] items-center">
                                        <div className="col-span-1 flex justify-center">
                                            <button onClick={toggleSelecionarTodos} className={`h-5 w-5 rounded-lg border-2 flex items-center justify-center ${linhasFiltradas.length > 0 && linhasFiltradas.every(l => l.selecionado) ? 'bg-indigo-500 border-indigo-500' : 'border-white/10'}`}>
                                                {linhasFiltradas.length > 0 && linhasFiltradas.every(l => l.selecionado) && <Check size={12} strokeWidth={4} className="text-white" />}
                                            </button>
                                        </div>
                                        <div className="col-span-2">Data</div>
                                        <div className="col-span-6">Descrição</div>
                                        <div className="col-span-3 text-right">Valor (R$)</div>
                                    </div>


                                    <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
                                        {linhasFiltradas.map((linha) => (
                                            <motion.div layout key={linha.id} className={`grid grid-cols-12 gap-4 items-center p-2 px-5 rounded-2xl border transition-all ${linha.selecionado ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/[0.02] border-transparent opacity-60 hover:opacity-100'}`}>
                                                <div className="col-span-1 flex justify-center">
                                                    <button onClick={() => atualizarCampo(linha.id, 'selecionado', !linha.selecionado)} className={`h-6 w-6 rounded-xl border-2 flex items-center justify-center ${linha.selecionado ? 'bg-indigo-500 border-indigo-500' : 'border-white/10'}`}><Check size={14} strokeWidth={4} className={linha.selecionado ? "text-white" : "text-transparent"} /></button>
                                                </div>
                                                <div className="col-span-2">
                                                    <input type="text" value={linha.data} onChange={(e) => atualizarCampo(linha.id, 'data', e.target.value)} className="bg-white/[0.03] border border-white/5 rounded-xl px-2 py-2 text-[14px] font-black text-slate-200 w-full text-center outline-none" />
                                                </div>
                                                <div className="col-span-6">
                                                    <input type="text" value={linha.descricao} onChange={(e) => atualizarCampo(linha.id, 'descricao', e.target.value)} className="bg-transparent border-none text-[14px] font-black text-white w-full uppercase outline-none" />
                                                </div>
                                                <div className="col-span-3">
                                                    <input type="text" defaultValue={linha.valor.toLocaleString('pt-br', { minimumFractionDigits: 2 })} onBlur={(e) => atualizarCampo(linha.id, 'valor', e.target.value)} className="bg-white/5 border border-transparent rounded-lg px-2 py-1.5 text-[16px] font-black text-white w-full text-right outline-none font-mono" />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-8 bg-slate-900/60 border-t border-white/5 flex justify-between items-center">
                        <div className="flex gap-10">
                            <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Novas Transações</p><p className="text-xl font-black text-white italic">{linhasFiltradas.length}</p></div>
                        </div>
                        <div className="flex gap-4 items-center">
                            <button onClick={() => setLinhasExtraidas(prev => prev.filter(l => !l.selecionado))} className="cursor-pointer flex items-center gap-2 px-6 py-4 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/5 rounded-2xl transition-all"><X size={14} /> Descartar Selecionados</button>
                            <div className="w-px h-8 bg-white/10 mx-2" />
                            <button onClick={confirmarImportacao} disabled={linhasExtraidas.length === 0} className="cursor-pointer px-10 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20"><Save size={16} /> Salvar Transações</button>
                        </div>
                    </div>
                </motion.div>
            </div>

        </AnimatePresence>

    );
}