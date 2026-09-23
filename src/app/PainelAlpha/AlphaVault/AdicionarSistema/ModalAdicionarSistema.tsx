"use client";

import { useState } from "react";
import { X, Globe, Type, Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { adicionarSistemaCoreAction } from "@/actions/colaboradores";
import type { TemaAlpha } from "@/lib/temas";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    style: TemaAlpha;
}

const FAVICONS = [
    { id: 'google', name: 'Google', src: '/google.png' },
    { id: 'callix', name: 'Callix', src: '/callix.png' },
    { id: 'microsoft', name: 'Microsoft', src: '/microsoft.png' },
    { id: 'outlook', name: 'Outlook', src: '/icons8-microsoft-outlook-2019-48.png' },
];

export function ModalAdicionarSistema({ isOpen, onClose, style }: Props) {
    const [loading, setLoading] = useState(false);
    const [iconeSelecionado, setIconeSelecionado] = useState('google');

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const res = await adicionarSistemaCoreAction(formData);

        if (res.success) {
            toast.success("SISTEMA MAPEADO NO CORE ALPHA!");
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
                    <Globe className={style.text} size={22} /> Incluir Novo Sistema
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Identificação do Sistema</label>
                        <div className="relative">
                            <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                            <input required name="nome" placeholder="EX: GOOGLE WORKSPACE..." className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-[11px] font-black uppercase text-white outline-none focus:border-white/20 transition-all" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">URL de Acesso</label>
                        <div className="relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                            <input required name="link" type="text" placeholder="HTTPS://..." className="w-full bg-black/40 border border-white/5 rounded-2xl h-14 pl-12 pr-4 text-[11px] font-black text-white outline-none focus:border-white/20 transition-all" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 block text-center">Bandeja de Identidade Visual</label>
                        <div className="grid grid-cols-4 gap-3">
                            {FAVICONS.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setIconeSelecionado(item.id)}
                                    className={`cursor-pointer h-14 rounded-2xl flex items-center justify-center border transition-all relative overflow-hidden group ${iconeSelecionado === item.id ? 'border-white/20 bg-white/5' : 'bg-black/40 border-white/5 grayscale opacity-50 hover:grayscale-0 hover:opacity-100'}`}
                                >
                                    <div className="relative w-7 h-7">
                                        <Image
                                            src={item.src}
                                            alt={item.name}
                                            fill
                                            className="object-contain"
                                        />
                                    </div>
                                    {iconeSelecionado === item.id && (
                                        <div className={`absolute bottom-0 left-0 w-full h-0.5 ${style.bg}`} />
                                    )}
                                </button>
                            ))}
                        </div>
                        <input type="hidden" name="icone" value={iconeSelecionado} />
                    </div>

                    <button type="submit" disabled={loading} className={`cursor-pointer w-full h-16 mt-4 ${style.bg} rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95 shadow-xl`}>
                        {loading ? <div className="cursor-pointer h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={20} />}
                        Registrar Sistema
                    </button>
                </form>
            </div>
        </div>
    );
}
