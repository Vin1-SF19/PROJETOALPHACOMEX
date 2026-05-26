"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
    Plus,
    Filter,
    ArrowLeft,
    Eye,
    Search,
    MoreHorizontal,
    TrendingUp,
    MessageSquare,
    User,
    Calendar,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

import ModalCadastroCliente from "./ModalCadastro/modal";
import { buscarClientes } from "@/actions/Clientes";
import ModalGestaoCliente from './ModalCadastro/modalDados';
import ModalFiltros from './ModalCadastro/modalFiltros';
import ModalLogAuditoria from './ModalCadastro/modalLogAuditoria';
import { useSession } from "next-auth/react";

export const dynamic = 'force-dynamic';



export default function CadastroCliente() {

    const { data: session } = useSession();

    const [clientes, setClientes] = useState<any[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
    const [modalGestaoAberto, setModalGestaoAberto] = useState(false);

    const [modalFiltroAberto, setModalFiltroAberto] = useState(false);
    const [busca, setBusca] = useState("");
    const [ordenacao, setOrdenacao] = useState({ campo: 'razaoSocial', direcao: 'asc' });
    const [modalLogAberto, setModalLogAberto] = useState(false);
    const [clienteParaLog, setClienteParaLog] = useState<any>(null);
    const [termoBusca, setTermoBusca] = useState("");

    const clientesProcessados = useMemo(() => {
        const filtrados = clientes.filter((c:

            any) => {
            const busca = termoBusca.toLowerCase();
            const cnpjLimpo = busca.replace(/\D/g, "");

            return (
                c.razaoSocial?.toLowerCase().includes(busca) ||
                c.nomeFantasia?.toLowerCase().includes(busca) ||
                c.analistaResponsavel?.toLowerCase().includes(busca) ||
                (cnpjLimpo && c.cnpj?.includes(cnpjLimpo))
            );
        });

        return [...filtrados].sort((a, b) => {
            let valA = a[ordenacao.campo];
            let valB = b[ordenacao.campo];

            if (ordenacao.campo.toLowerCase().includes('data')) {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else {
                valA = valA ? valA.toString().toLowerCase() : "";
                valB = valB ? valB.toString().toLowerCase() : "";
            }

            if (ordenacao.direcao === 'asc') {
                return valA > valB ? 1 : -1;
            } else {
                return valA < valB ? 1 : -1;
            }
        });
    }, [termoBusca, clientes, ordenacao]);




    const abrirLog = (cliente: any) => {
        setClienteParaLog(cliente);
        setModalLogAberto(true);
    };


    const carregarDados = async () => {
        setCarregando(true);
        try {
            const dados = await buscarClientes();
            setClientes(dados);
        } catch (err) {
            console.error("Erro ao carregar clientes CS/NPS:", err);
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);


    const [modalAberto, setModalAberto] = useState(false);



    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-8">

                <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[2rem] bg-slate-900/40 border border-white/5 backdrop-blur-md shadow-2xl">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <TrendingUp className="text-indigo-400 w-6 h-6" />
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">
                                SISTEMA <span className="text-indigo-500">CS & NPS</span>
                            </h1>
                        </div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-[0.2em] ml-1">
                            Controle de Experiência e Feedbacks
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="h-8 w-[1px] bg-slate-800 mx-2 hidden md:block" />
                    </div>
                </header>

                {/* BARRA DE AÇÕES */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-slate-900/20 p-4 rounded-2xl border border-white/5">
                    <div className="lg:col-span-4 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisar cliente ou analista..."
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                        />
                    </div>

                    <div className="lg:col-span-8 flex flex-wrap items-center justify-end gap-3">
                        <button className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/20"
                            onClick={() => setModalAberto(true)}
                        >
                            <Plus size={16} /> Novo Cliente
                        </button>

                        <button
                            onClick={() => setModalFiltroAberto(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                            <Filter size={16} /> Filtro Avançado
                        </button>

                        <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-3 shadow-inner">
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Índice NPS</span>
                            {(() => {
                                const respondentes = clientes.filter(c =>
                                    c.nps !== null &&
                                    c.nps !== undefined &&
                                    c.nps !== "" &&
                                    !isNaN(Number(c.nps))
                                );

                                const total = respondentes.length;

                                if (total === 0) return <span className="font-black text-sm text-slate-700">---</span>;

                                const promotores = respondentes.filter(c => Number(c.nps) >= 9).length;
                                const detratores = respondentes.filter(c => Number(c.nps) <= 6).length;

                                const score = ((promotores - detratores) / total) * 100;

                                const corNPS = score >= 75 ? "text-emerald-400" :
                                    score >= 50 ? "text-amber-400" :
                                        score >= 0 ? "text-orange-400" : "text-rose-500";

                                return (
                                    <span className={`font-black text-sm ${corNPS}`}>
                                        {score > 0 ? "+" : ""}{score.toFixed(1)}%
                                    </span>
                                );
                            })()}
                        </div>




                    </div>
                </div>

                <div className="bg-slate-900/30 border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-slate-900/60">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">Status</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">Razão Social / CNPJ</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">Nome Fantasia</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 text-center">Data Contratação</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 text-center">Data Exito</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 text-center">Último CS</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 text-center">Feedback Google</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">Analista</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5 text-center">Log</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-white/5">
                                {carregando ? (
                                    <tr><td colSpan={9} className="py-10 text-center animate-pulse text-slate-500 uppercase font-black text-xs tracking-widest">Sincronizando base de dados...</td></tr>
                                ) : clientesProcessados.length === 0 ? (
                                    <tr><td colSpan={9} className="py-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-[0.3em]">Nenhum registro encontrado</td></tr>
                                ) : (
                                    clientesProcessados.map((c) => (
                                        <tr key={c.id} className="hover:bg-indigo-500/[0.02] transition-colors group">
                                            {/* STATUS */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`h-2 w-2 rounded-full shadow-[0_0_8px] ${c.status === 'Deferido' ? 'bg-emerald-500 shadow-emerald-500' :
                                                        (c.status === 'Cancelado - Indeferimento' || c.status === 'Cancelado - Troca de Empresa') ? 'bg-rose-500 shadow-rose-500' :
                                                            c.status === 'Stand By' ? 'bg-amber-500 shadow-amber-500' :
                                                                'bg-blue-500 shadow-blue-500'
                                                        }`} />
                                                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                                                        {c.status || "Em Andamento"}
                                                    </span>
                                                </div>
                                            </td>


                                            {/* RAZÃO SOCIAL */}
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span
                                                        onClick={() => { setClienteSelecionado(c); setModalGestaoAberto(true); }}
                                                        className="cursor-pointer text-sm font-bold text-white group-hover:text-indigo-400 transition-colors uppercase truncate max-w-[220px]">
                                                        {c.razaoSocial || "Razão Social não informada"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* NOME FANTASIA */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-semibold text-slate-300 uppercase italic">
                                                    {c.nomeFantasia || "---"}
                                                </span>
                                            </td>

                                            {/* DATA CONTRATAÇÃO */}
                                            <td className="px-6 py-4 text-center border-x border-white/[0.02]">
                                                <span className="text-[11px] font-mono text-slate-400">
                                                    {c.dataContratacao ? (
                                                        (() => {
                                                            const d = new Date(c.dataContratacao);

                                                            if (isNaN(d.getTime())) return c.dataContratacao;

                                                            return d.toLocaleDateString('pt-BR', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                timeZone: 'UTC'
                                                            });
                                                        })()
                                                    ) : (
                                                        <span className="opacity-20 italic">00/00/0000</span>
                                                    )}
                                                </span>
                                            </td>



                                            {/* DATA EXITO  */}
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">
                                                    {c.dataExito ? (
                                                        (() => {
                                                            const d = new Date(c.dataExito);
                                                            const dataCorrigida = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
                                                            return dataCorrigida.toLocaleDateString('pt-BR');
                                                        })()
                                                    ) : (
                                                        <span className="text-slate-800 opacity-40">Aguardando</span>
                                                    )}
                                                </span>
                                            </td>


                                            {/* ÚLTIMO CS */}
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[11px] font-mono text-slate-400">
                                                    {c.log_cs && c.log_cs.length > 0 ? (() => {
                                                        const datas = c.log_cs.map((l: any) => new Date(l.data_registro || l.dataRegistro).getTime());
                                                        const ultimaData = new Date(Math.max(...datas));
                                                        return ultimaData.toLocaleDateString('pt-BR');
                                                    })() : "---"}
                                                </span>


                                            </td>

                                            {/* FEEDBACK GOOGLE */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 size={14} className={c.feedbackGoogle ? "text-emerald-500" : "text-red-500"} />
                                                    <span className={`text-[10px] font-bold uppercase italic ${c.feedbackGoogle ? "text-emerald-500" : "text-red-500"}`}>
                                                        {c.feedbackGoogle ? "Sim" : "Não"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* ANALISTA */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-xs font-semibold">
                                                    <div className="h-6 w-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 border border-white/10">
                                                        {c.analistaResponsavel ? c.analistaResponsavel.charAt(0).toUpperCase() : "?"}
                                                    </div>
                                                    <span className={c.analistaResponsavel ? "text-slate-300" : "text-slate-700 italic"}>
                                                        {c.analistaResponsavel || "Sem Analista"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* LOG */}
                                            <td className="px-6 py-4 text-center">
                                                {(session?.user?.role === 'Admin' || session?.user?.role === "RECURSOS HUMANOS") ? (
                                                    <button
                                                        onClick={() => abrirLog(c)}
                                                        className="p-2 hover:bg-indigo-500/10 rounded-lg transition-all text-slate-700 hover:text-indigo-400 group-hover:text-slate-500 cursor-pointer"
                                                        title="Ver Histórico de Alterações"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                ) : (
                                                    <div className="p-2 text-slate-900/30 cursor-not-allowed" title="Acesso restrito à diretoria/RH">
                                                        <Eye size={18} className="opacity-20" />
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>

                        </table>
                    </div>
                </div>
            </div>

            <footer className="max-w-[1600px] mx-auto px-8 py-6 text-slate-600 text-[10px] uppercase font-black tracking-[0.3em] flex justify-between border-t border-white/5 mt-auto">
                <span>Alpha Comex - {new Date().getFullYear()}</span>

                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <span>Total: <span className="text-slate-300">{clientes.length}</span> Clientes</span>
                </div>
            </footer>


            <ModalGestaoCliente
                isOpen={modalGestaoAberto}
                cliente={clienteSelecionado}
                onClose={() => setModalGestaoAberto(false)}
                aoSalvar={carregarDados}
            />

            <ModalCadastroCliente
                isOpen={modalAberto}
                onClose={() => setModalAberto(false)}
            />

            <ModalFiltros
                isOpen={modalFiltroAberto}
                onClose={() => setModalFiltroAberto(false)}
                ordenacao={ordenacao}
                setOrdenacao={setOrdenacao}
            />

            <ModalLogAuditoria
                isOpen={modalLogAberto}
                onClose={() => {
                    setModalLogAberto(false);
                    setClienteParaLog(null);
                }}
                cliente={clienteParaLog}
                aoSalvar={carregarDados}
            />
        </div>
    );
}