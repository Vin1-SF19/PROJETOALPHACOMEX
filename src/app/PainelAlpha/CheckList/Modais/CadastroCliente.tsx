"use client"

import { useState } from 'react';
import { Search, CheckCircle2, Loader2, Lock, AlertCircle, X, UserPlus } from 'lucide-react';
import { cadastrarApenasCliente, vincularEmpresaAoCliente, buscarClienteParaVincularOperacional } from '@/actions/ClientesOperacional';

type ClienteAcesso = { id: string; nome: string; email: string };

export default function ModalCadastroCliente({
    isOpen,
    onClose,
    clientesExistentes,
}: {
    isOpen: boolean;
    onClose: () => void;
    clientesExistentes: ClienteAcesso[];
}) {
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [loadingUsuario, setLoadingUsuario] = useState(false);
    const [loadingFinal, setLoadingFinal] = useState(false);

    const [consultado, setConsultado] = useState(false);
    const [usuarioCriado, setUsuarioCriado] = useState(false);
    const [vinculo, setVinculo] = useState("novo");
    const [idUsuarioSelecionado, setIdUsuarioSelecionado] = useState<string | undefined>(undefined);
    const [erro, setErro] = useState("");

    const [form, setForm] = useState({
        cnpj: '',
        razaoSocial: '',
        nomeFantasia: '',
        nomeCliente: '',
        emailCliente: '',
        senhaProvisoria: '',
    });

    const handleConsultar = async () => {
        const cnpjLimpo = form.cnpj.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cnpjLimpo.length < 11) return setErro("CNPJ incompleto.");

        setLoadingConsulta(true);
        setErro("");
        try {
            const resposta = await buscarClienteParaVincularOperacional(cnpjLimpo);
            if (!resposta.success || !resposta.data) {
                setConsultado(false);
                return setErro(resposta.error || "Empresa não encontrada no CRM.");
            }

            setForm(prev => ({
                ...prev,
                cnpj: resposta.data.cnpj || cnpjLimpo,
                razaoSocial: resposta.data.razaoSocial,
                nomeFantasia: resposta.data.nomeFantasia || "",
            }));
            setConsultado(true);
        } catch {
            setErro("Erro na consulta.");
        } finally {
            setLoadingConsulta(false);
        }
    };

    const handleCriarUsuario = async () => {
        if (!form.nomeCliente || !form.emailCliente || !form.senhaProvisoria) {
            return setErro("Preencha todos os dados do novo acesso.");
        }
        setLoadingUsuario(true);
        setErro("");
        try {
            const res = await cadastrarApenasCliente({
                nome: form.nomeCliente,
                email: form.emailCliente,
                senha: form.senhaProvisoria
            });

            if (res.success && res.id) {
                setIdUsuarioSelecionado(res.id);
                setUsuarioCriado(true);
                setErro("");
            } else {
                setErro(res.error || "Erro ao criar usuário.");
            }
        } catch {
            setErro("Falha ao conectar com o servidor.");
        } finally {
            setLoadingUsuario(false);
        }
    };

    const handleFinalizar = async () => {
        if (!consultado) return setErro("Consulte o CNPJ primeiro.");
        const finalId = vinculo === "novo" ? idUsuarioSelecionado : vinculo;

        if (!finalId) return setErro("Usuário de acesso não definido.");

        setLoadingFinal(true);
        try {

            const res = await vincularEmpresaAoCliente({
                cnpj: form.cnpj,
                clienteOperacionalId: finalId,
            });

            if (res.success) {
                onClose();
            } else {
                setErro(res.error || "Erro ao vincular empresa.");
            }
        } catch (e) {
            setErro("Erro de conexão com o banco.");
            console.error(e);
        } finally {
            setLoadingFinal(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="bg-slate-900 border border-white/10 w-full max-w-xl rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden">

                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Novo Cadastro Operacional</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Seção Empresa */}
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">CNPJ da Empresa</label>
                            <p className="text-[10px] text-slate-500 ml-2">A empresa precisa já estar cadastrada no Alpha CRM.</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="00.000.000/0000-00"
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
                                    value={form.cnpj}
                                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                                />
                                <button onClick={handleConsultar} className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl transition-all shadow-lg shadow-blue-600/20">
                                    {loadingConsulta ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {consultado && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <p className="text-[10px] font-black text-emerald-500 uppercase mb-2 ml-2 tracking-widest">Empresa Localizada no CRM</p>
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                                <p className="text-xs font-bold text-white truncate">{form.razaoSocial}</p>
                                <p className="text-[10px] text-slate-500 font-medium mt-1">{form.nomeFantasia || 'SEM NOME FANTASIA'}</p>
                            </div>
                        </div>
                    )}

                    <hr className="border-white/5" />

                    {/* Seção Usuário */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-2">Vincular Acesso de Cliente</label>
                        <select
                            value={vinculo}
                            onChange={(e) => { setVinculo(e.target.value); setUsuarioCriado(false); }}
                            className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl py-4 px-6 text-sm text-white outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="novo" className="bg-slate-900 text-blue-400 font-bold">+ CRIAR NOVO USUÁRIO</option>
                            {clientesExistentes?.map((c) => (
                                <option key={c.id} value={c.id} className="bg-slate-900">{c.nome} ({c.email})</option>
                            ))}
                        </select>

                        {vinculo === "novo" && !usuarioCriado && (
                            <div className="grid grid-cols-1 gap-4 p-6 border border-white/10 rounded-[2rem] bg-white/[0.01] shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" placeholder="NOME DO CLIENTE" className="bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:border-blue-500/50 outline-none" onChange={(e) => setForm({ ...form, nomeCliente: e.target.value.toUpperCase() })} />
                                    <input type="email" placeholder="EMAIL DE ACESSO" className="bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:border-blue-500/50 outline-none" onChange={(e) => setForm({ ...form, emailCliente: e.target.value.toLowerCase() })} />
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input type="text" readOnly value={form.senhaProvisoria} placeholder="SENHA" className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 px-6 text-sm text-emerald-400 font-mono tracking-wider outline-none" />
                                        <button onClick={() => setForm({ ...form, senhaProvisoria: Math.random().toString(36).slice(-6).toUpperCase() })} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors"><Lock size={16} /></button>
                                    </div>
                                    <button
                                        onClick={handleCriarUsuario}
                                        disabled={loadingUsuario}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {loadingUsuario ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                                        Gerar Acesso
                                    </button>
                                </div>
                            </div>
                        )}

                        {usuarioCriado && (
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                <CheckCircle2 size={16} /> Acesso Criado! Clique em salvar abaixo.
                            </div>
                        )}
                    </div>

                    {erro && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-[10px] font-black uppercase tracking-widest">
                            <AlertCircle size={16} /> {erro}
                        </div>
                    )}

                    <button
                        onClick={handleFinalizar}
                        disabled={!consultado || (vinculo === "novo" && !usuarioCriado) || loadingFinal}
                        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${consultado && (vinculo !== "novo" || usuarioCriado)
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                            : "bg-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                            }`}
                    >
                        {loadingFinal ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        Finalizar e Salvar Cliente
                    </button>
                </div>
            </div>
        </div>
    );
}
