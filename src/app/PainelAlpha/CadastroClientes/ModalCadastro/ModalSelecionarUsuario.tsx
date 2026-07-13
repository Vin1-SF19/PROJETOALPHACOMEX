"use client";

import { useEffect, useState } from "react";
import { X, Search, UserCircle2 } from "lucide-react";
import { BuscarTodosUsuarios } from "@/actions/RecursosHumanos";

type Usuario = Awaited<ReturnType<typeof BuscarTodosUsuarios>>["data"][number];

interface ModalSelecionarUsuarioProps {
    open: boolean;
    onClose: () => void;
    onSelecionar: (nome: string) => void;
    titulo?: string;
}

/**
 * Modal reutilizável para escolher QUALQUER usuário do sistema (não filtrado
 * por role) — usado como escape hatch dos dropdowns de Analista/Closer, que
 * por padrão só listam usuários do role esperado (OPERACIONAL/COMERCIAL).
 * Reutilizado entre o cadastro manual (`modal.tsx`) e a edição por card
 * (`modalDados.tsx`) — ver decisions.md 2026-07-13.
 */
export function ModalSelecionarUsuario({ open, onClose, onSelecionar, titulo = "Selecionar Usuário" }: ModalSelecionarUsuarioProps) {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [carregando, setCarregando] = useState(false);
    const [busca, setBusca] = useState("");

    useEffect(() => {
        if (!open) {
            setBusca("");
            return;
        }
        let cancelado = false;
        (async () => {
            setCarregando(true);
            const res = await BuscarTodosUsuarios();
            if (!cancelado) {
                setUsuarios(res.success ? res.data : []);
                setCarregando(false);
            }
        })();
        return () => { cancelado = true; };
    }, [open]);

    if (!open) return null;

    const buscaNormalizada = busca.trim().toLowerCase();
    const usuariosFiltrados = buscaNormalizada
        ? usuarios.filter((u) => u.nome.toLowerCase().includes(buscaNormalizada))
        : usuarios;

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#0b1220] border border-white/10 w-full max-w-md max-h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-black text-white uppercase tracking-tighter">{titulo}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-white/5 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar usuário..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1">
                    {carregando ? (
                        <div className="p-8 text-center text-[10px] text-slate-600 uppercase font-black tracking-widest italic animate-pulse">
                            Carregando usuários...
                        </div>
                    ) : usuariosFiltrados.length === 0 ? (
                        <div className="p-8 text-center text-[10px] text-slate-700 uppercase font-black tracking-widest italic">
                            Nenhum usuário encontrado
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {usuariosFiltrados.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => { onSelecionar(u.nome); onClose(); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-white/5 transition-all group"
                                >
                                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                                        <UserCircle2 size={18} className="text-slate-500 group-hover:text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{u.nome}</p>
                                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{u.role}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
