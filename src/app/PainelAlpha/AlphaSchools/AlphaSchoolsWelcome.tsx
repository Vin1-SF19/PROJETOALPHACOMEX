'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronRight, ShieldCheck, Settings, Loader2, Lock } from 'lucide-react';
import { getTema } from "@/lib/temas";
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { toast } from 'sonner';


export default function AlphaSchoolsWelcome({ onEnter }: any) {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(false);

    const temaNome = (session?.user as any)?.tema_interface || "blue";
    const style = getTema(temaNome);
    const isAdmin = (session?.user as any)?.role === "Admin";
    
    const temPreset = !!(session?.user as any)?.presetId;

    const handleAcessoProva = async () => {
        if (!temPreset) {
            toast.error("ACESSO RESTRITO", {
                description: "Sua conta não possui uma trilha de treinamento vinculada. Contate um administrador.",
                duration: 5000,
            });
            return;
        }

        setLoading(true);
        try {
            await onEnter(); 
        } catch (error) {
            toast.error("Erro ao sincronizar protocolo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-[#020617] flex items-center justify-center p-6 overflow-hidden">
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] ${style.glow} blur-[120px] opacity-30 transition-all duration-700`} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-4xl"
            >
                <div className={`relative bg-slate-900/20 backdrop-blur-xl border ${style.border.replace('20', '40')} rounded-[3rem] overflow-hidden shadow-2xl`}>

                    {/* Header */}
                    <div className="h-12 border-b border-white/5 bg-black/40 flex items-center justify-between px-8">
                        <div className="flex gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${style.bg} opacity-50`} />
                            <div className={`w-2.5 h-2.5 rounded-full ${style.bg} opacity-30`} />
                            <div className={`w-2.5 h-2.5 rounded-full ${style.bg} opacity-10`} />
                        </div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] italic">
                            Alpha Schools //
                        </span>
                    </div>

                    <div className="flex flex-col md:flex-row">
                        <div className="flex-1 p-8 md:p-16">
                            <div className="flex items-center gap-3 mb-6">
                                <span className={`w-10 h-[2px] ${style.bg}`} />
                                <span className={`font-black uppercase text-[10px] tracking-widest ${style.text}`}>
                                    {temPreset ? "Acesso Autorizado" : "Aguardando Vínculo"}
                                </span>
                            </div>

                            <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none italic mb-6">
                                Alpha <br />
                                <span className={style.text}>Schools</span>
                            </h1>

                            <p className="text-slate-400 text-lg font-medium leading-relaxed mb-10 max-w-sm">
                                Olá, <span className="text-white font-bold">{(session?.user as any)?.nome || 'Agente'}</span>. 
                                {temPreset 
                                    ? " Seu preset de treinamento foi localizado. Prepare-se para a certificação." 
                                    : " Seu perfil ainda não foi vinculado a uma trilha de treinamento no sistema."}
                            </p>

                            <motion.button
                                whileHover={temPreset ? { scale: 1.02 } : {}}
                                whileTap={temPreset ? { scale: 0.98 } : {}}
                                onClick={handleAcessoProva}
                                disabled={loading}
                                className={`cursor-pointer group w-fit flex items-center gap-4 px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all ${
                                    temPreset 
                                    ? `${style.bg} text-white ${style.shadow}` 
                                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                                }`}
                            >
                                {loading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : !temPreset ? (
                                    <Lock size={18} />
                                ) : (
                                    <Zap size={18} fill="white" />
                                )}
                                {loading ? "Carregando..." : temPreset ? "Acessar Treinamento" : "Acesso Bloqueado"}
                                {temPreset && !loading && <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                            </motion.button>
                        </div>

                        <div className="w-full md:w-80 bg-black/40 border-l border-white/5 p-8 flex flex-col justify-center gap-6">
                            <div className={`p-6 rounded-3xl border ${temPreset ? style.border : 'border-red-500/20'} bg-white/5 space-y-4`}>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Status do Preset</span>
                                    <span className={`text-sm font-bold uppercase italic ${temPreset ? 'text-green-500' : 'text-red-500'}`}>
                                        {temPreset ? "Vinculado" : "Não Encontrado"}
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Nível de Acesso</span>
                                    <span className="text-sm font-bold text-white uppercase italic">{session?.user?.role || "Padrão"}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 px-2">
                                <div className={`p-3 rounded-xl bg-white/5 ${style.text}`}>
                                    <ShieldCheck size={24} />
                                </div>
                                <p className="text-[9px] font-black text-slate-500 uppercase leading-tight tracking-widest">
                                    Protocolo de Segurança <br />
                                    <span className="text-white">Verificação Biométrica</span>
                                </p>
                            </div>


                            {isAdmin && (
                                <Link href='/PainelAlpha/AlphaSchools/presets'>
                                    <button className={`cursor-pointer h-12 w-full px-6 rounded-xl border ${style.border} bg-white/5 hover:bg-white/10 transition-all flex items-center gap-3 group`}>
                                        <Settings size={16} className={`${style.text} group-hover:rotate-90 transition-transform duration-500`} />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-white">Gerenciar Presets</span>
                                    </button>
                                </Link>
                            )}
                        </div>
                    </div>
                    <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent ${style.bg.replace('bg-', 'via-')} to-transparent opacity-50`} />
                </div>
            </motion.div>
        </div>
    );
}