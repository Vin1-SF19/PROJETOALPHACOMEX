"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { User, Search, ArrowRight, Mail, Shield, Users, Activity, Zap, X, UserPlus, ChevronRight } from 'lucide-react';
import { BuscarTodosUsuarios } from '@/actions/RecursosHumanos';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';

type Usuario = Awaited<ReturnType<typeof BuscarTodosUsuarios>>["data"][number];

export default function PaginaUsuarios() {
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [usuariosBase, setUsuariosBase] = useState<Usuario[]>([]);
    const [buscaFiltroAdicionar, setBuscaFiltroAdicionar] = useState("");
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [vinculadosIds, setVinculadosIds] = useState<string[]>([]);

    useEffect(() => {
        const carregarDadosIniciais = async () => {
            setLoading(true);
            const res = await BuscarTodosUsuarios();
            if (res.success) {
                setUsuariosBase(res.data);
                const salvos = localStorage.getItem('operadores_vinculados');
                if (salvos) {
                    try {
                        setVinculadosIds(JSON.parse(salvos));
                    } catch (e) {
                        console.error("Erro ao carregar dados salvos", e);
                    }
                }
            }
            setLoading(false);
        };
        carregarDadosIniciais();
    }, []);

    useEffect(() => {
        if (!loading) {
            localStorage.setItem('operadores_vinculados', JSON.stringify(vinculadosIds));
        }
    }, [vinculadosIds, loading]);

    const toggleVinculo = (user: Usuario) => {
        const idStr = String(user.id);
        if (vinculadosIds.includes(idStr)) {
            setVinculadosIds(prev => prev.filter(id => id !== idStr));
            toast.info(`${user.nome} removido da central.`);
        } else {
            setVinculadosIds(prev => [...prev, idStr]);
            toast.success(`${user.nome} adicionado à central.`);
        }
        setShowAddMenu(false);
    };

    const usuariosFiltrados = useMemo(() => {
        return usuariosBase.filter(u => 
            vinculadosIds.includes(String(u.id)) &&
            (u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase()))
        );
    }, [usuariosBase, vinculadosIds, busca]);

    if (loading) return (
        <div className="flex items-center justify-center p-20 text-slate-500 uppercase text-[10px] font-black tracking-[0.3em] animate-pulse">
            <Zap size={16} className="mr-3 text-indigo-500" /> Sincronizando Rede Alpha...
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-10">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-white/[0.02] border border-white/5 p-8 rounded-[3rem] relative">
                <div className="flex flex-col gap-2">
                    <div>
                        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-2">
                            Central RH <span className="text-indigo-500">Alpha</span>
                        </h1>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] ml-1">
                            Gestão de Diretrizes e Performance
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-6">
                        <AnimatePresence>
                            {usuariosBase.filter(u => vinculadosIds.includes(String(u.id))).map((v) => (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    key={v.id}
                                    className="flex items-center gap-2 bg-white/[0.03] border border-white/10 pl-4 pr-2 py-2 rounded-full group hover:border-red-500/30 transition-all"
                                >
                                    <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight">{v.nome}</span>
                                    <button 
                                        onClick={() => setVinculadosIds(prev => prev.filter(id => id !== String(v.id)))}
                                        className="w-5 h-5 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:bg-red-500/20 hover:text-red-500 transition-all"
                                    >
                                        <X size={10} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <div className="relative">
                            <button
                                onClick={() => setShowAddMenu(!showAddMenu)}
                                className="group flex items-center gap-3 px-6 py-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                            >
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Vincular Operador</span>
                                <div className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-500 text-white">
                                    <UserPlus size={10} />
                                </div>
                            </button>

                            <AnimatePresence>
                                {showAddMenu && (
                                    <>
                                        <div className="fixed inset-0 z-[90]" onClick={() => setShowAddMenu(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute top-full mt-4 left-0 w-80 z-[100] bg-[#0c0c0e] border border-white/10 rounded-[2rem] p-5 shadow-[0_30px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl"
                                        >
                                            <div className="relative mb-4">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="BUSCAR NO BANCO..."
                                                    className="w-full bg-black border border-white/5 rounded-xl p-3 pl-11 text-[10px] font-black text-white uppercase outline-none focus:border-indigo-500/30 transition-all"
                                                    onChange={(e) => setBuscaFiltroAdicionar(e.target.value)}
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                                {usuariosBase
                                                    ?.filter(u => u.nome?.toLowerCase().includes(buscaFiltroAdicionar.toLowerCase()))
                                                    .map(u => (
                                                        <button
                                                            key={u.id}
                                                            onClick={() => toggleVinculo(u)}
                                                            className={`w-full text-left p-4 rounded-xl flex items-center justify-between group transition-all border ${vinculadosIds.includes(String(u.id)) ? 'bg-indigo-500/20 border-indigo-500/40' : 'hover:bg-white/5 border-transparent'}`}
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className={`text-[10px] font-black uppercase ${vinculadosIds.includes(String(u.id)) ? 'text-indigo-400' : 'text-slate-300 group-hover:text-white'}`}>{u.nome}</span>
                                                                <span className="text-[8px] text-slate-600 uppercase">Sistema Alpha</span>
                                                            </div>
                                                            {vinculadosIds.includes(String(u.id)) ? <X size={12} className="text-indigo-500" /> : <ChevronRight size={12} className="text-slate-700 group-hover:text-indigo-500" />}
                                                        </button>
                                                    ))}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 w-full lg:w-auto">
                    <div className="flex-1 lg:flex-none min-w-[150px] bg-black/40 border border-white/10 p-4 rounded-2xl">
                        <p className="text-[8px] font-black text-indigo-400 uppercase mb-1">Total Vinculados</p>
                        <div className="flex items-center gap-3">
                            <Users size={18} className="text-white" />
                            <span className="text-xl font-black text-white italic">{vinculadosIds.length}</span>
                        </div>
                    </div>
                    <div className="flex-1 lg:flex-none min-w-[150px] bg-black/40 border border-white/10 p-4 rounded-2xl">
                        <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Status Rede</p>
                        <div className="flex items-center gap-3">
                            <Activity size={18} className="text-emerald-500" />
                            <span className="text-xs font-black text-white uppercase italic tracking-widest">Ativo</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input
                    type="text"
                    placeholder="FILTRAR COLABORADORES VINCULADOS..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-[2rem] py-6 pl-16 pr-8 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode='popLayout'>
                    {usuariosFiltrados.map((user) => (
                        <motion.div
                            key={user.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            whileHover={{ y: -5 }}
                            className="group relative bg-[#0c0c0e] border border-white/5 rounded-[3rem] p-8 overflow-hidden transition-all hover:border-indigo-500/40"
                        >
                            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-[80px] group-hover:bg-indigo-600/20 transition-all" />

                            <div className="flex items-center gap-5 relative z-10 mb-8">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-indigo-900 p-[2px]">
                                        <div className="w-full h-full rounded-[1.9rem] bg-[#0c0c0e] flex items-center justify-center overflow-hidden">
                                            {user.imagemUrl ? (
                                                <img src={user.imagemUrl} alt={user.nome} className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={32} className="text-indigo-400" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0c0c0e] border-4 border-[#0c0c0e] rounded-full flex items-center justify-center">
                                        <div className="w-full h-full bg-emerald-500 rounded-full" />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">
                                        {user.nome || "COLABORADOR"}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Shield size={10} className="text-indigo-500" />
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                                            Nível Alpha
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 relative z-10 bg-white/[0.02] border border-white/5 p-5 rounded-3xl">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Mail size={14} className="text-indigo-500/50" />
                                        <span className="text-[10px] font-bold tracking-tight truncate max-w-[150px]">{user.email}</span>
                                    </div>
                                </div>
                                <div className="h-[1px] w-full bg-white/5" />
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Acesso Alpha</span>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase italic">Verificado</span>
                                </div>
                            </div>

                            <Link
                                href={`/PainelAlpha/PainelTarefas/GerenciarTarefas?id=${user.id}`}
                                className="mt-8 w-full py-5 bg-white text-black hover:bg-indigo-600 hover:text-white rounded-[2rem] flex items-center justify-center gap-3 transition-all duration-500 group/btn"
                            >
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">Gerenciar Rotina</span>
                                <ArrowRight size={16} className="group-hover/btn:translate-x-2 transition-transform duration-500" />
                            </Link>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {usuariosFiltrados.length === 0 && !loading && (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                    <Users size={48} className="mx-auto text-slate-800 mb-4" />
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Nenhum operador vinculado à central</p>
                </div>
            )}
        </div>
    );
}
