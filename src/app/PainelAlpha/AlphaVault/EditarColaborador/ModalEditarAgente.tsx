"use client";

import { useState } from "react";
import { X, ShieldCheck, Briefcase, Calendar, Check, Power, Mail, Plus, Lock, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { atualizarAgenteSistemaAction } from "@/actions/colaboradores";
import Image from "next/image";
import { ModalVincularAcesso } from "./VincularAcesso";
import { CampoAlpha } from "@/components/CampoAlpha";
import type { TemaAlpha } from "@/lib/temas";
import type { ColaboradorVault, RecursoVault, SistemaVault } from "../types";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    agente: ColaboradorVault;
    style: TemaAlpha;
    sistemas: SistemaVault[];
    recursos?: RecursoVault[];
}

export function ModalEditarAgente({ isOpen, onClose, agente, style, sistemas, recursos = [] }: Props) {
    const [loading, setLoading] = useState(false);
    const [modalRecursoAberto, setModalRecursoAberto] = useState(false);
    const [verSenhas, setVerSenhas] = useState<{ [key: string]: boolean }>({});

    if (!isOpen || !agente) return null;

    const toggleSenha = (id: string) => {
        setVerSenhas(prev => ({ ...prev, [id]: !prev[id] }));
    };

    async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        formData.append("id", agente.id.toString());

        const res = await atualizarAgenteSistemaAction(formData);
        if (res.success) {
            toast.success("DADOS ATUALIZADOS COM SUCESSO!");
            onClose();
        } else {
            toast.error(res.error);
        }
        setLoading(false);
    }

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
                <div className="bg-[#020617] border border-white/10 p-1 rounded-[3rem] max-w-3xl w-full shadow-2xl relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${style.bg} shadow-[0_0_20px_rgba(255,255,255,0.3)]`} />

                    <div className="bg-[#0f172a] rounded-[2.9rem] p-10 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-10">
                            <div className="flex items-center gap-4">
                                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${agente.status === 'ATIVO' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    {agente.status}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalRecursoAberto(true)}
                                    className="group flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 p-2 px-4 rounded-xl transition-all active:scale-95"
                                >
                                    <Plus size={16} className={style.text} />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Adicionar Login</span>
                                </button>
                            </div>

                            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pb-10 border-b border-white/5">
                           
                            <div className="space-y-6">
                                <CampoAlpha
                                    label="Nome do Agente"
                                    defaultValue={agente.nome}
                                    readOnly
                                />

                                <CampoAlpha
                                    label="Cargo Atual"
                                    name="cargo"
                                    type="select"
                                    icon={Briefcase}
                                    defaultValue={agente.cargo ?? undefined}
                                    options={["CEO", "DIRETOR", "GERENTE", "SUPERVISOR", "AGENTE ALPHA", "ESTAGIÁRIO"]}
                                />

                                {agente.email && (
                                    <CampoAlpha
                                        label="E-mail de Acesso"
                                        type="email"
                                        icon={Mail}
                                        defaultValue={agente.email}
                                        readOnly
                                    />
                                )}
                            </div>

                            <div className="space-y-6">
                                <CampoAlpha
                                    label="Setores"
                                    name="setor"
                                    type="select"
                                    icon={ShieldCheck}
                                    defaultValue={agente.role} 
                                    options={["T.I", "CEO", "OPERACIONAL", "COMERCIAL", "RECURSOS HUMANOS", "FINANCEIRO", "JURÍDICO", "PARCEIRO", "SERVIÇOS GERAIS"]}
                                />

                                <CampoAlpha
                                    label="Data de Contratação"
                                    name="data"
                                    type="date"
                                    icon={Calendar}
                                    defaultValue={agente.data_contratacao ?? undefined}
                                />

                                <CampoAlpha
                                    label="Status de Acesso"
                                    name="status"
                                    type="select"
                                    icon={Power}
                                    defaultValue={agente.status ?? undefined}
                                    options={["ATIVO", "INATIVO"]}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <button type="submit" disabled={loading} className={`w-full h-16 ${style.bg} rounded-2xl text-[11px] font-black uppercase tracking-[0.4em] flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95 shadow-xl`}>
                                    {loading ? <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={20} />}
                                    Salvar Credenciais
                                </button>
                            </div>
                        </form>


                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center gap-2">
                                <Lock size={14} className={style.text} /> Vault de Acessos Alpha
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                {recursos.length > 0 ? recursos.map((rec) => {
                                    const urlFormatada = rec.link.startsWith('http') ? rec.link : `https://${rec.link}`;

                                    return (
                                        <div key={rec.id} className="bg-black/40 border border-white/5 rounded-[2rem] p-5 flex items-center justify-between group hover:border-white/10 transition-all shadow-inner">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center relative overflow-hidden border border-white/10 shadow-2xl">
                                                    <Image src={`/${rec.icone}.png`} alt={rec.sistema_nome} fill className="p-3 object-contain" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[11px] font-black uppercase text-white tracking-[0.2em]">{rec.sistema_nome}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Mail size={12} className="text-slate-600" />
                                                        <span className="text-[13px] font-bold text-slate-400 tracking-tight">{rec.login}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="bg-black/60 px-5 py-3 rounded-2xl border border-white/10 flex items-center gap-4 min-w-[180px] justify-between shadow-xl">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest mb-0.5">Chave de Acesso</span>
                                                        <span className="text-[14px] font-mono font-bold text-emerald-500 tracking-[0.15em]">
                                                            {verSenhas[rec.id] ? rec.senha : "••••••••"}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSenha(String(rec.id))}
                                                        className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all"
                                                    >
                                                        {verSenhas[rec.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>

                                                <a
                                                    href={urlFormatada}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-500 hover:${style.text} border border-white/5 transition-all active:scale-95`}
                                                    title={`Acessar ${rec.sistema_nome}`}
                                                >
                                                    <ExternalLink size={20} />
                                                </a>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-black/20">
                                        <Lock size={32} className="mx-auto text-slate-800 mb-4" />
                                        <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.3em]">Vault de segurança vazio</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <ModalVincularAcesso
                isOpen={modalRecursoAberto}
                onClose={() => setModalRecursoAberto(false)}
                agenteId={agente.id.toString()}
                sistemas={sistemas}
                style={style}
            />
        </>
    );
}
