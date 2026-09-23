"use client";

import { useState } from "react";
import { X, User, Shield, Briefcase, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { adicionarColaboradorCoreAction } from "@/actions/colaboradores";
import type { TemaAlpha } from "@/lib/temas";


interface Props {
    isOpen: boolean;
    onClose: () => void;
    style: TemaAlpha;
}

export function ModalAdicionarColaborador({ isOpen, onClose, style }: Props) {
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(

            true);

        const formData = new FormData(e.currentTarget);
        const res = await adicionarColaboradorCoreAction(formData);

        if (res.success) {
            toast.success("AGENTE REGISTRADO NO CORE ALPHA!");
            onClose();
            (e.target as HTMLFormElement).reset();
        } else {
            toast.error(res.error || "FALHA NO REGISTRO");
        }
        setLoading(false);
    }


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-[#0f172a] border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 ${style.bg}`} />

                <button onClick={onClose} className="cursor-pointer absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-8 flex items-center gap-3">
                    <User className={style.text} size={22} /> Novo Colaborador
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Completo</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                            <input required name="nome" placeholder="NOME DO AGENTE..." className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-[11px] font-black uppercase text-white outline-none focus:border-white/20 transition-all" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Setor</label>
                            <div className="relative">
                                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                                <select name="setor" className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-[10px] font-black uppercase text-white outline-none appearance-none focus:border-white/20">
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="OPERACIONAL">OPERACIONAL</option>
                                    <option value="TI">TI</option>
                                    <option value="COMERCIAL">COMERCIAL</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Cargo</label>
                            <div className="relative">
                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                                <select name="cargo" className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-[10px] font-black uppercase text-white outline-none appearance-none focus:border-white/20">
                                    <option value="CEO">CEO</option>
                                    <option value="Administrativo">GERENTE</option>
                                    <option value="Financeiro">AGENTE</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data de Ingresso</label>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                            <input type="date" name="data" className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-[11px] font-black uppercase text-white outline-none focus:border-white/20 transition-all color-scheme-dark" />
                        </div>
                    </div>

                    <button type="submit" disabled={loading} className={`cursor-pointer w-full h-16 mt-4 ${style.bg} rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95`}>
                        {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={20} />}
                        Finalizar Registro
                    </button>
                </form>
            </div>
        </div>
    );
}
