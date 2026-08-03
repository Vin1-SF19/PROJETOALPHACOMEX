"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { X, Shield, ShieldCheck, Lock, Search, Loader2, Users } from 'lucide-react';
import { listarAcessoModulo, toggleAcessoModulo } from '@/actions/PermissoesSetor';
import { toast } from 'sonner';
import { isAdminRole } from '@/lib/roles';

const MODULO = 'skillsGerenciamento';

type UserAcesso = Awaited<ReturnType<typeof listarAcessoModulo>>[number];

export default function ModalAcessoGerenciamento({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [users, setUsers] = useState<UserAcesso[]>([]);
    const [loading, setLoading] = useState(false);
    const [toggling, setToggling] = useState<number | null>(null);
    const [busca, setBusca] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        listarAcessoModulo(MODULO)
            .then(data => setUsers(data))
            .finally(() => setLoading(false));
    }, [isOpen]);

    const temAcesso = (user: UserAcesso) => {
        if (isAdminRole(user.role)) return true;
        return user.permissaoOverrides.some(o => o.acao === 'ADD');
    };

    const handleToggle = async (user: UserAcesso) => {
        if (isAdminRole(user.role)) return;
        setToggling(user.id);
        try {
            const result = await toggleAcessoModulo(user.id, MODULO);
            if (result.success) {
                const nome = user.nome ?? user.usuario ?? 'usuário';
                setUsers(prev => prev.map(u => {
                    if (u.id !== user.id) return u;
                    return {
                        ...u,
                        permissaoOverrides: result.hasAccess
                            ? [{ id: Date.now(), acao: 'ADD' }]
                            : [],
                    };
                }));
                toast.success(result.hasAccess ? `Acesso liberado para ${nome}` : `Acesso revogado de ${nome}`);
            } else {
                toast.error('Erro ao alterar acesso.');
            }
        } finally {
            setToggling(null);
        }
    };

    const filtered = useMemo(() =>
        users.filter(u =>
            (u.nome ?? u.usuario ?? '').toLowerCase().includes(busca.toLowerCase()) ||
            u.role.toLowerCase().includes(busca.toLowerCase())
        ), [users, busca]);

    const admins = users.filter(u => isAdminRole(u.role)).length;
    const liberados = users.filter(u => !isAdminRole(u.role) && temAcesso(u)).length;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div
                className="relative w-full max-w-md bg-[#111] border border-white/[0.08] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                style={{ maxHeight: '85vh' }}
            >
                {/* Header */}
                <div className="px-7 pt-7 pb-5 border-b border-white/[0.06] shrink-0">
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center shrink-0">
                                <Shield size={18} className="text-orange-500" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest text-white">Acesso ao Gerenciamento</h2>
                                <p className="text-[9px] text-slate-500 uppercase mt-0.5 tracking-wider">Alpha Skills — controle de acesso</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl">
                            <Lock size={10} className="text-orange-500" />
                            <span className="text-[8px] font-black text-slate-400 uppercase">{admins} Admin</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl">
                            <ShieldCheck size={10} className="text-green-500" />
                            <span className="text-[8px] font-black text-slate-400 uppercase">{liberados} liberados</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl">
                            <Users size={10} className="text-slate-500" />
                            <span className="text-[8px] font-black text-slate-400 uppercase">{users.length} total</span>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="px-7 py-4 border-b border-white/[0.06] shrink-0">
                    <div className="relative">
                        <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input
                            type="text"
                            value={busca}
                            onChange={e => setBusca(e.target.value)}
                            placeholder="Buscar colaborador ou setor..."
                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-xs text-white outline-none focus:border-orange-500/40 transition-all"
                        />
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto px-7 py-4 space-y-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="animate-spin text-orange-500" size={28} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Carregando...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 opacity-30">
                            <Users size={28} className="text-slate-600" />
                            <span className="text-[9px] font-black uppercase text-slate-600">Nenhum resultado</span>
                        </div>
                    ) : (
                        filtered.map(user => {
                            const isAdmin = isAdminRole(user.role);
                            const acesso = temAcesso(user);
                            const isToggling = toggling === user.id;

                            return (
                                <div
                                    key={user.id}
                                    className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                        isAdmin
                                            ? 'bg-orange-500/[0.04] border-orange-500/10'
                                            : acesso
                                                ? 'bg-green-500/[0.04] border-green-500/10'
                                                : 'bg-white/[0.02] border-white/[0.05]'
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="shrink-0 w-9 h-9 rounded-xl overflow-hidden bg-[#1C1C1C] border border-white/10 flex items-center justify-center">
                                        {user.imagemUrl ? (
                                            <img src={user.imagemUrl} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-400">
                                                {(user.nome ?? user.usuario ?? '?').slice(0, 2).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-white uppercase truncate leading-tight">
                                            {user.nome ?? user.usuario}
                                        </p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">{user.role}</p>
                                    </div>

                                    {/* Ação */}
                                    {isAdmin ? (
                                        <div className="flex items-center gap-1.5 bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/20 shrink-0">
                                            <Lock size={10} className="text-orange-500" />
                                            <span className="text-[8px] font-black text-orange-400 uppercase">Admin</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleToggle(user)}
                                            disabled={isToggling}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer border shrink-0 ${
                                                acesso
                                                    ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400'
                                                    : 'bg-white/[0.04] border-white/10 text-slate-400 hover:bg-orange-500/10 hover:border-orange-500/20 hover:text-orange-400'
                                            } disabled:opacity-50 disabled:cursor-wait`}
                                        >
                                            {isToggling ? (
                                                <Loader2 size={11} className="animate-spin" />
                                            ) : acesso ? (
                                                <ShieldCheck size={11} />
                                            ) : (
                                                <Shield size={11} />
                                            )}
                                            {isToggling ? 'Salvando' : acesso ? 'Liberado' : 'Liberar'}
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer hint */}
                <div className="px-7 py-4 border-t border-white/[0.06] shrink-0">
                    <p className="text-[8px] text-slate-600 text-center uppercase tracking-wider">
                        Clique em &quot;Liberado&quot; para revogar · &quot;Liberar&quot; para conceder acesso
                    </p>
                </div>
            </div>
        </div>
    );
}
