"use client";
import React, { useState } from 'react';
import { X, Mail, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { toast } from 'sonner';
import { solicitarRecuperacao } from "@/actions/RecuperarSenha";

export default function ModalRecuperarSenha({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [email, setEmail] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [sucesso, setSucesso] = useState(false);

    const handleRecuperar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.includes("@")) return toast.error("Insira um e-mail válido.");

        setEnviando(true);

        try {
            await solicitarRecuperacao(email);
            setEnviando(false);
            setSucesso(true);
            toast.success("E-mail de recuperação enviado!", {
                description: "Verifique sua caixa de entrada e spam."
            });
        } catch {
            setEnviando(false);
            toast.error("Não foi possível processar a solicitação. Tente novamente.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[#0b1220] border border-white/10 w-full max-w-md rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative">
                
                {/* LINHA DE LUZ SUPERIOR */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />

                <div className="p-8">
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                <ShieldCheck className="text-indigo-400" size={20} />
                            </div>
                            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter">
                                Recuperar <span className="text-indigo-500">Acesso</span>
                            </h2>
                        </div>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>

                    {!sucesso ? (
                        <form onSubmit={handleRecuperar} className="space-y-6">
                            <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed tracking-widest italic">
                                Informe seu e-mail corporativo para receber o link de redefinição de senha com validade de 1 hora.
                            </p>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-600 ml-1 tracking-widest">E-mail Cadastrado</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    <input 
                                        type="email" 
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="exemplo@alphacomex.com" 
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-800"
                                    />
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={enviando}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group"
                            >
                                {enviando ? (
                                    <Loader2 className="animate-spin" size={16} />
                                ) : (
                                    <>
                                        Solicitar Link <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="py-8 text-center space-y-6 animate-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                                <Mail className="text-emerald-500" size={32} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-white font-bold uppercase text-sm tracking-widest">Tudo pronto!</h3>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                    Se o e-mail <strong>{email}</strong> estiver em nossa base, você receberá as instruções em instantes.
                                </p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-400 transition-colors"
                            >
                                Voltar para o login
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-900/40 border-t border-white/5 text-center">
                    <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest">
                        Protocolo de Segurança Alpha v2.0
                    </p>
                </div>
            </div>
        </div>
    );
}
